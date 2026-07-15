import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { MustChangePasswordGuard } from "./auth/must-change-password.guard";
import { CategoriesModule } from "./categories/categories.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { ExcelExportModule } from "./common/export/excel-export.module";
import { InventoryModule } from "./inventory/inventory.module";
import { LocationsModule } from "./locations/locations.module";
import { MovementsModule } from "./movements/movements.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProductsModule } from "./products/products.module";
import { ReportsModule } from "./reports/reports.module";
import { TransfersModule } from "./transfers/transfers.module";
import { UsersModule } from "./users/users.module";
import { RedisModule } from "./common/redis/redis.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    RedisModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100
      }
    ]),
    PrismaModule,
    ExcelExportModule,
    AuthModule,
    UsersModule,
    DashboardModule,
    CategoriesModule,
    ProductsModule,
    LocationsModule,
    InventoryModule,
    MovementsModule,
    TransfersModule,
    ReportsModule,
    NotificationsModule
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: MustChangePasswordGuard }
  ]
})
export class AppModule {}
