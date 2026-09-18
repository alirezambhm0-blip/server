import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class RequestOtpDto {
  @IsNotEmpty({ message: 'شماره موبایل الزامی است' })
  @IsString()
  // شماره می‌تواند به یکی از فرم‌های زیر باشد:
  // 09xxxxxxxxx (11 رقم)، 9xxxxxxxxx (10 رقم)، 989xxxxxxxxx (12 رقم)
  // normalizePhone در سرویس همه را به 09xxxxxxxxx تبدیل می‌کند.
  @Matches(/^[0-9]{10,12}$/, {
    message: 'شماره موبایل نامعتبر است',
  })
  phone!: string;
}
