import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { MovementsController } from "./movements.controller";
import { MovementsService } from "./movements.service";

@Module({
  imports: [InventoryModule],
  controllers: [MovementsController],
  providers: [MovementsService],
  exports: [MovementsService]
})
export class MovementsModule {}
