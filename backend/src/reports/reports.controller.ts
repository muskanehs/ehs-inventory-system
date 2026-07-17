import { Controller, Get, Header, Query, Res, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Response } from "express";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUserPayload } from "../common/types/auth-user";
import { ExcelExportService } from "../common/export/excel-export.service";
import { VELOCITY_REPORT_DAYS } from "../common/constants/product-units";
import { resolveInventoryScope } from "../common/utils/location-scope";
import { ReportsService } from "./reports.service";

const INVENTORY_COLUMNS = [
  { header: "Product", key: "product", width: 28 },
  { header: "SKU", key: "sku", width: 16 },
  { header: "Category", key: "category", width: 20 },
  { header: "Location", key: "location", width: 20 },
  { header: "Location Type", key: "locationType", width: 14 },
  { header: "Quantity", key: "quantity", width: 12 },
  { header: "Unit", key: "unit", width: 10 }
];

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("reports")
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly excelExport: ExcelExportService
  ) {}

  @Get("inventory")
  @Roles(Role.ADMIN, Role.STORE_MANAGER)
  inventory(
    @CurrentUser() user: AuthUserPayload,
    @Query("categoryId") categoryId?: string,
    @Query("locationId") locationId?: string
  ) {
    const scopedLocationId = resolveInventoryScope(user, locationId);
    return this.reportsService.currentInventory({
      categoryId,
      locationId: scopedLocationId
    });
  }

  @Get("velocity")
  @Roles(Role.ADMIN, Role.STORE_MANAGER)
  velocity(@Query("days") days?: string) {
    const period = days ? Number(days) : VELOCITY_REPORT_DAYS;
    return this.reportsService.velocityReport(
      Number.isFinite(period) ? period : VELOCITY_REPORT_DAYS
    );
  }

  @Get("inventory/export")
  @Roles(Role.ADMIN, Role.STORE_MANAGER)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async exportInventory(
    @CurrentUser() user: AuthUserPayload,
    @Res() res: Response,
    @Query("format") format: "csv" | "xlsx" = "xlsx",
    @Query("categoryId") categoryId?: string,
    @Query("locationId") locationId?: string,
    @Query("groupBy") groupBy: "none" | "category" | "location" = "none"
  ) {
    const scopedLocationId = resolveInventoryScope(user, locationId);
    const rows = await this.reportsService.currentInventoryForExport({
      categoryId,
      locationId: scopedLocationId
    });
    const data = rows.map((r) => ({
      product: r.product.name,
      sku: r.product.sku,
      category: r.product.category?.name ?? "",
      location: r.location?.name ?? "",
      locationType: r.location?.type ?? "",
      quantity: r.quantity,
      unit: r.product.unit
    }));

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=inventory-report.csv");
      const csv = [
        "product,sku,category,location,locationType,quantity,unit",
        ...data.map(
          (r) =>
            `"${r.product}","${r.sku}","${r.category}","${r.location}","${r.locationType}",${r.quantity},"${r.unit}"`
        )
      ].join("\n");
      return res.send(csv);
    }

    if (groupBy === "category") {
      const groups = new Map<string, Record<string, unknown>[]>();
      for (const row of data) {
        const key = row.category || "Uncategorized";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(row);
      }
      const buffer = await this.excelExport.buildGroupedWorkbook(
        INVENTORY_COLUMNS,
        [...groups.entries()].map(([sheetName, sheetRows]) => ({ sheetName, rows: sheetRows }))
      );
      return this.excelExport.sendExcelFile(res, buffer, "inventory-by-category.xlsx");
    }

    if (groupBy === "location") {
      const groups = new Map<string, Record<string, unknown>[]>();
      for (const row of data) {
        const key = row.location || "Unknown";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(row);
      }
      const buffer = await this.excelExport.buildGroupedWorkbook(
        INVENTORY_COLUMNS,
        [...groups.entries()].map(([sheetName, sheetRows]) => ({ sheetName, rows: sheetRows }))
      );
      return this.excelExport.sendExcelFile(res, buffer, "inventory-by-location.xlsx");
    }

    const buffer = await this.excelExport.buildWorkbook(INVENTORY_COLUMNS, data);
    return this.excelExport.sendExcelFile(res, buffer, "inventory-report.xlsx");
  }
}
