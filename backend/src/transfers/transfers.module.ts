import { Module } from "@nestjs/common";
import { MovementsModule } from "../movements/movements.module";
import { DispatchSlipService } from "./dispatch-slip.service";
import { TransferSlipService } from "./transfer-slip.service";
import { TransfersController } from "./transfers.controller";
import { TransfersService } from "./transfers.service";

@Module({
  imports: [MovementsModule],
  controllers: [TransfersController],
  providers: [TransfersService, DispatchSlipService, TransferSlipService],
  exports: [TransfersService]
})
export class TransfersModule {}
