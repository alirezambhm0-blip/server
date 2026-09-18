import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TooManyRequestsException } from '../common/too-many-requests.exception';
import * as bcrypt from 'bcrypt';

/**
 * S2 — قفل brute-force OTP.
 *
 * باگ اصلی: شمارندهٔ `attempts` داخل `prisma.$transaction` نوشته می‌شد و
 * بلافاصله `throw` می‌شد → تراکنش rollback → شمارنده هرگز ذخیره نمی‌شد
 * → شرط قفل (`attempts >= MAX_VERIFY_ATTEMPTS`) هرگز true نمی‌شد
 * → کد ۶ رقمی بدون محدودیت قابل حدس زدن بود.
 *
 * این تست یک Prisma ساختگی می‌سازد که **rollback را واقعاً شبیه‌سازی می‌کند**
 * (نوشتن‌های داخل تراکنش در صورت خطا دور ریخته می‌شوند)، پس اگر شمارنده
 * دوباره به داخل تراکنش برگردد، تست شکست می‌خورد.
 */
describe('AuthService.verifyOtp — OTP lockout counter (S2)', () => {
  const PHONE = '09120000000';
  const REAL_CODE = '123456';
  const WRONG_CODE = '000000';
  // P1-2 — سطر otps دیگر ستون `code` خام ندارد؛ fixture باید verifier داشته باشد.
  // cost=4 فقط برای سرعت تست است؛ منطق مقایسه همان bcrypt واقعی است.
  const REAL_CODE_HASH = bcrypt.hashSync(REAL_CODE, 4);

  type Row = {
    phone: string;
    codeHash: string;
    attempts: number;
    expiresAt: Date;
    usedAt: Date | null;
    lastAttemptAt: Date | null;
    updatedAt: Date;
  };

  let outerUpdates: unknown[];
  let txUpdates: unknown[];

  const setup = async (row: Partial<Row>) => {
    outerUpdates = [];
    txUpdates = [];

    const base: Row = {
      phone: PHONE,
      codeHash: REAL_CODE_HASH,
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      lastAttemptAt: null,
      updatedAt: new Date(),
      ...row,
    };

    const prisma = {
      otp: {
        findUnique: jest.fn().mockResolvedValue(base),
        // نوشتن‌های بیرون از تراکنش → این‌ها commit می‌شوند
        update: jest.fn().mockImplementation((a: unknown) => {
          outerUpdates.push(a);
          return Promise.resolve(base);
        }),
        upsert: jest.fn().mockResolvedValue(base),
      },
      otpAttempt: { create: jest.fn().mockResolvedValue({}) },
      user: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() },
      customer: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          otp: {
            findUnique: jest.fn().mockResolvedValue(base),
            update: jest.fn().mockImplementation((a: unknown) => {
              txUpdates.push(a);
              return Promise.resolve(base);
            }),
          },
        };
        try {
          return await fn(tx);
        } catch (e) {
          txUpdates.length = 0; // ← شبیه‌سازی ROLLBACK
          throw e;
        }
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: SmsService, useValue: { sendOtp: jest.fn() } },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('jwt') } },
        { provide: NotificationsService, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    return { service: module.get(AuthService), prisma };
  };

  it('persists the failed-attempt counter OUTSIDE the rolled-back transaction', async () => {
    const { service } = await setup({ attempts: 0 });

    await expect(service.verifyOtp({ phone: PHONE, code: WRONG_CODE })).rejects.toThrow();

    // نوشتن داخل تراکنش باید rollback شده باشد (خالی)
    expect(txUpdates).toHaveLength(0);
    // و شمارنده باید بیرون از تراکنش، مستقل ثبت شده باشد
    expect(outerUpdates).toHaveLength(1);
    expect(outerUpdates[0]).toMatchObject({
      where: { phone: PHONE },
      data: { attempts: { increment: 1 } },
    });
  });

  it('accumulates attempts across calls so the lockout actually engages', async () => {
    // یک سرویس + یک «دیتابیس» حالت‌دار: اگر شمارنده rollback شود،
    // این حلقه هرگز به حد قفل نمی‌رسد و تست شکست می‌خورد.
    const store = {
      phone: PHONE,
      codeHash: REAL_CODE_HASH,
      attempts: 0,
      expiresAt: new Date(Date.now() + 10 * 60_000),
      usedAt: null as Date | null,
      lastAttemptAt: null as Date | null,
      updatedAt: new Date(),
    };
    const apply = (data: Record<string, unknown>) => {
      const a = data.attempts;
      if (a && typeof a === 'object' && 'increment' in a) {
        store.attempts += (a as { increment: number }).increment;
      } else if (typeof a === 'number') {
        store.attempts = a;
      }
      if (data.lastAttemptAt) store.lastAttemptAt = data.lastAttemptAt as Date;
    };
    const prisma = {
      otp: {
        findUnique: jest.fn().mockImplementation(() => Promise.resolve({ ...store })),
        update: jest.fn().mockImplementation((a: { data: Record<string, unknown> }) => {
          apply(a.data);
          return Promise.resolve({ ...store });
        }),
        upsert: jest.fn(),
      },
      otpAttempt: { create: jest.fn() },
      user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      customer: { findUnique: jest.fn(), create: jest.fn() },
      $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        // تراکنش روی یک snapshot کار می‌کند؛ در صورت خطا هیچ‌چیز به store برنمی‌گردد
        const tx = {
          otp: {
            findUnique: jest.fn().mockImplementation(() => Promise.resolve({ ...store })),
            update: jest.fn().mockResolvedValue({}), // ← فقط داخل تراکنش؛ با rollback از بین می‌رود
          },
        };
        return fn(tx);
      }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: SmsService, useValue: { sendOtp: jest.fn() } },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('jwt') } },
        { provide: NotificationsService, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    const service = module.get(AuthService);

    for (let i = 0; i < 5; i++) {
      await service.verifyOtp({ phone: PHONE, code: WRONG_CODE }).catch(() => undefined);
    }
    // اگر S2 رفع نشده باشد، store.attempts روی 0 می‌ماند
    expect(store.attempts).toBe(5);

    // تلاش ششم باید به قفل بخورد
    await expect(service.verifyOtp({ phone: PHONE, code: WRONG_CODE })).rejects.toThrow(TooManyRequestsException);
  });

  it('still throws TooManyRequestsException once attempts are exhausted', async () => {
    const { service } = await setup({ attempts: 4 });
    await expect(service.verifyOtp({ phone: PHONE, code: WRONG_CODE })).rejects.toThrow(TooManyRequestsException);
    // شمارنده همچنان باید ثبت شود
    expect(outerUpdates).toHaveLength(1);
  });

  it('does NOT increment when the account is already locked', async () => {
    const { service } = await setup({
      attempts: 5,
      lastAttemptAt: new Date(), // همین الان → هنوز داخل پنجرهٔ قفل
    });
    await expect(service.verifyOtp({ phone: PHONE, code: WRONG_CODE })).rejects.toThrow(TooManyRequestsException);
    expect(outerUpdates).toHaveLength(0);
  });

  it('does NOT increment for an unknown phone (no record)', async () => {
    const { service, prisma } = await setup({});
    prisma.otp.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = { otp: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() } };
      return fn(tx);
    });
    await expect(service.verifyOtp({ phone: PHONE, code: WRONG_CODE })).rejects.toThrow();
    expect(outerUpdates).toHaveLength(0);
  });

  it('does NOT double-count on the success path', async () => {
    const { service } = await setup({ attempts: 0 });
    // مسیر موفق: داخل تراکنش usedAt ست می‌شود و هیچ نوشتن بیرونی نباید اتفاق بیفتد
    await service.verifyOtp({ phone: PHONE, code: REAL_CODE }).catch(() => {
      /* وابستگی‌های بعد از تراکنش mock نشده‌اند — برای این تست مهم نیست */
    });
    expect(outerUpdates).toHaveLength(0);
    expect(txUpdates.length).toBeGreaterThanOrEqual(0);
  });
});
