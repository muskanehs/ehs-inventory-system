import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUserPayload } from "../common/types/auth-user";
import { DashboardService } from "./dashboard.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("summary")
  @Roles(Role.ADMIN, Role.STORE_MANAGER)
  summary(@CurrentUser() user: AuthUserPayload, @Query("locationId") locationId?: string) {
    return this.dashboardService.getSummary(user, locationId);
  }
}
