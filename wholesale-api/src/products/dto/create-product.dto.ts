import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsArray, IsIn, Min, MaxLength } from 'class-validator';
import { ProductUnit } from '@prisma/client';

const UNITS = Object.values(ProductUnit) as string[];

export class CreateProductDto {
  @IsString()
  @IsNotEmpty({ message: 'نام محصول الزامی است' })
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  slug?: string;

  @IsString()
  @IsNotEmpty({ message: 'شناسه دسته‌بندی الزامی است' })
  categoryId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  description?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsArray()
  @IsOptional()
  galleryImages?: string[];

  @IsString()
  @IsOptional()
  @MaxLength(100)
  brand?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  productCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  unitDetails?: string;

  @IsInt()
  @Min(0)
  price!: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  costPrice?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  oldPrice?: number;

  @IsString()
  @IsIn(UNITS, { message: 'واحد نامعتبر است' })
  unit!: ProductUnit;

  @IsInt()
  @Min(0)
  stock!: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  minOrderQty?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @IsBoolean()
  @IsOptional()
  isNew?: boolean;

  @IsBoolean()
  @IsOptional()
  isDiscounted?: boolean;

  @IsInt()
  @IsOptional()
  sortOrder?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  itemsPerPackage?: number;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  packageType?: string;
}
