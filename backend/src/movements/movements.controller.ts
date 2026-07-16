import { Body, Controller, Get, Post, Query, Res, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Response } from "express";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUserPayload } from "../common/types/auth-user";
import { ExcelExportService } from "../common/export/excel-export.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateMovementDto } from "./dto/create-movement.dto";
import { MovementsService } from "./movements.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("movements")
export class MovementsController {
  constructor(
    private readonly movementsService: MovementsService,
    private readonly excelExport: ExcelExportService,
    private readonly prisma: PrismaService
  ) {}

  @Get()
  @Roles(Role.ADMIN, Role.STORE_MANAGER, Role.GODOWN_MANAGER)
  findAll(
    @CurrentUser() user: AuthUserPayload,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
    @Query("locationId") locationId?: string
  ) {
    return this.movementsService.findAll(user, { page, limit, search, locationId });
  }

  @Get("export")
  @Roles(Role.ADMIN, Role.STORE_MANAGER, Role.GODOWN_MANAGER)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async export(
    @CurrentUser() user: AuthUserPayload,
    @Query("format") format: "csv" | "xlsx" = "xlsx",
    @Res() res: Response
  ) {
    const rows = await this.movementsService.findAllForExport(user);
    const locationIds = [
      ...new Set(
        rows.flatMap((r) => [r.fromLocationId, r.toLocationId].filter((id): id is string => Boolean(id)))
      )
    ];
    const locations = await this.prisma.location.findMany({ where: { id: { in: locationIds } } });
    const locationMap = new Map(locations.map((l) => [l.id, l.name]));

    const data = rows.map((r) => ({
      product: r.product.name,
      sku: r.product.sku,
      movementType: r.movementType,
      quantity: r.quantity,
      fromLocation: r.fromLocationId ? (locationMap.get(r.fromLocationId) ?? "") : "",
      toLocation: r.toLocationId ? (locationMap.get(r.toLocationId) ?? "") : "",
      performedBy: r.user.name,
      remarks: r.remarks ?? "",
      createdAt: r.createdAt.toISOString()
    }));

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=movements.csv");
      const csv = [
        "product,sku,movementType,quantity,fromLocation,toLocation,performedBy,remarks,createdAt",
        ...data.map(
          (r) =>
            `"${r.product}","${r.sku}","${r.movementType}",${r.quantity},"${r.fromLocation}","${r.toLocation}","${r.performedBy}","${r.remarks}","${r.createdAt}"`
        )
      ].join("\n");
      return res.send(csv);
    }

    const buffer = await this.excelExport.buildWorkbook(
      [
        { header: "Product", key: "product", width: 24 },
        { header: "SKU", key: "sku", width: 14 },
        { header: "Type", key: "movementType", width: 14 },
        { header: "Quantity", key: "quantity", width: 10 },
        { header: "From", key: "fromLocation", width: 18 },
        { header: "To", key: "toLocation", width: 18 },
        { header: "Performed By", key: "performedBy", width: 18 },
        { header: "Remarks", key: "remarks", width: 24 },
        { header: "Created At", key: "createdAt", width: 22 }
      ],
      data
    );
    return this.excelExport.sendExcelFile(res, buffer, "movements.xlsx");
  }

  @Post()
  @Roles(Role.ADMIN, Role.STORE_MANAGER, Role.GODOWN_MANAGER)
  create(@Body() dto: CreateMovementDto, @CurrentUser() user: AuthUserPayload) {
    return this.movementsService.createMovement(
      { ...dto, performedBy: user.sub },
      user
    );
  }
}
