// import {
//   IsNotEmpty,
//   IsNumber,
//   IsOptional,
//   IsString,
//   Length,
//   Matches,
//   Validate,
//   ValidationArguments,
//   ValidatorConstraint,
//   ValidatorConstraintInterface,
//   ValidateNested,
// } from 'class-validator';
// import { Type } from 'class-transformer';

// /**
//  * اطمینان حاصل می‌کنیم که فیلدهای تصویر KYC به‌صورت filename از سرور آمده‌اند
//  * و حاوی data-URI/Base64 قدیمی نیستند.
//  * فرمت فایل‌های تولیدشده توسط FilesService: <docType>_<ts>_<rand>.<ext>
//  */
// @ValidatorConstraint({ name: 'kycFilename', async: false })
// class KycFilenameConstraint implements ValidatorConstraintInterface {
//   validate(value: string, _args: ValidationArguments) {
//     if (typeof value !== 'string') return false;
//     if (value.startsWith('data:')) return false; // رد کردن data URI
//     // فایل‌نیم باید بدون path separator و طول معقول باشد
//     if (value.length > 200) return false;
//     if (/[\\/\x00]/.test(value)) return false;
//     return true;
//   }
//   defaultMessage(args: ValidationArguments) {
//     return `${args.property} باید نام فایل معتبر باشد (data URI قبول نمی‌شود)`;
//   }
// }

// /**
//  * مختصات GPS — placeholder برای بهینه‌سازی مسیر تحویل.
//  * در کلاینت می‌توان از expo-location یا navigator.geolocation پر کرد.
//  */
// export class LocationCoordinatesDto {
//   @IsNumber()
//   lat!: number;

//   @IsNumber()
//   lng!: number;
// }

// /**
//  * بارِ تکمیل onboarding / احراز هویت (KYC) پس از تایید OTP.
//  *
//  * توجه مهم: فیلد phoneNumber عمداً در این DTO وجود ندارد.
//  * شماره موبایل فقط از طریق JWT (user.phone تاییدشده در مرحله OTP) گرفته
//  * می‌شود و کلاینت نمی‌تواند آن را تغییر دهد (قفل شده).
//  * به‌لطف forbidNonWhitelisted، ارسال phoneNumber از سمت کلاینت با 400 ریجکت می‌شود.
//  */
// export class CompleteOnboardingDto {
//   // --- ۱. اطلاعات فردی و هویتی ---
//   @IsString()
//   @IsNotEmpty({ message: 'نام الزامی است' })
//   @Length(2, 50)
//   firstName!: string;

//   @IsString()
//   @IsNotEmpty({ message: 'نام خانوادگی الزامی است' })
//   @Length(2, 50)
//   lastName!: string;

//   // کد ملی ۱۰ رقمی — برای تطبیق مالکیت خط موبایل از طریق سامانه شاهکار
//   @IsString()
//   @Matches(/^[0-9]{10}$/, { message: 'کد ملی باید ۱۰ رقم باشد' })
//   nationalCode!: string;

//   // --- ۲. اطلاعات کسب‌وکار و صنف ---
//   @IsString()
//   @IsNotEmpty({ message: 'نام فروشگاه/عنوان تجاری الزامی است' })
//   @Length(2, 120)
//   businessName!: string; // در دیتابیس ستون storeName ذخیره می‌شود

//   @IsString()
//   @IsNotEmpty({ message: 'نوع کسب‌وکار/صنف الزامی است' })
//   businessType!: string; // مثلاً سوپرمارکت، ابزار، پوشاک ...

//   @IsString()
//   @Matches(/^[0-9]{8,15}$/, {
//     message: 'شماره تلفن ثابت نامعتبر است (فقط رقم)',
//   })
//   landlinePhone!: string; // در دیتابیس ستون landline

//   // --- ۳. آدرس و موقعیت ---
//   @IsString()
//   @IsNotEmpty({ message: 'استان الزامی است' })
//   province!: string;

//   @IsString()
//   @IsNotEmpty({ message: 'شهر الزامی است' })
//   city!: string;

//   @IsString()
//   @IsNotEmpty({ message: 'آدرس دقیق الزامی است' })
//   @Length(10, 500, { message: 'آدرس باید بین ۱۰ تا ۵۰۰ نویسه باشد' })
//   exactAddress!: string; // در دیتابیس ستون address

//   @IsString()
//   @Matches(/^[0-9]{10}$/, { message: 'کد پستی باید ۱۰ رقم باشد' })
//   postalCode!: string;

//   @IsOptional()
//   @ValidateNested()
//   @Type(() => LocationCoordinatesDto)
//   locationCoordinates?: LocationCoordinatesDto;

//   // --- ۴. مدارک و پیوست‌های احراز هویت (فایل‌نیم‌های KYC از سرور) ---
//   // رد کردن data URI/base64 — همه آپلودها باید از POST /files/kyc آمده باشند.
//   @IsString()
//   @IsNotEmpty({ message: 'تصویر کارت ملی الزامی است' })
//   @Validate(KycFilenameConstraint)
//   nationalCardImage!: string;

//   @IsString()
//   @IsNotEmpty({ message: 'تصویر پروانه کسب/اجاره‌نامه الزامی است' })
//   @Validate(KycFilenameConstraint)
//   businessLicenseImage!: string;

//   @IsOptional()
//   @IsString()
//   @Validate(KycFilenameConstraint)
//   selfieWithIdCardImage?: string; // اختیاری

//   @IsString()
//   @IsNotEmpty({ message: 'تصویر نما/داخل فروشگاه الزامی است' })
//   @Validate(KycFilenameConstraint)
//   storefrontImage!: string;
// }

// wholesale-api/src/customers/dto/onboarding.dto.ts
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Validate,
  ValidateIf,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidateNested,
  Equals,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * اطمینان حاصل می‌کنیم که فیلدهای تصویر KYC به‌صورت filename از سرور آمده‌اند
 * و حاوی data-URI/Base64 قدیمی نیستند.
 * فرمت فایل‌های تولیدشده توسط FilesService: <docType>_<ts>_<rand>.<ext>
 */
@ValidatorConstraint({ name: 'kycFilename', async: false })
class KycFilenameConstraint implements ValidatorConstraintInterface {
  validate(value: string) {
    if (typeof value !== 'string') return false;
    if (value.startsWith('data:')) return false; // رد کردن data URI
    // فایل‌نیم باید بدون path separator و طول معقول باشد
    if (value.length > 200) return false;
    // eslint-disable-next-line no-control-regex -- چک امنیتی عمدی: جلوگیری از null byte و path separator در نام فایل
    if (/[\\/\x00]/.test(value)) return false;
    return true;
  }
  defaultMessage(args: ValidationArguments) {
    return `${args.property} باید نام فایل معتبر باشد (data URI قبول نمی‌شود)`;
  }
}

/**
 * مختصات GPS — placeholder برای بهینه‌سازی مسیر تحویل.
 */
export class LocationCoordinatesDto {
  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;
}

/**
 * بارِ تکمیل onboarding / احراز هویت (KYC) پس از تایید OTP.
 */
export class CompleteOnboardingDto {
  // --- ۱. اطلاعات فردی و هویتی ---
  @IsString()
  @IsNotEmpty({ message: 'نام الزامی است' })
  @Length(2, 50)
  firstName!: string;

  @IsString()
  @IsNotEmpty({ message: 'نام خانوادگی الزامی است' })
  @Length(2, 50)
  lastName!: string;

  // کد ملی ۱۰ رقمی
  @IsString()
  @Matches(/^[0-9]{10}$/, { message: 'کد ملی باید ۱۰ رقم باشد' })
  nationalCode!: string;

  // --- ۲. اطلاعات کسب‌وکار و صنف ---
  @IsString()
  @IsNotEmpty({ message: 'نام فروشگاه/عنوان تجاری الزامی است' })
  @Length(2, 120)
  businessName!: string;

  @IsString()
  @IsNotEmpty({ message: 'نوع کسب‌وکار/صنف الزامی است' })
  businessType!: string;

  // تلفن ثابت اختیاری شد تا با فرانت‌اند همخوانی داشته باشد
  @IsOptional()
  @ValidateIf(
    (o: CompleteOnboardingDto) => o.landlinePhone !== undefined && o.landlinePhone !== null && o.landlinePhone !== ''
  )
  @IsString()
  @Matches(/^[0-9]{8,15}$/, {
    message: 'شماره تلفن ثابت نامعتبر است (فقط رقم)',
  })
  landlinePhone?: string;

  // --- ۳. آدرس و موقعیت ---
  @IsString()
  @IsNotEmpty({ message: 'استان الزامی است' })
  @Equals('زنجان', {
    message: 'خدمات‌رسانی فعلاً فقط در استان زنجان فعال است.',
  })
  province!: string;

  @IsString()
  @IsNotEmpty({ message: 'شهر الزامی است' })
  @IsIn(['ابهر', 'خرمدره', 'هیدج', 'صائین‌قلعه'], {
    message: 'شهر انتخاب شده خارج از محدوده پوشش‌دهی لجیستیک ماست.',
  })
  city!: string;

  @IsString()
  @IsNotEmpty({ message: 'آدرس دقیق الزامی است' })
  @Length(10, 500, { message: 'آدرس باید بین ۱۰ تا ۵۰۰ نویسه باشد' })
  exactAddress!: string;

  @IsString()
  @Matches(/^[0-9]{10}$/, { message: 'کد پستی باید ۱۰ رقم باشد' })
  postalCode!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationCoordinatesDto)
  locationCoordinates?: LocationCoordinatesDto;

  // --- ۴. مدارک و پیوست‌های احراز هویت ---
  @IsString()
  @IsNotEmpty({ message: 'تصویر کارت ملی الزامی است' })
  @Validate(KycFilenameConstraint)
  nationalCardImage!: string;

  @IsString()
  @IsNotEmpty({ message: 'تصویر پروانه کسب/اجاره‌نامه الزامی است' })
  @Validate(KycFilenameConstraint)
  businessLicenseImage!: string;

  @IsOptional()
  @IsString()
  @Validate(KycFilenameConstraint)
  selfieWithIdCardImage?: string;

  @IsString()
  @IsNotEmpty({ message: 'تصویر نما/داخل فروشگاه الزامی است' })
  @Validate(KycFilenameConstraint)
  storefrontImage!: string;
}
