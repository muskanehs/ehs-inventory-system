import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUserPayload } from "../common/types/auth-user";
import { InventoryService } from "./inventory.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("inventory")
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Roles(Role.ADMIN, Role.STORE_MANAGER, Role.GODOWN_MANAGER)
  findAll(@CurrentUser() user: AuthUserPayload, @Query("locationId") locationId?: string) {
    return this.inventoryService.findAll(user, locationId);
  }

  @Get("grouped")
  @Roles(Role.ADMIN, Role.STORE_MANAGER, Role.GODOWN_MANAGER)
  findGrouped(
    @CurrentUser() user: AuthUserPayload,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
    @Query("locationId") locationId?: string,
    @Query("filter") filter?: string,
    @Query("categoryId") categoryId?: string
  ) {
    return this.inventoryService.findGrouped(user, {
      page,
      limit,
      search,
      locationId,
      filter,
      categoryId
    });
  }
}
