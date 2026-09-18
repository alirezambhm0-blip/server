import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class AddItemDto {
  @IsString()
  @IsNotEmpty({ message: 'شناسه محصول الزامی است' })
  productId!: string;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'تعداد باید حداقل ۱ باشد' })
  quantity?: number;
}
