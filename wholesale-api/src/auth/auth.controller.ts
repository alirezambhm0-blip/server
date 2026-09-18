import { Controller, Post, Body, Get, Patch, UseGuards, Req, Res, Ip, Headers } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SensitiveChangeDto } from './dto/sensitive-change.dto';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Request } from 'express';
import type { Response } from 'express';

type AuthedRequest = Request & {
  user: {
    userId: string;
    phone?: string;
    role?: string;
  };
};

// S1 — حد و پنجرهٔ زمانی مخصوص دو endpoint احراز هویت، از env خوانده می‌شود.
// به‌صورت تابع برگردانده می‌شود تا در زمان هر درخواست ارزیابی شود
// (مقدار decorator هنگام تعریف کلاس خوانده می‌شود، نه در زمان اجرا).
// پیش‌فرض‌ها عمداً ملایم‌اند تا در development باعث lockout نشوند؛
// مقادیر سخت‌گیرانهٔ production در .env.example مستند شده‌اند.
const otpEnv = (key: string, fallback: number) => () => {
  const v = Number(process.env[key]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** مرحله ۱ ورود: ارسال کد تایید پیامکی (OTP) برای شماره موبایل */
  @Post('request-otp')
  @Throttle({ default: { limit: otpEnv('OTP_REQUEST_LIMIT', 20), ttl: otpEnv('OTP_REQUEST_TTL_MS', 900000) } })
  async requestOtp(@Body() dto: RequestOtpDto, @Ip() ip: string, @Headers('user-agent') userAgent?: string) {
    return this.authService.requestOtp(dto, { ip, userAgent });
  }

  /** مرحله ۲ ورود: بررسی OTP و صدور JWT — توکن هم در بدنه پاسخ برمی‌گردد و هم در کوکی HttpOnly (پنل ادمین) ست می‌شود */
  @Post('verify-otp')
  @Throttle({ default: { limit: otpEnv('OTP_VERIFY_LIMIT', 50), ttl: otpEnv('OTP_VERIFY_TTL_MS', 900000) } })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string
  ) {
    const result = await this.authService.verifyOtp(dto, { ip, userAgent });

    // Set HttpOnly cookie for enhanced security (XSS protection)
    // This is in addition to returning the token in the response body for backwards compatibility
    if (result.accessToken) {
      const isProd = process.env.NODE_ENV === 'production';
      res.cookie('admin_token_v3', result.accessToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
        path: '/',
      });
    }

    return result;
  }

  /** تکمیل اطلاعات اولیه مشتری (فروشگاه و...) بعد از اولین ورود — نیازمند JWT */
  @UseGuards(JwtAuthGuard)
  @Post('onboarding')
  async completeOnboarding(@Req() req: AuthedRequest, @Body() dto: CompleteOnboardingDto) {
    return this.authService.completeOnboarding(req.user.userId, dto);
  }

  /** دریافت پروفایل کاربر جاری (از روی JWT) */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Req() req: AuthedRequest) {
    return this.authService.getMe(req.user.userId);
  }

  /** وضعیت احراز هویت/تایید حساب (KYC) کاربر جاری */
  @UseGuards(JwtAuthGuard)
  @Get('kyc-status')
  async getKycStatus(@Req() req: AuthedRequest) {
    return this.authService.getKycStatus(req.user.userId);
  }

  /** ویرایش فیلدهای غیرحساس پروفایل — فیلدهای حساس فقط از مسیر profile/sensitive-change و با تایید ادمین */
  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(@Req() req: AuthedRequest, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(req.user.userId, dto);
  }

  /** درخواست تغییر فیلد حساس (مثل شماره موبایل) — طبق قانون پروژه فقط با تایید ادمین اعمال می‌شود */
  @UseGuards(JwtAuthGuard)
  @Post('profile/sensitive-change')
  async requestSensitiveChange(@Req() req: AuthedRequest, @Body() dto: SensitiveChangeDto) {
    return this.authService.requestSensitiveChange(req.user.userId, dto.field, dto.newValue);
  }

  /** لیست درخواست‌های تغییر حساسِ در انتظار تایید ادمینِ کاربر جاری */
  @UseGuards(JwtAuthGuard)
  @Get('profile/pending-changes')
  async getMyPendingChanges(@Req() req: AuthedRequest) {
    return this.authService.getMyPendingChanges(req.user.userId);
  }

  /** خروج — پاک کردن کوکی HttpOnly پنل ادمین */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    // Clear HttpOnly cookie
    res.clearCookie('admin_token_v3', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return { message: 'با موفقیت خارج شدید' };
  }
}
