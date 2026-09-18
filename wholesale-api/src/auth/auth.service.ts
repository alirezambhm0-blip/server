import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { Customer, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { SensitiveField } from './dto/sensitive-change.dto';
import { randomInt } from 'crypto';
// P1-2 — کد OTP یک secret با آنتروپی پایین است (۶ رقم ⇒ ۱۰^۶ حالت)، پس هش
// بدون salt مثل SHA-256(otp) در برابر حدس آفلاین مقاوم نیست. bcrypt یک تابع
// hashing مخصوص secret است که salt را درون خودش نگه می‌دارد و cost factor دارد.
//
// نکتهٔ مهم: bcrypt از قبل در dependencies پروژه اعلام شده بود (package.json)
// ولی هیچ‌جا استفاده نمی‌شد؛ بنابراین هیچ وابستگی جدیدی اضافه نشده است.
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { TooManyRequestsException } from '../common/too-many-requests.exception';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications/notifications.service';

// ---------- پیکربندی ثابت‌های OTP ----------
export const OTP_CONFIG = {
  CODE_LENGTH: 6,
  CODE_TTL_MS: 2 * 60 * 1000, // 2 دقیقه
  MAX_VERIFY_ATTEMPTS: 5, // حداکثر تلاش اشتباه verify
  LOCK_DURATION_MS: 15 * 60 * 1000, // قفل ۱۵ دقیقه‌ای
  RESEND_COOLDOWN_MS: 60 * 1000, // فاصله مجاز درخواست مجدد: ۶۰ ثانیه
  // P1-2 — cost factor برای bcrypt.
  // تحلیل: فضای جست‌وجوی کد ۱۰^۶ است، ولی عمر مفید کد فقط ۲ دقیقه است.
  // با cost=10 یک هسته حدود ۱۰ هش بر ثانیه می‌زند ⇒ در ۱۲۰ ثانیه حدود
  // ۱٬۲۰۰ تلاش از ۱٬۰۰۰٬۰۰۰ حالت (≈۰٫۱٪). یعنی شکستن آفلاین در بازهٔ
  // اعتبار کد عملاً ناممکن است. cost بالاتر مقاومت را بیشتر می‌کند ولی
  // زمان مقایسه را داخل تراکنش دیتابیس طولانی‌تر می‌کند، لذا ۱۰ انتخاب شد.
  BCRYPT_ROUNDS: 10,
};

// شکل خروجی customer که به فرانت داده می‌شود (هماهنگ با StoredCustomer موبایل)
export type CustomerShape = {
  id: string;
  userId: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  storeName: string | null;
  nationalCode: string | null;
  landline: string | null;
  province: string | null;
  city: string | null;
  address: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  businessType: string | null;
  nationalCardImage: string | null;
  businessLicenseImage: string | null;
  selfieWithIdCardImage: string | null;
  storefrontImage: string | null;
  onboardingCompleted: boolean;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'BLOCKED';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type CustomerRecord = Customer;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly smsService: SmsService,
    private readonly jwtService: JwtService,
    private readonly notificationsService: NotificationsService,
    @Inject(EventEmitter2) private readonly eventEmitter: EventEmitter2
  ) {}

  // ---------------------------------------------------------------------------
  // نرمال‌سازی شماره موبایل. بعد از ValidationPipe که ^09\d{9}$ چک می‌کند،
  // این تابع در عمل یک safety net است.
  // ---------------------------------------------------------------------------
  normalizePhone(raw: string): string {
    let clean = raw.replace(/\D/g, '');
    if (clean.startsWith('98')) clean = '0' + clean.slice(2);
    if (!clean.startsWith('0')) clean = '0' + clean;
    return clean;
  }

  // ===========================================================================
  // مرحله ۱: درخواست کد تایید
  // ===========================================================================
  async requestOtp(dto: RequestOtpDto, meta?: { ip?: string; userAgent?: string }) {
    const phone = this.normalizePhone(dto.phone);
    const now = new Date();

    // جلوگیری از درخواست OTP برای کاربر مسدود
    const blockedUser = await this.prisma.user.findUnique({
      where: { phone },
      include: { customer: true },
    });
    if (blockedUser && !blockedUser.isActive) {
      throw new UnauthorizedException('حساب کاربری شما مسدود شده است');
    }
    if (blockedUser?.customer?.status === 'BLOCKED') {
      throw new UnauthorizedException('حساب شما مسدود شده است. با پشتیبانی تماس بگیرید');
    }

    const existing = await this.prisma.otp.findUnique({ where: { phone } });

    if (existing) {
      // قفل؟
      if (
        existing.attempts >= OTP_CONFIG.MAX_VERIFY_ATTEMPTS &&
        existing.lastAttemptAt &&
        now.getTime() - existing.lastAttemptAt.getTime() < OTP_CONFIG.LOCK_DURATION_MS
      ) {
        const remainingMs = OTP_CONFIG.LOCK_DURATION_MS - (now.getTime() - existing.lastAttemptAt.getTime());
        const remainingMinutes = Math.ceil(remainingMs / 60000);
        throw new TooManyRequestsException(
          `حساب شما به‌دلیل تلاش‌های ناموفق زیاد قفل شده است. لطفاً ${remainingMinutes} دقیقه دیگر تلاش کنید.`
        );
      }

      // cooldown ارسال مجدد
      const sinceLastSend = now.getTime() - existing.updatedAt.getTime();
      if (sinceLastSend < OTP_CONFIG.RESEND_COOLDOWN_MS && !existing.usedAt) {
        const remainingSec = Math.ceil((OTP_CONFIG.RESEND_COOLDOWN_MS - sinceLastSend) / 1000);
        throw new TooManyRequestsException(`لطفاً ${remainingSec} ثانیه دیگر تا درخواست مجدد صبر کنید.`);
      }
    }

    const min = 10 ** (OTP_CONFIG.CODE_LENGTH - 1);
    const max = 10 ** OTP_CONFIG.CODE_LENGTH - 1;
    const code = randomInt(min, max).toString();
    const expiresAt = new Date(now.getTime() + OTP_CONFIG.CODE_TTL_MS);

    // P1-2 — تولید کد بدون تغییر باقی مانده است (همان randomInt از crypto نود،
    // همان طول، همان آنتروپی). تنها چیزی که عوض شده «ذخیره‌سازی» است:
    // به‌جای خودِ کد، یک bcrypt verifier (شامل salt تصادفیِ داخلی bcrypt) ذخیره
    // می‌شود. خودِ `code` فقط در حافظه می‌ماند تا به SMS provider داده شود.
    // bcrypt هر بار salt تازه تولید می‌کند، پس دو کد یکسان verifier یکسان ندارند.
    const codeHash = await bcrypt.hash(code, OTP_CONFIG.BCRYPT_ROUNDS);

    try {
      await this.prisma.otp.upsert({
        where: { phone },
        update: {
          codeHash,
          expiresAt,
          attempts: 0,
          lastAttemptAt: null,
          usedAt: null,
          resendCount: { increment: 1 },
        },
        create: {
          phone,
          codeHash,
          expiresAt,
          attempts: 0,
          resendCount: 1,
        },
      });

      await this.prisma.otpAttempt.create({
        data: {
          phone,
          action: 'RESEND',
          success: true,
          ip: meta?.ip,
          userAgent: meta?.userAgent,
        },
      });

      const isProd = process.env.NODE_ENV === 'production';
      if (isProd) {
        await this.smsService.sendOtp(phone, code);
        this.logger.log(`OTP SMS sent to ${this.maskPhone(phone)}`);
        return {
          message: 'کد تایید ارسال شد',
          cooldown: OTP_CONFIG.RESEND_COOLDOWN_MS / 1000,
        };
      }

      this.logger.debug(`[DEV] OTP for ${phone} => ${code}`);
      return {
        message: 'کد تایید (Development Mode)',
        testCode: code,
        cooldown: OTP_CONFIG.RESEND_COOLDOWN_MS / 1000,
      };
    } catch (error) {
      if (error instanceof TooManyRequestsException || error instanceof BadRequestException) {
        throw error;
      }
      const msg = error instanceof Error ? error.message : 'SMS Failure';
      this.logger.error(`OTP Process Error: ${msg}`);

      if (error instanceof ServiceUnavailableException || error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException('خطا در فرآیند ارسال کد');
    }
  }

  // ===========================================================================
  // مرحله ۲: تایید کد → ساخت/یافتن کاربر و customer → صدور JWT
  // ===========================================================================
  async verifyOtp(dto: VerifyOtpDto, meta?: { ip?: string; userAgent?: string }) {
    const phone = this.normalizePhone(dto.phone);
    const code = dto.code.trim();
    const now = new Date();

    // استفاده از تراکنش برای جلوگیری از race condition در تایید کد
    //
    // ⚠️ S2 — نکتهٔ حیاتی: نوشتن شمارندهٔ «تلاش ناموفق» باید بیرون از این تراکنش باشد.
    // اگر داخل تراکنش بنویسیم و بعد throw کنیم، تراکنش rollback می‌شود و شمارنده
    // هرگز در DB ذخیره نمی‌شود → شرط قفل (attempts >= MAX) هرگز true نمی‌شود
    // → کد ۶ رقمی بدون هیچ محدودیتی قابل brute force است.
    let wrongCode = false;
    try {
      await this.prisma.$transaction(async (tx) => {
        const record = await tx.otp.findUnique({ where: { phone } });
        if (!record) {
          throw new BadRequestException('کد تایید نامعتبر است یا برای شما ارسال نشده است');
        }

        // قفل؟
        if (
          record.attempts >= OTP_CONFIG.MAX_VERIFY_ATTEMPTS &&
          record.lastAttemptAt &&
          now.getTime() - record.lastAttemptAt.getTime() < OTP_CONFIG.LOCK_DURATION_MS
        ) {
          const remainingMs = OTP_CONFIG.LOCK_DURATION_MS - (now.getTime() - record.lastAttemptAt.getTime());
          const remainingMinutes = Math.ceil(remainingMs / 60000);
          throw new TooManyRequestsException(
            `حساب شما به‌دلیل تلاش‌های ناموفق زیاد قفل شده است. لطفاً ${remainingMinutes} دقیقه دیگر تلاش کنید.`
          );
        }

        // منقضی؟
        if (record.expiresAt < now) {
          // B11 — قبلاً Error خام → HTTP 500 و پیام «Internal server error»
          throw new BadRequestException('کد تایید منقضی شده است. لطفاً دوباره درخواست کد دهید.');
        }

        // استفاده شده؟ (replay)
        if (record.usedAt) {
          throw new BadRequestException('این کد قبلاً استفاده شده است. لطفاً کد جدید درخواست دهید.');
        }

        // P1-2 — مقایسهٔ plaintext حذف شد.
        // به‌جای `record.code !== code`، کد ارسالی با bcrypt verifier سنجیده می‌شود؛
        // یعنی plaintext هرگز از دیتابیس خوانده یا با آن مقایسه نمی‌شود.
        //
        // دو نکتهٔ عمدی:
        //  ۱) این فراخوانی async *داخل* تراکنش است. ساختار تراکنش عمداً دست
        //     نخورده ماند تا هم حفاظت race-condition و هم اصلاح S2 (نوشتن
        //     شمارندهٔ تلاش بیرون از تراکنشِ rollback‌شده) دقیقاً حفظ شود.
        //     هزینهٔ آن ~۱۰۰ms نگه‌داشتن کانکشن است که با توجه به rate limit
        //     موجود (verify-otp) قابل قبول است.
        //  ۲) `.catch(() => false)` یک رفتار fail-closed است: اگر verifier
        //     نامعتبر باشد (مثلاً رکورد باقی‌مانده از پیش از migration)،
        //     به‌جای پرتاب خطای ۵۰۰، «کد اشتباه» برمی‌گردد.
        const isMatch = await bcrypt.compare(code, record.codeHash).catch(() => false);

        // اشتباه؟
        if (!isMatch) {
          // فقط علامت‌گذاری می‌کنیم؛ نوشتن واقعی بیرون از تراکنش انجام می‌شود (S2).
          wrongCode = true;
          const newAttempts = record.attempts + 1;

          const remaining = OTP_CONFIG.MAX_VERIFY_ATTEMPTS - newAttempts;
          if (remaining <= 0) {
            throw new TooManyRequestsException(
              'تعداد تلاش‌های ناموفق بیش از حد مجاز بود. حساب شما به‌مدت ۱۵ دقیقه قفل شد.'
            );
          }
          throw new BadRequestException(`کد تایید اشتباه است. ${remaining} تلاش دیگر تا قفل شدن حساب.`);
        }

        // ====== کد صحیح ======
        await tx.otp.update({
          where: { phone },
          data: {
            usedAt: now,
            lastAttemptAt: now,
            attempts: { increment: 1 },
          },
        });

        return record;
      });
    } catch (error) {
      // ثبت شمارندهٔ تلاش ناموفق **بیرون** از تراکنشِ rollback‌شده (S2).
      // خطای ثبت شمارنده هرگز نباید جلوی خطای اصلی را بگیرد.
      if (wrongCode) {
        await this.prisma.otp
          .update({
            where: { phone },
            data: { attempts: { increment: 1 }, lastAttemptAt: now },
          })
          .catch((e) => this.logger.error(`ثبت شمارندهٔ تلاش ناموفق OTP ناموفق بود: ${String(e)}`));
      }
      throw error; // ← همان exception قبلی، بدون هیچ تغییری در پیام
    }

    // کاربر موجود؟
    let user = await this.prisma.user.findUnique({ where: { phone } });

    // بررسی شماره ادمین از فایل .env
    const adminPhone = process.env.ADMIN_PHONE;
    const isSystemAdmin = adminPhone && (phone === adminPhone || this.normalizePhone(adminPhone) === phone);

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone,
          isActive: true,
          role: isSystemAdmin ? 'ADMIN' : 'CUSTOMER',
        },
      });
      this.logger.log(`New user created: ${user.id} (${this.maskPhone(phone)}) with role ${user.role}`);
    } else if (isSystemAdmin && user.role !== 'ADMIN') {
      // اگر کاربر از قبل بود ولی نقش ادمین نداشت، ارتقا داده شود
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN' },
      });
      this.logger.log(`User ${phone} promoted to ADMIN via .env config`);
    }

    // چک کردن اینکه کاربر مسدود نباشد
    if (!user.isActive) {
      throw new UnauthorizedException('حساب کاربری شما مسدود شده است');
    }

    // customer؟
    let customer = await this.prisma.customer.findUnique({
      where: { userId: user.id },
    });
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          userId: user.id,
          onboardingCompleted: false,
          status: 'PENDING',
        },
      });
    }

    if (customer.status === 'BLOCKED') {
      throw new UnauthorizedException('حساب شما مسدود شده است. با پشتیبانی تماس بگیرید');
    }

    await this.logAttempt(phone, code, true, customer.id, meta);

    const payload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    this.logger.log(`OTP verified successfully for user ${user.id}`);

    return {
      accessToken,
      user: { id: user.id, phone: user.phone, role: user.role },
      customer: this.shapeCustomer(customer, user.phone),
    };
  }

  // ===========================================================================
  // مرحله ۳: تکمیل onboarding (KYC)
  // ===========================================================================
  async completeOnboarding(userId: string, dto: CompleteOnboardingDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('کاربر یافت نشد');

    const existing = await this.prisma.customer.findUnique({
      where: { userId },
    });
    if (!existing) {
      throw new NotFoundException('پروفایل مشتری یافت نشد. لطفاً دوباره وارد شوید');
    }

    const data: Prisma.CustomerUpdateInput = {
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      storeName: dto.businessName.trim(),
      nationalCode: dto.nationalCode.trim(),
      landline: dto.landlinePhone?.trim() || null,
      province: dto.province.trim(),
      city: dto.city.trim(),
      address: dto.exactAddress.trim(),
      postalCode: dto.postalCode.trim(),
      latitude: dto.locationCoordinates?.lat,
      longitude: dto.locationCoordinates?.lng,
      businessType: dto.businessType.trim(),
      nationalCardImage: dto.nationalCardImage,
      businessLicenseImage: dto.businessLicenseImage,
      selfieWithIdCardImage: dto.selfieWithIdCardImage ?? null,
      storefrontImage: dto.storefrontImage,
      onboardingCompleted: true,
      status: 'PENDING',
    };

    const customer = await this.prisma.customer.update({
      where: { userId },
      data,
    });

    this.logger.log(`Onboarding completed for customer ${customer.id}`);

    this.eventEmitter.emit('kyc.submitted', { userId: customer.id });

    return {
      user: { id: user.id, phone: user.phone, role: user.role },
      customer: this.shapeCustomer(customer, user.phone),
    };
  }

  // ===========================================================================
  // Profile Management
  // ===========================================================================
  async updateProfile(
    userId: string,
    data: { firstName?: string; lastName?: string; landline?: string; address?: string }
  ) {
    return this.prisma.customer.update({
      where: { userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        landline: data.landline,
        address: data.address,
      },
    });
  }

  async requestSensitiveChange(userId: string, field: string, newValue: string) {
    const customer = await this.prisma.customer.findUnique({ where: { userId } });
    if (!customer) throw new NotFoundException('مشتری یافت نشد');

    const oldValue = customer[field as keyof CustomerRecord];

    return this.prisma.profileChangeRequest.create({
      data: {
        customerId: customer.id,
        field,
        oldValue: oldValue ? String(oldValue) : null,
        newValue,
        status: 'PENDING',
      },
    });
  }

  async getMyPendingChanges(userId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { userId } });
    if (!customer) return [];
    return this.prisma.profileChangeRequest.findMany({
      where: { customerId: customer.id, status: 'PENDING' },
    });
  }

  // Admin Methods for Profile Changes
  async listProfileChanges(page = 1, pageSize = 20) {
    const [total, items] = await this.prisma.$transaction([
      this.prisma.profileChangeRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.profileChangeRequest.findMany({
        where: { status: 'PENDING' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { customer: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return { items, total, page, pageSize };
  }

  async approveChange(requestId: string, adminNotes?: string) {
    const request = await this.prisma.profileChangeRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('درخواست یافت نشد');

    // Double-layered security check
    const allowedFields = Object.values(SensitiveField) as string[];
    if (!allowedFields.includes(request.field)) {
      this.logger.error(
        `Security breach attempt: Unauthorized field '${request.field}' in change request ${requestId}`
      );
      await this.prisma.profileChangeRequest.update({
        where: { id: requestId },
        data: { status: 'REJECTED', adminNotes: 'فیلد غیرمجاز' },
      });
      throw new BadRequestException('این درخواست شامل فیلد غیرمجاز است.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Atomic status update inside transaction to prevent TOCTOU race condition
      const updateResult = await tx.profileChangeRequest.updateMany({
        where: { id: requestId, status: 'PENDING' },
        data: { status: 'APPROVED', adminNotes: adminNotes ?? null },
      });

      if (updateResult.count === 0) {
        throw new BadRequestException('این درخواست قبلاً تعیین تکلیف شده است.');
      }

      // 2. Update Customer record
      await tx.customer.update({
        where: { id: request.customerId },
        data: { [request.field]: request.newValue },
      });

      // 3. Reject all other pending requests for the same field of this customer
      await tx.profileChangeRequest.updateMany({
        where: {
          customerId: request.customerId,
          field: request.field,
          status: 'PENDING',
          id: { not: requestId },
        },
        data: {
          status: 'REJECTED',
          adminNotes: 'به‌دلیل تایید درخواست جدیدتر رد شد.',
        },
      });

      return { ok: true };
    });
  }

  async rejectChange(requestId: string, adminNotes?: string) {
    const updateResult = await this.prisma.profileChangeRequest.updateMany({
      where: { id: requestId, status: 'PENDING' },
      data: { status: 'REJECTED', adminNotes: adminNotes ?? null },
    });

    if (updateResult.count === 0) {
      throw new BadRequestException('این درخواست قبلاً تعیین تکلیف شده است.');
    }

    return { ok: true };
  }

  // ===========================================================================
  // /auth/me
  // ===========================================================================
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { customer: true },
    });
    if (!user) throw new UnauthorizedException();

    let unreadNotificationCount = 0;
    if (user.customer) {
      unreadNotificationCount = await this.notificationsService.getUnreadCount(
        user.id,
        user.customer.id,
        user.customer.status
      );
    }

    return {
      id: user.id,
      phone: user.phone,
      role: user.role,
      unreadNotificationCount,
      customer: user.customer ? this.shapeCustomer(user.customer, user.phone) : null,
    };
  }

  async getKycStatus(userId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      select: { status: true, notes: true, updatedAt: true },
    });
    if (!customer) throw new NotFoundException('مشتری یافت نشد');
    return customer;
  }

  // ===========================================================================
  // helpers
  // ===========================================================================
  private shapeCustomer(c: CustomerRecord, phone: string): CustomerShape {
    return {
      id: c.id,
      userId: c.userId,
      phone,
      firstName: c.firstName ?? null,
      lastName: c.lastName ?? null,
      storeName: c.storeName ?? null,
      nationalCode: c.nationalCode ?? null,
      landline: c.landline ?? null,
      province: c.province ?? null,
      city: c.city ?? null,
      address: c.address ?? null,
      postalCode: c.postalCode ?? null,
      latitude: c.latitude ?? null,
      longitude: c.longitude ?? null,
      businessType: c.businessType ?? null,
      nationalCardImage: c.nationalCardImage ?? null,
      businessLicenseImage: c.businessLicenseImage ?? null,
      selfieWithIdCardImage: c.selfieWithIdCardImage ?? null,
      storefrontImage: c.storefrontImage ?? null,
      onboardingCompleted: c.onboardingCompleted,
      status: c.status,
      notes: c.notes ?? null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  private async logAttempt(
    phone: string,
    code: string | null,
    success: boolean,
    customerId: string | null,
    meta?: { ip?: string; userAgent?: string }
  ) {
    try {
      await this.prisma.otpAttempt.create({
        data: {
          phone,
          code: null, // برای امنیت، کد اصلی ذخیره نمی‌شود
          action: 'VERIFY',
          success,
          customerId,
          ip: meta?.ip,
          userAgent: meta?.userAgent,
        },
      });
    } catch (e) {
      this.logger.error('Failed to write OTP attempt log', e as Error);
    }
  }

  private maskPhone(p: string): string {
    return p.replace(/(\d{4})\d{3}(\d{4})/, '$1***$2');
  }
}
