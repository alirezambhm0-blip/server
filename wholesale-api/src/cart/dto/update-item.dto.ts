import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class UpdateItemDto {
  @IsString()
  @IsNotEmpty({ message: 'شناسه محصول الزامی است' })
  productId!: string;

  @IsInt()
  @Min(0, { message: 'تعداد نمی‌تواند منفی باشد' })
  quantity!: number;
}
