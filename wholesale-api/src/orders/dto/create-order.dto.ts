import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * B32 / P2-2 — ثبت سفارش از روی سبد خرید (`POST /orders`).
 *
 * چرا این DTO لازم بود؟
 *   کنترلر پیش از این بدنهٔ درخواست را با یک تایپ inline TypeScript می‌گرفت:
 *       @Body() body: { delivery_address: string; ... }
 *   تایپ TypeScript در زمان اجرا از بین می‌رود، بنابراین ValidationPipe سراسری
 *   هیچ متادیتایی برای اعتبارسنجی نداشت. یعنی `whitelist: true` و
 *   `forbidNonWhitelisted: true` روی این endpoint عملاً بی‌اثر بودند و هیچ
 *   ورودی‌ای بررسی نمی‌شد.
 *
 * قرارداد API عمداً بدون تغییر ماند:
 *   • نام فیلدها دقیقاً همان snake_case قبلی است (کلاینت موبایل در
 *     app/(tabs)/cart.tsx همین‌ها را می‌فرستد).
 *   • هیچ فیلدی که قبلاً اختیاری بود required نشده است.
 *   • `idempotency_key` همچنان اختیاری است تا کلاینت‌های قدیمی و B19 نشکنند.
 *   • هیچ قاعدهٔ کسب‌وکار تازه‌ای اضافه نشده است.
 */
export class CreateOrderDto {
  @IsString({ message: 'آدرس تحویل باید رشته باشد' })
  @MaxLength(1000, { message: 'آدرس تحویل بیش از حد طولانی است' })
  delivery_address!: string;

  @IsBoolean({ message: 'is_alternative_address باید boolean باشد' })
  is_alternative_address!: boolean;

  @IsOptional()
  @IsString({ message: 'یادداشت مشتری باید رشته باشد' })
  @MaxLength(2000, { message: 'یادداشت مشتری بیش از حد طولانی است' })
  customer_note?: string;

  /**
   * B19 — کلید یکتای سمت کلاینت؛ اختیاری تا کلاینت‌های قدیمی نشکنند.
   * (دقیقاً همان semantic قبلی — این DTO آن را تغییر نمی‌دهد.)
   */
  @IsOptional()
  @IsString({ message: 'idempotency_key باید رشته باشد' })
  @MaxLength(128, { message: 'idempotency_key بیش از حد طولانی است' })
  idempotency_key?: string;
}
