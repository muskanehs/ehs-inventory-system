import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength, ValidateIf } from "class-validator";
import { DEFAULT_PRODUCT_UNIT } from "../../common/constants/product-units";

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @ValidateIf((_, value) => value != null && String(value).trim() !== "")
  @IsString()
  @MinLength(2)
  sku?: string;

  @IsString()
  categoryId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(30)
  unit: string = DEFAULT_PRODUCT_UNIT;

  @IsOptional()
  @IsInt()
  @Min(0)
  minimumStockLevel?: number;
}
