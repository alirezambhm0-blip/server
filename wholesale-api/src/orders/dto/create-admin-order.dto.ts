import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * B32 / P2-2 — ثبت سفارش توسط ادمین (`POST /orders/admin/create`).
 *
 * پیش از این بدنه با تایپ inline گرفته می‌شد و بنابراین ValidationPipe سراسری
 * روی آن هیچ اثری نداشت: نه بررسی نوع، نه سقف طول، و نه حذف کلیدهای ناشناخته.
 *
 * ⚠️ نکتهٔ حیاتی دربارهٔ سازگاری:
 *   پنل ادمین (public/admin/orders.js:456-460) بسته به حالت فرم، مجموعهٔ
 *   متفاوتی از کلیدها را می‌فرستد:
 *       existing → { items, note, customerId }
 *       guest    → { items, note, guestName, guestPhone }
 *       new      → { items, note, newCustomer }
 *   و `deliveryAddress` را **هرگز** نمی‌فرستد، با اینکه در تایپ inline قبلی
 *   حضور داشت. اگر این فیلد required می‌شد، پنل ادمین می‌شکست.
 *   ⇒ همهٔ فیلدها دقیقاً با همان optionality قبلی حفظ شدند.
 *
 * هیچ فیلد جدیدی اضافه نشد و هیچ قاعدهٔ کسب‌وکاری ابداع نشد.
 */

export class AdminOrderNewCustomerDto {
  @IsString({ message: 'نام باید رشته باشد' })
  @MaxLength(200, { message: 'نام بیش از حد طولانی است' })
  firstName!: string;

  // شماره موبایل ایرانی؛ همان الگویی که در بقیهٔ پروژه استفاده می‌شود.
  @Matches(/^09\d{9}$/, { message: 'شماره موبایل نامعتبر است' })
  phone!: string;

  @IsString({ message: 'نام فروشگاه باید رشته باشد' })
  @MaxLength(200, { message: 'نام فروشگاه بیش از حد طولانی است' })
  storeName!: string;

  @IsString({ message: 'نام خانوادگی باید رشته باشد' })
  @MaxLength(200, { message: 'نام خانوادگی بیش از حد طولانی است' })
  lastName!: string;
}

export class AdminOrderItemDto {
  @IsString({ message: 'شناسهٔ محصول باید رشته باشد' })
  @MaxLength(64, { message: 'شناسهٔ محصول بیش از حد طولانی است' })
  productId!: string;

  @IsInt({ message: 'تعداد باید عدد صحیح باشد' })
  @Min(1, { message: 'تعداد باید حداقل ۱ باشد' })
  quantity!: number;
}

export class CreateAdminOrderDto {
  @IsOptional()
  @IsString({ message: 'شناسهٔ مشتری باید رشته باشد' })
  @MaxLength(64, { message: 'شناسهٔ مشتری بیش از حد طولانی است' })
  customerId?: string;

  @IsOptional()
  @IsString({ message: 'نام مشتری متفرقه باید رشته باشد' })
  @MaxLength(200, { message: 'نام مشتری متفرقه بیش از حد طولانی است' })
  guestName?: string;

  @IsOptional()
  @IsString({ message: 'شماره مشتری متفرقه باید رشته باشد' })
  @MaxLength(32, { message: 'شماره مشتری متفرقه بیش از حد طولانی است' })
  guestPhone?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AdminOrderNewCustomerDto)
  newCustomer?: AdminOrderNewCustomerDto;

  @IsArray({ message: 'لیست اقلام باید آرایه باشد' })
  @ArrayMinSize(1, { message: 'حداقل یک قلم کالا لازم است' })
  @ValidateNested({ each: true })
  @Type(() => AdminOrderItemDto)
  items!: AdminOrderItemDto[];

  @IsOptional()
  @IsString({ message: 'یادداشت باید رشته باشد' })
  @MaxLength(2000, { message: 'یادداشت بیش از حد طولانی است' })
  note?: string;

  /**
   * در تایپ inline قبلی هم اختیاری بود و پنل ادمین آن را نمی‌فرستد.
   * عمداً اختیاری باقی ماند تا قرارداد موجود نشکند.
   */
  @IsOptional()
  @IsString({ message: 'آدرس تحویل باید رشته باشد' })
  @MaxLength(1000, { message: 'آدرس تحویل بیش از حد طولانی است' })
  deliveryAddress?: string;
}
