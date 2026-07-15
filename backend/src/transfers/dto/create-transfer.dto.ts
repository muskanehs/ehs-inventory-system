import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from "class-validator";
import { TransferType } from "@prisma/client";

export class TransferLineItemDto {
  @IsString()
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(100_000)
  quantity!: number;
}

export class CreateTransferDto {
  @IsOptional()
  @IsEnum(TransferType)
  transferType?: TransferType;

  @IsString()
  fromLocationId!: string;

  @IsOptional()
  @IsString()
  toLocationId?: string;

  @IsOptional()
  @IsString()
  driverName?: string;

  @IsOptional()
  @IsString()
  vehicleNumber?: string;

  @IsOptional()
  @IsString()
  vehicleContact?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsString()
  customerAddress?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TransferLineItemDto)
  items!: TransferLineItemDto[];
}
