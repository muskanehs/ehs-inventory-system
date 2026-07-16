import { Module } from "@nestjs/common";
import { MovementsModule } from "../movements/movements.module";
import { ProductsModule } from "../products/products.module";
import { ImportController } from "./import.controller";
import { ImportService } from "./import.service";

@Module({
  imports: [ProductsModule, MovementsModule],
  controllers: [ImportController],
  providers: [ImportService]
})
export class ImportModule {}
