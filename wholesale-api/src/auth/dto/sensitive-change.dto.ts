import { IsEnum, IsString, MaxLength } from 'class-validator';

export enum SensitiveField {
  STORE_NAME = 'storeName',
  NATIONAL_CODE = 'nationalCode',
  LANDLINE = 'landline',
  BUSINESS_TYPE = 'businessType',
}

export class SensitiveChangeDto {
  @IsEnum(SensitiveField, {
    message: 'فیلد انتخاب شده برای تغییر حساس معتبر نیست',
  })
  field: SensitiveField;

  @IsString()
  @MaxLength(500)
  newValue: string;
}
