import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsNotEmpty({ message: 'شماره موبایل الزامی است' })
  @IsString()
  // شماره می‌تواند با 0، یا 98، یا بدون صفر آمده باشد؛ سرویس normalizePhone اصلاح می‌کند.
  // منطق: ارقام فقط، بین 10 تا 12 رقم (مثلاً 0912xxxxxxx=11 یا 98912xxxxxxx=12 یا 912xxxxxxx=10)
  @Matches(/^[0-9]{10,12}$/, {
    message: 'شماره موبایل نامعتبر است',
  })
  phone!: string;

  @IsNotEmpty({ message: 'کد تایید الزامی است' })
  @IsString()
  @Length(6, 6, { message: 'کد تایید باید ۶ رقم باشد' })
  @Matches(/^[0-9]{6}$/, { message: 'کد تایید باید فقط شامل ارقام باشد' })
  code!: string;
}
