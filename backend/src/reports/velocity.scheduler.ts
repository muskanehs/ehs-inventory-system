import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { VELOCITY_REPORT_DAYS } from "../common/constants/product-units";
import { ReportsService } from "./reports.service";

@Injectable()
export class VelocityScheduler implements OnModuleInit {
  private readonly logger = new Logger(VelocityScheduler.name);

  constructor(private readonly reportsService: ReportsService) {}

  async onModuleInit() {
    // Ensure stock filters have data after deploy without waiting for 2 AM.
    try {
      await this.reportsService.refreshVelocitySnapshot(VELOCITY_REPORT_DAYS);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error(`Startup velocity refresh failed: ${detail}`);
    }
  }

  /** Daily at 02:00 Asia/Kolkata — recompute fast/slow movers for the last 60 days. */
  @Cron("0 2 * * *", { timeZone: "Asia/Kolkata" })
  async handleDailyVelocityRefresh() {
    this.logger.log("Running daily velocity snapshot cron (last 60 days)");
    try {
      await this.reportsService.refreshVelocitySnapshot(VELOCITY_REPORT_DAYS);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error(`Daily velocity refresh failed: ${detail}`);
    }
  }
}
