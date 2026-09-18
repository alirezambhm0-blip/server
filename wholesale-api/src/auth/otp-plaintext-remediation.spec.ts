/**
 * ============================================================================
 * P1-2 — تست متمرکز حذف ذخیره‌سازی plaintext کد OTP
 * ============================================================================
 *
 * این فایل رفتار «واقعی» AuthService را اجرا می‌کند. تنها چیزی که جایگزین شده
 * PrismaService است (چون PostgreSQL در محیط تست در دسترس نیست)؛ رمزنگاری،
 * مقایسه، تراکنش، شمارندهٔ تلاش و قفل، همه کد واقعی هستند.
 *
 * نکته: برخلاف یک mock معمولی، اینجا خودِ bcrypt واقعی اجرا می‌شود و assertion
 * ها روی verifier واقعیِ تولیدشده انجام می‌شود — یعنی اگر کسی دوباره مقایسهٔ
 * plaintext را برگرداند، این تست‌ها می‌شکنند.
 * ============================================================================
 */
import * as bcrypt from 'bcrypt';
import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { AuthService, OTP_CONFIG } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { TooManyRequestsException } from '../common/too-many-requests.exception';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { NotificationsService } from '../notifications/notifications.service';

// ---------------------------------------------------------------------------
// تایپ‌ها
// ---------------------------------------------------------------------------
type OtpRow = {
  phone: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  lastAttemptAt: Date | null;
  usedAt: Date | null;
  resendCount: number;
  updatedAt: Date;
};

type UpsertArgs = {
  where: { phone: string };
  create: { phone: string; codeHash: string; expiresAt: Date; attempts: number; resendCount: number };
  update: {
    codeHash: string;
    expiresAt: Date;
    attempts: number;
    lastAttemptAt: null;
    usedAt: null;
    resendCount: { increment: number };
  };
};

type UpdateArgs = {
  where: { phone: string };
  data: {
    attempts?: number | { increment: number };
    lastAttemptAt?: Date | null;
    usedAt?: Date | null;
    codeHash?: string;
  };
};

type AttemptArgs = {
  data: {
    phone: string;
    code: string | null;
    action: string;
    success: boolean;
    customerId: string | null;
    ip?: string;
    userAgent?: string;
  };
};

type Calls = {
  otpUpsert: UpsertArgs[];
  otpUpdateInTx: UpdateArgs[];
  otpUpdateOutTx: UpdateArgs[];
  attemptCreate: AttemptArgs[];
  smsSent: Array<{ phone: string; code: string }>;
};

type VerifyOtpResult = { accessToken: string; user: { id: string; phone: string; role: string } };

const PHONE = '09121234567';

// ---------------------------------------------------------------------------
// ساخت سرویس واقعی با Prisma ساختگی
// ---------------------------------------------------------------------------
function makeCtx(overrides?: { otp?: OtpRow | null }) {
  const calls: Calls = {
    otpUpsert: [],
    otpUpdateInTx: [],
    otpUpdateOutTx: [],
    attemptCreate: [],
    smsSent: [],
  };

  let otpRow: OtpRow | null = overrides?.otp ?? null;

  const otpDelegate = (insideTx: boolean) => ({
    findUnique: () => Promise.resolve(otpRow),

    upsert: (args: UpsertArgs) => {
      calls.otpUpsert.push(args);
      const data = otpRow ? args.update : args.create;
      otpRow = {
        phone: args.where.phone,
        codeHash: data.codeHash,
        expiresAt: data.expiresAt,
        attempts: data.attempts,
        lastAttemptAt: 'lastAttemptAt' in data ? data.lastAttemptAt : (otpRow?.lastAttemptAt ?? null),
        usedAt: 'usedAt' in data ? data.usedAt : (otpRow?.usedAt ?? null),
        resendCount: typeof data.resendCount === 'object' ? (otpRow?.resendCount ?? 0) + 1 : data.resendCount,
        updatedAt: new Date(),
      };
      return Promise.resolve(otpRow);
    },

    update: (args: UpdateArgs) => {
      (insideTx ? calls.otpUpdateInTx : calls.otpUpdateOutTx).push(args);
      if (otpRow) {
        const a = args.data.attempts;
        if (a && typeof a === 'object') otpRow.attempts += 1;
        else if (typeof a === 'number') otpRow.attempts = a;
        if (args.data.usedAt !== undefined) otpRow.usedAt = args.data.usedAt;
        if (args.data.lastAttemptAt !== undefined) otpRow.lastAttemptAt = args.data.lastAttemptAt;
        if (args.data.codeHash !== undefined) otpRow.codeHash = args.data.codeHash;
      }
      return Promise.resolve(otpRow);
    },
  });

  const prisma = {
    otp: otpDelegate(false),
    otpAttempt: {
      create: (args: AttemptArgs) => {
        calls.attemptCreate.push(args);
        return Promise.resolve({ id: 'attempt-1', ...args.data });
      },
    },
    user: {
      findUnique: () => Promise.resolve({ id: 'u1', phone: PHONE, role: 'CUSTOMER', isActive: true }),
      create: (args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'u1', isActive: true, role: 'CUSTOMER', ...args.data }),
      update: (args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'u1', isActive: true, role: 'CUSTOMER', ...args.data }),
    },
    customer: {
      findUnique: () =>
        Promise.resolve({
          id: 'c1',
          userId: 'u1',
          status: 'PENDING',
          onboardingCompleted: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      create: (args: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: 'c1',
          userId: 'u1',
          status: 'PENDING',
          createdAt: new Date(),
          updatedAt: new Date(),
          ...args.data,
        }),
    },
    // Prisma در تراکنش یک PrismaClient-like می‌دهد؛ فقط `otp` موردنیاز ماست.
    $transaction: (fn: (tx: { otp: ReturnType<typeof otpDelegate> }) => Promise<unknown>) =>
      fn({ otp: otpDelegate(true) }),
  };

  const smsService = {
    sendOtp: (phone: string, code: string) => {
      calls.smsSent.push({ phone, code });
      return Promise.resolve({ ok: true });
    },
  };

  const jwtService = { signAsync: () => Promise.resolve('signed.jwt.token') };
  const notificationsService = { notify: () => Promise.resolve(undefined) };
  const eventEmitter = { emit: () => undefined };

  const service = new AuthService(
    prisma as unknown as PrismaService,
    smsService as unknown as SmsService,
    jwtService as unknown as JwtService,
    notificationsService as unknown as NotificationsService,
    eventEmitter as unknown as EventEmitter2
  );

  return { service, calls, getRow: () => otpRow };
}

function futureOtp(codeHash: string, extra?: Partial<OtpRow>): OtpRow {
  return {
    phone: PHONE,
    codeHash,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    attempts: 0,
    lastAttemptAt: null,
    usedAt: null,
    resendCount: 1,
    updatedAt: new Date(Date.now() - 5 * 60 * 1000),
    ...extra,
  };
}

const reqOtp = (): RequestOtpDto => ({ phone: PHONE });
const verOtp = (code: string): VerifyOtpDto => ({ phone: PHONE, code });

// ===========================================================================
describe('P1-2 — حذف ذخیره‌سازی plaintext کد OTP', () => {
  afterEach(() => {
    process.env.NODE_ENV = 'test';
  });

  // ---------------------------------------------------------------------
  describe('ذخیره‌سازی (requestOtp)', () => {
    it('کد را هش می‌کند و هرگز فیلد `code` را روی Otp نمی‌نویسد', async () => {
      process.env.NODE_ENV = 'development';
      const { service, calls } = makeCtx();

      const res = await service.requestOtp(reqOtp());

      expect(calls.otpUpsert).toHaveLength(1);
      expect(res.testCode).toMatch(/^\d{6}$/);

      const { create, update } = calls.otpUpsert[0];
      // هستهٔ P1-2: هیچ کلیدی به نام `code` نوشته نشده باشد
      expect(Object.keys(create)).not.toContain('code');
      expect(Object.keys(update)).not.toContain('code');
      expect(create.codeHash).toBeDefined();
      expect(update.codeHash).toBeDefined();
      expect(create.codeHash).toBe(update.codeHash);
    });

    it('مقدار ذخیره‌شده یک bcrypt verifier واقعی است، نه متن خام', async () => {
      process.env.NODE_ENV = 'development';
      const { service, getRow } = makeCtx();

      const res = await service.requestOtp(reqOtp());
      const stored = getRow()!.codeHash;

      expect(stored).toMatch(/^\$2[aby]\$10\$[./A-Za-z0-9]{53}$/);
      expect(stored).toHaveLength(60);
      expect(stored).not.toBe(res.testCode);
      expect(stored).not.toContain(res.testCode!);
    });

    it('verifier ذخیره‌شده با همان کدی که به کاربر برگردانده شده تطبیق می‌کند', async () => {
      process.env.NODE_ENV = 'development';
      const { service, getRow } = makeCtx();

      const res = await service.requestOtp(reqOtp());
      await expect(bcrypt.compare(res.testCode!, getRow()!.codeHash)).resolves.toBe(true);
      await expect(bcrypt.compare('000000', getRow()!.codeHash)).resolves.toBe(false);
    });

    it('هر کد salt تازه می‌گیرد؛ دو کد یکسان verifier یکسان ندارند', async () => {
      const a = await bcrypt.hash('123456', OTP_CONFIG.BCRYPT_ROUNDS);
      const b = await bcrypt.hash('123456', OTP_CONFIG.BCRYPT_ROUNDS);
      expect(a).not.toBe(b);
      await expect(bcrypt.compare('123456', a)).resolves.toBe(true);
      await expect(bcrypt.compare('123456', b)).resolves.toBe(true);
    });

    it('تولید کد دست‌نخورده مانده: ۶ رقم، در بازهٔ ۱۰۰۰۰۰ تا ۹۹۹۹۹۸', async () => {
      process.env.NODE_ENV = 'development';
      // هر تکرار با ctx تازه: وگرنه درخواست دوم به cooldown ارسال مجدد می‌خورد
      for (let i = 0; i < 5; i++) {
        const { service } = makeCtx();
        const res = await service.requestOtp(reqOtp());
        expect(res.testCode).toMatch(/^\d{6}$/);
        const n = Number(res.testCode);
        expect(n).toBeGreaterThanOrEqual(100000);
        expect(n).toBeLessThan(999999);
      }
    });

    it('SMS همچنان کد خام را دریافت می‌کند (تحویل پیامک حفظ شده)', async () => {
      process.env.NODE_ENV = 'production';
      const { service, calls } = makeCtx();

      await service.requestOtp(reqOtp());

      expect(calls.smsSent).toHaveLength(1);
      expect(calls.smsSent[0].code).toMatch(/^\d{6}$/);
      await expect(bcrypt.compare(calls.smsSent[0].code, calls.otpUpsert[0].create.codeHash)).resolves.toBe(true);
    });

    it('در production هیچ testCode برنمی‌گردد', async () => {
      process.env.NODE_ENV = 'production';
      const { service } = makeCtx();

      const res = await service.requestOtp(reqOtp());
      expect(res.testCode).toBeUndefined();
    });

    it('انقضا (expiresAt) با همان TTL دو دقیقه‌ای نوشته می‌شود', async () => {
      process.env.NODE_ENV = 'development';
      const { service, calls } = makeCtx();
      const before = Date.now();

      await service.requestOtp(reqOtp());

      const delta = calls.otpUpsert[0].create.expiresAt.getTime() - before;
      expect(delta).toBeGreaterThanOrEqual(OTP_CONFIG.CODE_TTL_MS - 5000);
      expect(delta).toBeLessThanOrEqual(OTP_CONFIG.CODE_TTL_MS + 5000);
    });
  });

  // ---------------------------------------------------------------------
  describe('تأیید (verifyOtp)', () => {
    it('کد صحیح → ورود موفق و accessToken', async () => {
      const hash = await bcrypt.hash('246810', 4);
      const { service, calls } = makeCtx({ otp: futureOtp(hash) });

      const res = (await service.verifyOtp(verOtp('246810'))) as VerifyOtpResult;

      expect(res.accessToken).toBe('signed.jwt.token');
      expect(res.user.phone).toBe(PHONE);
      // حالت consumed همچنان ثبت می‌شود
      expect(calls.otpUpdateInTx).toHaveLength(1);
      expect(calls.otpUpdateInTx[0].data.usedAt).toBeInstanceOf(Date);
    });

    it('کد غلط → همان پیام قبلی + افزایش شمارنده بیرون از تراکنش (S2 حفظ شده)', async () => {
      const hash = await bcrypt.hash('246810', 4);
      const { service, calls } = makeCtx({ otp: futureOtp(hash) });

      await expect(service.verifyOtp(verOtp('111111'))).rejects.toThrow(BadRequestException);
      await expect(service.verifyOtp(verOtp('111111'))).rejects.toThrow(/کد تایید اشتباه است/);

      // اصلاح S2: نوشتن شمارنده باید بیرون از تراکنشِ rollback‌شده باشد
      expect(calls.otpUpdateOutTx.length).toBeGreaterThanOrEqual(1);
      expect(calls.otpUpdateOutTx[0].data.attempts).toEqual({ increment: 1 });
      expect(calls.otpUpdateInTx).toHaveLength(0);
    });

    it('fail-closed: رکورد plaintext باقی‌مانده از پیش از migration → «کد اشتباه»، نه ۵۰۰', async () => {
      // سناریوی §۱۴/§۱۵: اگر migration روی دیتابیسی اجرا نشود که رکورد قدیمی دارد
      const { service } = makeCtx({ otp: futureOtp('123456') });

      let err: Error | null = null;
      try {
        await service.verifyOtp(verOtp('123456'));
      } catch (e) {
        err = e as Error;
      }
      // حتی با کد «صحیح» هم پذیرفته نمی‌شود (fail-closed) و ۵۰۰ هم نمی‌دهد
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err!.message).toMatch(/کد تایید اشتباه است/);
      expect(err!.constructor.name).toBe('BadRequestException');
    });

    it('fail-closed: verifier خراب/تهی → BadRequest، نه استثنای bcrypt', async () => {
      const { service } = makeCtx({ otp: futureOtp('') });
      await expect(service.verifyOtp(verOtp('123456'))).rejects.toThrow(BadRequestException);
    });

    it('کد منقضی همچنان رد می‌شود', async () => {
      const hash = await bcrypt.hash('246810', 4);
      const { service } = makeCtx({
        otp: futureOtp(hash, { expiresAt: new Date(Date.now() - 1000) }),
      });
      await expect(service.verifyOtp(verOtp('246810'))).rejects.toThrow(/منقضی شده است/);
    });

    it('کد استفاده‌شده (replay) همچنان رد می‌شود', async () => {
      const hash = await bcrypt.hash('246810', 4);
      const { service } = makeCtx({ otp: futureOtp(hash, { usedAt: new Date() }) });
      await expect(service.verifyOtp(verOtp('246810'))).rejects.toThrow(/قبلاً استفاده شده است/);
    });

    it('قفل پس از ۵ تلاش ناموفق همچنان فعال است', async () => {
      const hash = await bcrypt.hash('246810', 4);
      const { service } = makeCtx({
        otp: futureOtp(hash, {
          attempts: OTP_CONFIG.MAX_VERIFY_ATTEMPTS,
          lastAttemptAt: new Date(),
        }),
      });
      await expect(service.verifyOtp(verOtp('246810'))).rejects.toThrow(TooManyRequestsException);
    });

    it('تلاش پنجم ناموفق → پیام قفل شدن', async () => {
      const hash = await bcrypt.hash('246810', 4);
      const { service } = makeCtx({
        otp: futureOtp(hash, { attempts: OTP_CONFIG.MAX_VERIFY_ATTEMPTS - 1 }),
      });
      await expect(service.verifyOtp(verOtp('111111'))).rejects.toThrow(TooManyRequestsException);
    });

    it('بدون رکورد OTP → همان پیام قبلی', async () => {
      const { service } = makeCtx({ otp: null });
      await expect(service.verifyOtp(verOtp('123456'))).rejects.toThrow(/نامعتبر است یا برای شما ارسال نشده است/);
    });
  });

  // ---------------------------------------------------------------------
  describe('§۱۶ — لاگ و متادیتای ممیزی', () => {
    it('OtpAttempt.code همچنان null نوشته می‌شود و متادیتای مفید حفظ شده', async () => {
      const hash = await bcrypt.hash('246810', 4);
      const { service, calls } = makeCtx({ otp: futureOtp(hash) });

      await service.verifyOtp(verOtp('246810'), { ip: '1.2.3.4', userAgent: 'jest' });

      expect(calls.attemptCreate).toHaveLength(1);
      const d = calls.attemptCreate[0].data;
      expect(d.code).toBeNull();
      expect(d.phone).toBe(PHONE);
      expect(d.action).toBe('VERIFY');
      expect(d.success).toBe(true);
      expect(d.ip).toBe('1.2.3.4');
      expect(d.userAgent).toBe('jest');
    });
  });
});
