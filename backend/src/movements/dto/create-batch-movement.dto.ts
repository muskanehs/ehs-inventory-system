import { Type } from "class-transformer";
import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from "class-validator";
import { MovementType } from "@prisma/client";

export class BatchMovementLineDto {
  @IsString()
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(100_000)
  quantity!: number;
}

export class CreateBatchMovementDto {
  @IsString()
  toLocationId!: string;

  @IsEnum(MovementType)
  movementType!: MovementType;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BatchMovementLineDto)
  items!: BatchMovementLineDto[];
}
