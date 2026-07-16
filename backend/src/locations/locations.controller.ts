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
import { CreateLocationDto } from "./dto/create-location.dto";
import { UpdateLocationDto } from "./dto/update-location.dto";
import { LocationsService } from "./locations.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("locations")
export class LocationsController {
  constructor(
    private readonly locationsService: LocationsService,
    private readonly excelExport: ExcelExportService
  ) {}

  @Get()
  @Roles(Role.ADMIN, Role.STORE_MANAGER, Role.GODOWN_MANAGER)
  @Header("Cache-Control", "private, max-age=60")
  async findAll(
    @CurrentUser() user: AuthUserPayload,
    @Res({ passthrough: true }) res: Response,
    @Headers("if-none-match") ifNoneMatch?: string
  ) {
    const etag = await this.locationsService.getListEtag(user);
    res.setHeader("ETag", etag);
    this.locationsService.assertNotModified(ifNoneMatch, etag);
    return this.locationsService.findAll(user);
  }

  @Get("godowns/summary")
  @Roles(Role.ADMIN, Role.STORE_MANAGER, Role.GODOWN_MANAGER)
  godownsSummary(@CurrentUser() user: AuthUserPayload) {
    return this.locationsService.godownsSummary(user);
  }

  @Get("export")
  @Roles(Role.ADMIN, Role.STORE_MANAGER)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async export(
    @CurrentUser() user: AuthUserPayload,
    @Query("format") format: "csv" | "xlsx" = "xlsx",
    @Res() res: Response
  ) {
    const rows = await this.locationsService.findAll(user);
    const data = rows.map((r) => ({
      name: r.name,
      type: r.type,
      createdAt: r.createdAt.toISOString()
    }));

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=locations.csv");
      const csv = [
        "name,type,createdAt",
        ...data.map((r) => `"${r.name}","${r.type}","${r.createdAt}"`)
      ].join("\n");
      return res.send(csv);
    }

    const buffer = await this.excelExport.buildWorkbook(
      [
        { header: "Name", key: "name", width: 24 },
        { header: "Type", key: "type", width: 12 },
        { header: "Created At", key: "createdAt", width: 24 }
      ],
      data
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=locations.xlsx");
    return res.send(buffer);
  }

  @Roles(Role.ADMIN)
  @Post()
  createGodown(@Body() dto: CreateLocationDto) {
    return this.locationsService.createGodown(dto);
  }

  @Roles(Role.ADMIN)
  @Patch(":id")
  updateGodown(@Param("id") id: string, @Body() dto: UpdateLocationDto) {
    return this.locationsService.updateGodown(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(":id")
  removeGodown(@Param("id") id: string, @CurrentUser() user: AuthUserPayload) {
    return this.locationsService.removeGodown(id, user.sub);
  }
}
