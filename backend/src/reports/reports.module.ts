import { Module } from "@nestjs/common";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { VelocityScheduler } from "./velocity.scheduler";

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, VelocityScheduler],
  exports: [ReportsService]
})
export class ReportsModule {}
