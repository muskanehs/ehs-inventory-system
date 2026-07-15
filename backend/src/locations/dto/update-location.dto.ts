import { IsString, MinLength } from "class-validator";

export class UpdateLocationDto {
  @IsString()
  @MinLength(2)
  name!: string;
}
