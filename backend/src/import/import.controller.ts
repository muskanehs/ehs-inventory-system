import {
  Controller,
  Get,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Role } from "@prisma/client";
import { Throttle } from "@nestjs/throttler";
import { Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import type { AuthUserPayload } from "../common/types/auth-user";
import { ExcelExportService } from "../common/export/excel-export.service";
import { ImportService } from "./import.service";
import type { UploadedImportFile } from "./import.types";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("import")
export class ImportController {
  constructor(
    private readonly importService: ImportService,
    private readonly excelExport: ExcelExportService
  ) {}

  @Get("products/template")
  @Roles(Role.ADMIN, Role.STORE_MANAGER)
  async productTemplate(
    @Query("format") format: "csv" | "xlsx" = "xlsx",
    @Res() res: Response
  ) {
    const { buffer, filename, contentType } = await this.importService.productTemplate(format);
    if (format === "xlsx" || filename.endsWith(".xlsx")) {
      return this.excelExport.sendExcelFile(res, buffer, filename);
    }
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(buffer.length));
    return res.end(buffer);
  }

  @Get("stock/template")
  @Roles(Role.ADMIN, Role.STORE_MANAGER, Role.GODOWN_MANAGER)
  async stockTemplate(
    @Query("format") format: "csv" | "xlsx" = "xlsx",
    @Query("variant") variant: "empty" | "products" = "empty",
    @Res() res: Response
  ) {
    const templateVariant = variant === "products" ? "products" : "empty";
    const { buffer, filename, contentType } = await this.importService.stockTemplate(
      format,
      templateVariant
    );
    if (format === "xlsx" || filename.endsWith(".xlsx")) {
      return this.excelExport.sendExcelFile(res, buffer, filename);
    }
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(buffer.length));
    return res.end(buffer);
  }

  @Post("products")
  @Roles(Role.ADMIN, Role.STORE_MANAGER)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: MAX_FILE_SIZE }
    })
  )
  importProducts(@UploadedFile() file: UploadedImportFile) {
    return this.importService.importProducts(file);
  }

  @Post("stock")
  @Roles(Role.ADMIN, Role.STORE_MANAGER, Role.GODOWN_MANAGER)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: MAX_FILE_SIZE }
    })
  )
  importStock(@UploadedFile() file: UploadedImportFile, @CurrentUser() user: AuthUserPayload) {
    return this.importService.importStock(file, user);
  }
}
