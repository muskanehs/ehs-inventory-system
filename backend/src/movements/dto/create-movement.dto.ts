import { MovementType } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateMovementDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @IsString()
  fromLocationId?: string;

  @IsOptional()
  @IsString()
  toLocationId?: string;

  @IsInt()
  @Min(1)
  @Max(100_000)
  quantity!: number;

  @IsEnum(MovementType)
  movementType!: MovementType;

  @IsOptional()
  @IsString()
  remarks?: string;
}
