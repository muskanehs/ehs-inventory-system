import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { Response } from "express";
import { Throttle } from "@nestjs/throttler";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUserPayload } from "../common/types/auth-user";
import { ExcelExportService } from "../common/export/excel-export.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { CategoriesService } from "./categories.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("categories")
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly excelExport: ExcelExportService
  ) {}

  @Get()
  @Roles(Role.ADMIN, Role.STORE_MANAGER)
  @Header("Cache-Control", "private, no-cache")
  async findAll(
    @CurrentUser() user: AuthUserPayload,
    @Res({ passthrough: true }) res: Response,
    @Headers("if-none-match") ifNoneMatch?: string,
    @Query("includeDeleted") includeDeleted?: string
  ) {
    const etag = await this.categoriesService.getListEtag();
    res.setHeader("ETag", etag);
    this.categoriesService.assertNotModified(ifNoneMatch, etag);
    const allowDeleted = includeDeleted === "true" && user.role === Role.ADMIN;
    return this.categoriesService.findAll(allowDeleted);
  }

  @Get("stats")
  @Roles(Role.ADMIN, Role.STORE_MANAGER)
  getStats() {
    return this.categoriesService.getStats();
  }

  @Get("export")
  @Roles(Role.ADMIN, Role.STORE_MANAGER)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async export(@Query("format") format: "csv" | "xlsx" = "xlsx", @Res() res: Response) {
    const rows = await this.categoriesService.findAllForExport();
    const data = rows.map((r) => ({
      name: r.name,
      description: r.description ?? "",
      productCount: r._count.products
    }));

    if (format === "csv") {
      const csv = [
        "name,description,productCount",
        ...data.map((r) => `"${r.name}","${r.description}",${r.productCount}`)
      ].join("\n");
      res.setHeader("Content-Disposition", "attachment; filename=categories.csv");
      res.setHeader("Content-Type", "text/csv");
      return res.send(csv);
    }

    const buffer = await this.excelExport.buildWorkbook(
      [
        { header: "Name", key: "name", width: 24 },
        { header: "Description", key: "description", width: 36 },
        { header: "Product Count", key: "productCount", width: 16 }
      ],
      data
    );
    return this.excelExport.sendExcelFile(res, buffer, "categories.xlsx");
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.categoriesService.findOne(id);
  }

  @Roles(Role.ADMIN, Role.STORE_MANAGER)
  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Roles(Role.ADMIN, Role.STORE_MANAGER)
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: AuthUserPayload) {
    return this.categoriesService.remove(id, user.sub);
  }

  @Roles(Role.ADMIN)
  @Patch(":id/restore")
  restore(@Param("id") id: string) {
    return this.categoriesService.restore(id);
  }
}
