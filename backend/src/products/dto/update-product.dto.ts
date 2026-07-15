import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, MinLength, ValidateIf } from "class-validator";
import { PRODUCT_UNITS } from "../../common/constants/product-units";

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @ValidateIf((_, value) => value != null && String(value).trim() !== "")
  @IsString()
  @MinLength(2)
  sku?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @IsIn([...PRODUCT_UNITS], {
    message: `unit must be one of: ${PRODUCT_UNITS.join(", ")}`
  })
  unit?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minimumStockLevel?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
