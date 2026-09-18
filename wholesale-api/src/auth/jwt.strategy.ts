import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestUser } from './get-user.decorator';

interface JwtPayload {
  sub: string;
  phone?: string;
  role?: string;
}

/**
 * نام کوکی HttpOnly پنل ادمین — باید دقیقاً با auth.controller.ts:57 و :116 یکی باشد.
 */
export const ADMIN_AUTH_COOKIE = 'admin_token_v3';

/**
 * P1-4 — استخراج توکن از کوکی HttpOnly برای پنل ادمین.
 *
 * چرا دستی پارس می‌کنیم و نه `req.cookies`:
 * در این پروژه `cookie-parser` نصب نیست (در package.json و main.ts وجود ندارد)
 * و `req.cookies` همیشه undefined است. افزودن یک وابستگی جدید برای خواندن
 * یک هدر، تغییر بزرگ‌تری است تا پارس مستقیم `req.headers.cookie`.
 *
 * ترتیب مهم است: این extractor *بعد از* Bearer در fromExtractors قرار می‌گیرد،
 * بنابراین احراز هویت موبایل (که از Authorization: Bearer استفاده می‌کند)
 * کاملاً بدون تغییر باقی می‌ماند.
 */
const fromAdminAuthCookie = (req: any): string | null => {
  const header: string | undefined = req?.headers?.cookie;
  if (!header || typeof header !== 'string') return null;

  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== ADMIN_AUTH_COOKIE) continue;
    const raw = part.slice(eq + 1).trim();
    if (!raw) return null;
    // res.cookie مقدار را URL-encode می‌کند. JWT فقط شامل [A-Za-z0-9._-] است
    // پس decode عملاً no-op است، ولی برای سازگاری با serialize درست نگه داشته می‌شود.
    // try/catch لازم است چون هدر Cookie توسط کلاینت قابل جعل است و
    // decodeURIComponent روی ورودی ناقص (مثل «%») استثنا می‌دهد.
    try {
      return decodeURIComponent(raw) || null;
    } catch {
      return null;
    }
  }
  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService
  ) {
    super({
      // P1-4 — هر دو مسیر پشتیبانی می‌شوند:
      //   ۱) Authorization: Bearer  → اپلیکیشن موبایل (بدون تغییر)
      //   ۲) کوکی HttpOnly          → پنل ادمین (بدون نیاز به توکن قابل‌خواندن در JS)
      // fromExtractors به‌ترتیب امتحان می‌کند و اولین مقدار غیر null را برمی‌دارد.
      jwtFromRequest: ExtractJwt.fromExtractors([ExtractJwt.fromAuthHeaderAsBearerToken(), fromAdminAuthCookie]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { customer: true },
    });

    if (!user) {
      throw new UnauthorizedException('کاربر احراز هویت نشده است');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('حساب کاربری شما مسدود شده است');
    }

    // S8 — قبلاً فقط User.isActive چک می‌شد و Customer.status نادیده گرفته می‌شد،
    // یعنی مشتری BLOCKED تا انقضای JWT دسترسی کامل داشت.
    // همان چکی است که auth.service.ts:101 هنگام ورود انجام می‌دهد.
    // کوئری اضافه نمی‌شود: customer از قبل include شده است.
    if (user.customer?.status === 'BLOCKED') {
      throw new UnauthorizedException('حساب شما مسدود شده است. با پشتیبانی تماس بگیرید');
    }

    return {
      userId: user.id,
      phone: user.phone,
      role: user.role,
      customer: user.customer,
    };
  }
}
