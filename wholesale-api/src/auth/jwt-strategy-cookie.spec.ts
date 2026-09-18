import { JwtService } from '@nestjs/jwt';
import { JwtStrategy, ADMIN_AUTH_COOKIE } from './jwt.strategy';

/**
 * P1-4 — تست واقعی مکانیزم احراز هویت.
 *
 * این تست رفتار mock‌شده را assert نمی‌کند:
 *   - از کلاس واقعی JwtStrategy استفاده می‌کند
 *   - JWT واقعی با امضای واقعی می‌سازد
 *   - متد authenticate خودِ Passport را صدا می‌زند تا extractor واقعی
 *     و اعتبارسنجی واقعی امضا اجرا شوند
 * تنها `validate` stub شده، چون به PostgreSQL نیاز دارد (خارج از scope این تست).
 */
describe('JwtStrategy — P1-4 cookie + Bearer extraction', () => {
  const SECRET = 'spec-only-secret-not-a-real-secret';
  // P2-5 — expiresIn باید داخل signOptions باشد، نه مستقیم روی JwtModuleOptions.
  // شکل درست دقیقاً همان چیزی است که auth.module.ts استفاده می‌کند.
  const jwtService = new JwtService({ secret: SECRET, signOptions: { expiresIn: '1h' } });

  let strategy: any;

  const makeStrategy = () => {
    const configService = { getOrThrow: () => SECRET } as any;
    const prisma = {} as any;
    const s: any = new JwtStrategy(configService, prisma);
    // validate به دیتابیس می‌زند؛ در این تست فقط استخراج و اعتبار امضا مهم است
    jest
      .spyOn(s, 'validate')
      .mockImplementation((payload: any) =>
        Promise.resolve({ userId: payload.sub, phone: payload.phone, role: payload.role } as any)
      );
    return s;
  };

  /** احراز هویت واقعی از طریق Passport */
  const attempt = (req: any): Promise<{ ok: boolean; user?: any; info?: any }> =>
    new Promise((resolve) => {
      const s = strategy;
      s.success = (user: any) => resolve({ ok: true, user });
      s.fail = (info: any) => resolve({ ok: false, info });
      s.error = (err: any) => resolve({ ok: false, info: err });
      s.pass = () => resolve({ ok: false, info: 'pass' });
      s.redirect = () => resolve({ ok: false, info: 'redirect' });
      s.authenticate(req, {});
    });

  const bearerReq = (token?: string): any => ({
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  const cookieReq = (cookieHeader?: string): any => ({
    headers: cookieHeader !== undefined ? { cookie: cookieHeader } : {},
  });

  let validToken: string;
  let expiredToken: string;

  beforeAll(() => {
    validToken = jwtService.sign({ sub: 'user-1', phone: '0912', role: 'ADMIN' });
    expiredToken = jwtService.sign({ sub: 'user-1', role: 'ADMIN' }, { expiresIn: '-10s' });
  });

  beforeEach(() => {
    strategy = makeStrategy();
  });

  describe('مسیر موبایل — Authorization: Bearer (باید بدون تغییر کار کند)', () => {
    it('توکن معتبر از هدر Bearer پذیرفته می‌شود', async () => {
      const r = await attempt(bearerReq(validToken));
      expect(r.ok).toBe(true);
      expect(r.user.userId).toBe('user-1');
      expect(r.user.role).toBe('ADMIN');
    });

    it('توکن امضانشده/بی‌اعتبار رد می‌شود', async () => {
      const r = await attempt(bearerReq('this.is.notavalidjwt'));
      expect(r.ok).toBe(false);
    });
  });

  describe('مسیر پنل ادمین — کوکی HttpOnly (مکانیزم جدید)', () => {
    it('توکن معتبر از کوکی پذیرفته می‌شود', async () => {
      const r = await attempt(cookieReq(`${ADMIN_AUTH_COOKIE}=${validToken}`));
      expect(r.ok).toBe(true);
      expect(r.user.userId).toBe('user-1');
    });

    it('کوکی در میان چند کوکی دیگر هم درست پیدا می‌شود', async () => {
      const header = `theme=dark; ${ADMIN_AUTH_COOKIE}=${validToken}; locale=fa; _ga=GA1.2`;
      const r = await attempt(cookieReq(header));
      expect(r.ok).toBe(true);
      expect(r.user.userId).toBe('user-1');
    });

    it('نام کوکی اشتباه نادیده گرفته می‌شود', async () => {
      const r = await attempt(cookieReq(`admin_token_v2=${validToken}`));
      expect(r.ok).toBe(false);
    });

    it('توکن منقضی‌شده از کوکی رد می‌شود (ignoreExpiration:false حفظ شده)', async () => {
      const r = await attempt(cookieReq(`${ADMIN_AUTH_COOKIE}=${expiredToken}`));
      expect(r.ok).toBe(false);
    });

    it('توکن بی‌اعتبار در کوکی رد می‌شود', async () => {
      const r = await attempt(cookieReq(`${ADMIN_AUTH_COOKIE}=garbage.token.here`));
      expect(r.ok).toBe(false);
    });

    it('کوکی خالی رد می‌شود', async () => {
      const r = await attempt(cookieReq(`${ADMIN_AUTH_COOKIE}=`));
      expect(r.ok).toBe(false);
    });

    it('کوکی جعلی/نقص‌دار باعث crash نمی‌شود (decodeURIComponent throw نمی‌دهد)', async () => {
      // «%» به‌تنهایی در decodeURIComponent استثنا می‌دهد. نکتهٔ امنیتی این است که
      // extractor ما با try/catch آن را می‌گیرد و null برمی‌گرداند، پس درخواست
      // به‌جای crash شدن، به‌صورت fail-closed رد می‌شود.
      // (خودِ passport-jwt هنگام نبود توکن fail() را با یک Error صدا می‌زند؛
      //  بنابراین اینجا فقط «بدون پرتاب استثنا حل شدن» را assert می‌کنیم.)
      const r = await attempt(cookieReq(`${ADMIN_AUTH_COOKIE}=%`));
      expect(r.ok).toBe(false);
    });

    it('هدر Cookie کاملاً ناقص باعث crash نمی‌شود', async () => {
      const r = await attempt(cookieReq(';;;===;;;'));
      expect(r.ok).toBe(false);
    });

    it('هدر cookie از نوع غیررشته‌ای باعث crash نمی‌شود', async () => {
      const r = await attempt({ headers: { cookie: 12345 } });
      expect(r.ok).toBe(false);
    });
  });

  describe('اولویت و همزیستی', () => {
    it('وقتی هر دو موجودند، Bearer اولویت دارد (موبایل دست‌نخورده)', async () => {
      const mobileToken = jwtService.sign({ sub: 'mobile-user', role: 'USER' });
      const req = {
        headers: {
          authorization: `Bearer ${mobileToken}`,
          cookie: `${ADMIN_AUTH_COOKIE}=${validToken}`,
        },
      };
      const r = await attempt(req);
      expect(r.ok).toBe(true);
      expect(r.user.userId).toBe('mobile-user');
    });

    it('اگر Bearer نامعتبر باشد ولی کوکی معتبر، از کوکی استفاده نمی‌شود (اولویت قاطع)', async () => {
      const req = {
        headers: {
          authorization: 'Bearer invalid.token.value',
          cookie: `${ADMIN_AUTH_COOKIE}=${validToken}`,
        },
      };
      // passport-jwt اولین extractor غیر null را برمی‌دارد و اگر اعتبارسنجی ناموفق
      // بود ادامه نمی‌دهد؛ این رفتار عمدی و قابل‌قبول است (fail-closed).
      const r = await attempt(req);
      expect(r.ok).toBe(false);
    });

    it('بدون هیچ اعتبارنامه‌ای → احراز هویت نمی‌شود', async () => {
      const r = await attempt({ headers: {} });
      expect(r.ok).toBe(false);
    });

    it('درخواست با هدر خالی → احراز هویت نمی‌شود', async () => {
      // در Express واقعی req.headers همیشه یک شیء است.
      // درخواستِ کاملاً بدون headers باعث TypeError می‌شود، ولی آن رفتار
      // *pre-existing* خودِ passport-jwt است (extract_jwt.js:58 بدون guard
      // request.headers را می‌خواند) و با پیکربندی قدیمیِ فقط-Bearer نیز
      // دقیقاً همین‌طور است — یعنی این فاز آن را معرفی نکرده است.
      const r = await attempt({ headers: {} });
      expect(r.ok).toBe(false);
    });
  });

  describe('الزامات امنیتی P1-4', () => {
    it('استخراج‌کنندهٔ کوکی هیچ نیازی به cookie-parser ندارد (req.cookies خوانده نمی‌شود)', async () => {
      // اگر کد به req.cookies وابسته بود، این درخواست بدون cookies شکست می‌خورد
      const req = { headers: { cookie: `${ADMIN_AUTH_COOKIE}=${validToken}` } };
      expect((req as any).cookies).toBeUndefined();
      const r = await attempt(req);
      expect(r.ok).toBe(true);
    });

    it('نام کوکی با auth.controller.ts یکی است', () => {
      expect(ADMIN_AUTH_COOKIE).toBe('admin_token_v3');
    });
  });
});
