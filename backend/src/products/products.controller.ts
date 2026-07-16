import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Response } from "express";
import { Throttle } from "@nestjs/throttler";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUserPayload } from "../common/types/auth-user";
import { ExcelExportService } from "../common/export/excel-export.service";
import { resolveInventoryScope } from "../common/utils/location-scope";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductsService } from "./products.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("products")
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly excelExport: ExcelExportService
  ) {}

  @Get()
  @Roles(Role.ADMIN, Role.STORE_MANAGER)
  findAll(
    @CurrentUser() user: AuthUserPayload,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("includeDeleted") includeDeleted?: string
  ) {
    const allowDeleted = includeDeleted === "true" && user.role === Role.ADMIN;
    return this.productsService.findAll(search, page, limit, allowDeleted);
  }

  @Get("picker")
  @Roles(Role.ADMIN, Role.STORE_MANAGER, Role.GODOWN_MANAGER)
  picker(
    @CurrentUser() user: AuthUserPayload,
    @Query("locationId") locationId?: string,
    @Query("search") search?: string,
    @Query("limit") limit?: string
  ) {
    const parsedLimit = limit ? Number(limit) : 30;
    const scopedLocationId = resolveInventoryScope(user, locationId);
    return this.productsService.findPicker(
      scopedLocationId,
      search,
      Number.isFinite(parsedLimit) ? parsedLimit : 30
    );
  }

  @Get("export")
  @Roles(Role.ADMIN, Role.STORE_MANAGER)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  async export(@Query("format") format: "csv" | "xlsx" = "xlsx", @Res() res: Response) {
    const result = await this.productsService.findAll();
    const rows = Array.isArray(result) ? result : result.items;
    const data = rows.map((r) => ({
      name: r.name,
      sku: r.sku,
      category: r.category?.name ?? "",
      unit: r.unit,
      minimumStockLevel: r.minimumStockLevel
    }));

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=products.csv");
      const csv = [
        "name,sku,category,unit,minimumStockLevel",
        ...data.map(
          (r) =>
            `"${r.name}","${r.sku}","${r.category}","${r.unit}",${r.minimumStockLevel}`
        )
      ].join("\n");
      return res.send(csv);
    }

    const buffer = await this.excelExport.buildWorkbook(
      [
        { header: "Name", key: "name", width: 28 },
        { header: "SKU", key: "sku", width: 16 },
        { header: "Category", key: "category", width: 20 },
        { header: "Unit", key: "unit", width: 10 },
        { header: "Min Stock", key: "minimumStockLevel", width: 12 }
      ],
      data
    );
    res.setHeader("Content-Disposition", "attachment; filename=products.xlsx");
    return res.send(buffer);
  }

  @Roles(Role.ADMIN, Role.STORE_MANAGER)
  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Roles(Role.ADMIN, Role.STORE_MANAGER)
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Roles(Role.ADMIN, Role.STORE_MANAGER)
  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: AuthUserPayload) {
    return this.productsService.remove(id, user.sub);
  }

  @Roles(Role.ADMIN)
  @Patch(":id/restore")
  restore(@Param("id") id: string) {
    return this.productsService.restore(id);
  }
}
