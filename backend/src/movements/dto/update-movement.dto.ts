import { IsInt, Max, Min } from "class-validator";

export class UpdateMovementDto {
  @IsInt()
  @Min(1)
  @Max(100_000)
  quantity!: number;
}
