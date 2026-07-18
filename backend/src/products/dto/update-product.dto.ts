import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength, ValidateIf } from "class-validator";

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
  @MinLength(1)
  @MaxLength(30)
  unit?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minimumStockLevel?: number;
}
