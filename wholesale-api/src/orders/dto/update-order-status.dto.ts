import { IsEnum, IsOptional } from 'class-validator';
import { OrderStatus, PaymentStatus } from '@prisma/client';

/**
 * B32 / P2-2 — تغییر وضعیت سفارش (`PATCH /orders/:id/status`).
 *
 * پیش از این بدنه با تایپ inline گرفته می‌شد:
 *     @Body() body: { status?: OrderStatus; paymentStatus?: PaymentStatus }
 * یعنی هیچ اعتبارسنجی زمان‌اجرایی وجود نداشت و هر مقدار دلخواهی (مثلاً
 * `status: "هرچیزی"`) بدون بررسی به سرویس می‌رسید.
 *
 * قرارداد API بدون تغییر ماند:
 *   • هر دو فیلد همچنان اختیاری هستند (ادمین گاهی فقط `status` و گاهی فقط
 *     `paymentStatus` می‌فرستد — public/admin/orders.js:141 و :173).
 *   • مقادیر مجاز از همان enum های Prisma گرفته شده‌اند، نه از یک فهرست ابداعی.
 *
 * نکته: این endpoint در عمل توسط پنل ادمین صدا زده نمی‌شود (پنل به
 * `/admin/orders/:id/status` در admin.controller.ts می‌زند)، ولی چون بخشی از
 * قرارداد عمومی API است، اعتبارسنجی آن بدون تغییر قرارداد اضافه شد.
 */
export class UpdateOrderStatusDto {
  @IsOptional()
  @IsEnum(OrderStatus, { message: 'وضعیت سفارش نامعتبر است' })
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(PaymentStatus, { message: 'وضعیت پرداخت نامعتبر است' })
  paymentStatus?: PaymentStatus;
}
