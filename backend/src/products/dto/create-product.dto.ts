import { IsIn, IsInt, IsOptional, IsString, Min, MinLength, ValidateIf } from "class-validator";
import { DEFAULT_PRODUCT_UNIT, PRODUCT_UNITS } from "../../common/constants/product-units";

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
  @IsIn([...PRODUCT_UNITS], {
    message: `unit must be one of: ${PRODUCT_UNITS.join(", ")}`
  })
  unit: string = DEFAULT_PRODUCT_UNIT;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minimumStockLevel?: number;
}
