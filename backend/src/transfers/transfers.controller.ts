import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { Response } from "express";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthUserPayload } from "../common/types/auth-user";
import { ExcelExportService } from "../common/export/excel-export.service";
import { CreateTransferDto } from "./dto/create-transfer.dto";
import { RejectTransferDto } from "./dto/reject-transfer.dto";
import { DispatchSlipService } from "./dispatch-slip.service";
import { TransferSlipService } from "./transfer-slip.service";
import { TransfersService, type HydratedTransfer } from "./transfers.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("transfers")
export class TransfersController {
  constructor(
    private readonly transfersService: TransfersService,
    private readonly excelExport: ExcelExportService,
    private readonly dispatchSlip: DispatchSlipService,
    private readonly transferSlip: TransferSlipService
  ) {}

  @Get("stats")
  @Roles(Role.ADMIN, Role.STORE_MANAGER, Role.GODOWN_MANAGER)
  stats(@CurrentUser() user: AuthUserPayload) {
    return this.transfersService.getStats(user);
  }

  @Get()
  @Roles(Role.ADMIN, Role.STORE_MANAGER, Role.GODOWN_MANAGER)
  findAll(
    @CurrentUser() user: AuthUserPayload,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("status") status?: string,
    @Query("fromLocationId") fromLocationId?: string,
    @Query("toLocationId") toLocationId?: string,
    @Query("search") search?: string,
    @Query("days") days?: string,
    @Query("locationId") locationId?: string
  ) {
    return this.transfersService.findAll(user, {
      page,
      limit,
      status,
      fromLocationId,
      toLocationId,
      search,
      days,
      locationId
    });
  }

  @Get("export")
  @Roles(Role.ADMIN, Role.STORE_MANAGER, Role.GODOWN_MANAGER)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async export(
    @CurrentUser() user: AuthUserPayload,
    @Query("format") format: "csv" | "xlsx" = "xlsx",
    @Res() res: Response
  ) {
    const transfers: HydratedTransfer[] = await this.transfersService.findAllForExport(user);
    const data = transfers.flatMap((t) =>
      t.items.map((item) => ({
        transferId: t.id,
        transferType: t.transferType,
        status: t.status,
        fromLocation: t.fromLocation?.name ?? "",
        toLocation: t.toLocation?.name ?? (t.transferType === "CUSTOMER" ? "Customer" : ""),
        customerName: t.customerName ?? "",
        driverName: t.driverName ?? "",
        vehicleNumber: t.vehicleNumber ?? "",
        vehicleContact: t.vehicleContact ?? "",
        product: item.product?.name ?? "",
        sku: item.product?.sku ?? "",
        quantity: item.quantity,
        requestedBy: t.requestedByUser?.name ?? "",
        createdAt: t.createdAt.toISOString()
      }))
    );

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=transfers.csv");
      const csv = [
        "transferId,transferType,status,fromLocation,toLocation,customerName,driverName,vehicleNumber,vehicleContact,product,sku,quantity,requestedBy,createdAt",
        ...data.map(
          (r) =>
            `"${r.transferId}","${r.transferType}","${r.status}","${r.fromLocation}","${r.toLocation}","${r.customerName}","${r.driverName}","${r.vehicleNumber}","${r.vehicleContact}","${r.product}","${r.sku}",${r.quantity},"${r.requestedBy}","${r.createdAt}"`
        )
      ].join("\n");
      return res.send(csv);
    }

    const buffer = await this.excelExport.buildWorkbook(
      [
        { header: "Transfer ID", key: "transferId", width: 28 },
        { header: "Type", key: "transferType", width: 12 },
        { header: "Status", key: "status", width: 12 },
        { header: "From", key: "fromLocation", width: 18 },
        { header: "To", key: "toLocation", width: 18 },
        { header: "Customer", key: "customerName", width: 18 },
        { header: "Driver", key: "driverName", width: 18 },
        { header: "Vehicle No.", key: "vehicleNumber", width: 16 },
        { header: "Contact", key: "vehicleContact", width: 16 },
        { header: "Product", key: "product", width: 24 },
        { header: "SKU", key: "sku", width: 14 },
        { header: "Quantity", key: "quantity", width: 10 },
        { header: "Requested By", key: "requestedBy", width: 18 },
        { header: "Created At", key: "createdAt", width: 22 }
      ],
      data
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=transfers.xlsx");
    return res.send(buffer);
  }

  @Get(":id/dispatch-slip")
  @Roles(Role.ADMIN, Role.STORE_MANAGER, Role.GODOWN_MANAGER)
  async downloadDispatchSlip(
    @Param("id") id: string,
    @CurrentUser() user: AuthUserPayload,
    @Res() res: Response
  ) {
    const buffer = await this.dispatchSlip.generatePdf(id, user);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=dispatch-slip.pdf`);
    return res.send(buffer);
  }

  @Get(":id/transfer-slip")
  @Roles(Role.ADMIN, Role.STORE_MANAGER, Role.GODOWN_MANAGER)
  async downloadTransferSlip(
    @Param("id") id: string,
    @CurrentUser() user: AuthUserPayload,
    @Res() res: Response
  ) {
    const buffer = await this.transferSlip.generatePdf(id, user);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=transfer-slip.pdf`);
    return res.send(buffer);
  }

  @Post()
  @Roles(Role.ADMIN, Role.STORE_MANAGER, Role.GODOWN_MANAGER)
  create(@Body() dto: CreateTransferDto, @CurrentUser() user: AuthUserPayload) {
    return this.transfersService.createRequest({ ...dto, requestedBy: user.sub }, user);
  }

  @Patch("approve-all")
  @Roles(Role.ADMIN)
  approveAll(@Req() req: { user: { sub: string } }) {
    return this.transfersService.approveAll(req.user.sub);
  }

  @Patch(":id/approve")
  @Roles(Role.ADMIN)
  approve(@Param("id") id: string, @Req() req: { user: { sub: string } }) {
    return this.transfersService.approve(id, req.user.sub);
  }

  @Patch(":id/reject")
  @Roles(Role.ADMIN)
  reject(
    @Param("id") id: string,
    @Body() dto: RejectTransferDto,
    @CurrentUser() user: AuthUserPayload
  ) {
    return this.transfersService.reject(id, user, dto.reason);
  }

  @Patch(":id/complete")
  @Roles(Role.ADMIN, Role.STORE_MANAGER)
  complete(@Param("id") id: string, @CurrentUser() user: AuthUserPayload) {
    return this.transfersService.complete(id, user);
  }
}
