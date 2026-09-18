import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * قرارداد اعتبارسنجی برای POST /app/log-error
 *
 * این اندپوینت توسط ErrorBoundary اپلیکیشن موبایل فراخوانی می‌شود
 * (wholesale-mobile/src/components/ui/ErrorBoundary.tsx) و خطاهای رندر را
 * گزارش می‌کند — از جمله خطاهایی که *پیش از ورود کاربر* رخ می‌دهند.
 * به همین دلیل عمداً بدون احراز هویت باقی مانده است؛ افزودن گارد،
 * گزارش خطای مشروع را می‌شکند (→ SECURITY DECISION REQUIRED).
 *
 * هدف این DTO فقط کوچک‌ترین قرارداد ممکن است:
 *   - اعتبارسنجی نوع
 *   - سقف طول معقول (جلوگیری از رشد بی‌رویهٔ جدول error_logs)
 * هیچ قلمی به‌صدا رد نمی‌شود؛ سقف stack عمداً سخاوتمندانه است تا
 * اطلاعات تشخیصی مشروع از دست نرود.
 */
export class LogErrorDto {
  // در کنترلر با `body.message || 'Unknown Error'` پشتیبان‌گیری می‌شود،
  // بنابراین اختیاری بودنِ آن رفتار فعلی را حفظ می‌کند.
  @IsString()
  @IsOptional()
  @MaxLength(500)
  message?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10000)
  stack?: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  deviceInfo?: string;

  // این مقدار در پنل ادمین نمایش داده می‌شود؛ محدودیت طول،
  // لایهٔ دفاعی دوم است (لایهٔ اصلی، encoding در نقطهٔ خروجی است).
  @IsString()
  @IsOptional()
  @MaxLength(100)
  userId?: string;
}
