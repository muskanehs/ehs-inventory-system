import { IsString, MinLength } from "class-validator";

export class SwitchUserDto {
  @IsString()
  @MinLength(1)
  userId!: string;
}
