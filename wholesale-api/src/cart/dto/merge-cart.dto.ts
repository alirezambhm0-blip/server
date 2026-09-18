import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsNotEmpty, IsString, Min, ValidateNested } from 'class-validator';

class CartItemEntry {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class MergeCartDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemEntry)
  @ArrayMinSize(0)
  @ArrayMaxSize(200, { message: 'سبد خرید نمی‌تواند بیش از ۲۰۰ آیتم داشته باشد' })
  items!: CartItemEntry[];
}
