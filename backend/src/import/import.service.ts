import {
  BadRequestException,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { MovementType, Role } from "@prisma/client";
import type { AuthUserPayload } from "../common/types/auth-user";
import {
  DEFAULT_PRODUCT_UNIT,
  PRODUCT_UNITS
} from "../common/constants/product-units";
import {
  ExcelColumn,
  ExcelExportService,
  ParsedSheetRow
} from "../common/export/excel-export.service";
import { NOT_DELETED } from "../common/utils/soft-delete";
import { MovementsService } from "../movements/movements.service";
import { PrismaService } from "../prisma/prisma.service";
import { ProductsService } from "../products/products.service";
import { CreateProductDto } from "../products/dto/create-product.dto";
import type { UploadedImportFile } from "./import.types";

export type ImportRowError = { row: number; message: string };

export type ImportSummary = {
  created: number;
  skipped: number;
  errors: ImportRowError[];
};

const PRODUCT_COLUMNS: ExcelColumn[] = [
  { header: "name", key: "name", width: 28 },
  { header: "category", key: "category", width: 20 },
  { header: "sku", key: "sku", width: 16 },
  { header: "unit", key: "unit", width: 12 },
  { header: "minimumStockLevel", key: "minimumStockLevel", width: 18 }
];

const STOCK_COLUMNS: ExcelColumn[] = [
  { header: "sku", key: "sku", width: 16 },
  { header: "productName", key: "productName", width: 28 },
  { header: "locationName", key: "locationName", width: 24 },
  { header: "quantity", key: "quantity", width: 12 },
  { header: "remarks", key: "remarks", width: 32 }
];

const PRODUCT_HEADERS = PRODUCT_COLUMNS.map((c) => c.header);
const STOCK_HEADERS = STOCK_COLUMNS.map((c) => c.header);

@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly excelExport: ExcelExportService,
    private readonly productsService: ProductsService,
    private readonly movementsService: MovementsService
  ) {}

  productTemplate(format: "csv" | "xlsx") {
    return this.buildTemplate(PRODUCT_COLUMNS, "product-import-template", format);
  }

  async stockTemplate(
    format: "csv" | "xlsx",
    variant: "empty" | "products" = "empty"
  ) {
    if (variant === "products") {
      const products = await this.prisma.product.findMany({
        where: NOT_DELETED,
        orderBy: { name: "asc" },
        select: { sku: true, name: true }
      });
      const rows = products.map((product) => ({
        sku: product.sku ?? "",
        productName: product.name,
        locationName: "",
        quantity: "",
        remarks: ""
      }));
      return this.buildTemplate(
        STOCK_COLUMNS,
        "stock-import-template-with-products",
        format,
        rows
      );
    }
    return this.buildTemplate(STOCK_COLUMNS, "stock-import-template", format);
  }

  private async buildTemplate(
    columns: ExcelColumn[],
    filename: string,
    format: "csv" | "xlsx",
    rows: Record<string, unknown>[] = []
  ) {
    if (format === "csv") {
      const header = columns.map((c) => c.header).join(",");
      const body = rows
        .map((row) =>
          columns
            .map((col) => {
              const raw = row[col.key];
              const value = raw == null ? "" : String(raw);
              return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
            })
            .join(",")
        )
        .join("\n");
      const csv = body ? `${header}\n${body}\n` : `${header}\n`;
      return {
        buffer: Buffer.from(csv, "utf-8"),
        filename: `${filename}.csv`,
        contentType: "text/csv"
      };
    }
    const buffer = await this.excelExport.buildWorkbook(columns, rows);
    return {
      buffer,
      filename: `${filename}.xlsx`,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    };
  }

  private async parseUpload(
    file: UploadedImportFile,
    expectedHeaders: string[]
  ): Promise<ParsedSheetRow[]> {
    if (!file?.buffer?.length) {
      throw new BadRequestException("No file uploaded");
    }
    const name = file.originalname.toLowerCase();
    if (name.endsWith(".csv")) {
      return this.excelExport.parseCsv(file.buffer, expectedHeaders);
    }
    if (name.endsWith(".xls") && !name.endsWith(".xlsx")) {
      throw new BadRequestException("Legacy .xls is not supported. Please upload .xlsx or .csv");
    }
    if (name.endsWith(".xlsx")) {
      return this.excelExport.parseWorkbook(file.buffer, expectedHeaders);
    }
    throw new BadRequestException("File must be .xlsx or .csv");
  }

  async importProducts(file: UploadedImportFile): Promise<ImportSummary> {
    const rows = await this.parseUpload(file, PRODUCT_HEADERS);
    const summary: ImportSummary = { created: 0, skipped: 0, errors: [] };

    for (let index = 0; index < rows.length; index += 1) {
      const rowNumber = index + 2;
      const row = rows[index];
      try {
        const name = row.name?.trim();
        const categoryName = row.category?.trim();
        if (!name || name.length < 2) {
          throw new Error("name is required (min 2 characters)");
        }
        if (!categoryName) {
          throw new Error("category is required");
        }

        const category = await this.prisma.category.findFirst({
          where: {
            name: { equals: categoryName, mode: "insensitive" },
            ...NOT_DELETED
          }
        });
        if (!category) {
          throw new Error(`Category "${categoryName}" not found`);
        }

        const sku = row.sku?.trim() || undefined;
        if (sku) {
          const existingSku = await this.prisma.product.findFirst({
            where: { sku, ...NOT_DELETED }
          });
          if (existingSku) {
            summary.skipped += 1;
            continue;
          }
        }

        const unit = row.unit?.trim() || DEFAULT_PRODUCT_UNIT;
        if (!PRODUCT_UNITS.includes(unit as (typeof PRODUCT_UNITS)[number])) {
          throw new Error(`unit must be one of: ${PRODUCT_UNITS.join(", ")}`);
        }

        const minimumStockLevel = row.minimumstocklevel
          ? Number.parseInt(row.minimumstocklevel, 10)
          : 0;
        if (!Number.isFinite(minimumStockLevel) || minimumStockLevel < 0) {
          throw new Error("minimumStockLevel must be a non-negative integer");
        }

        const dto: CreateProductDto = {
          name,
          categoryId: category.id,
          sku,
          unit,
          minimumStockLevel
        };
        await this.productsService.create(dto);
        summary.created += 1;
      } catch (error) {
        summary.errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return summary;
  }

  async importStock(file: UploadedImportFile, user: AuthUserPayload): Promise<ImportSummary> {
    const rows = await this.parseUpload(file, STOCK_HEADERS);
    const summary: ImportSummary = { created: 0, skipped: 0, errors: [] };

    for (let index = 0; index < rows.length; index += 1) {
      const rowNumber = index + 2;
      const row = rows[index];
      try {
        const sku = row.sku?.trim();
        const productName = row.productname?.trim();
        const locationName = row.locationname?.trim();
        const quantityRaw = row.quantity?.trim() ?? "";

        // Prefill templates list every product; leave location/quantity blank to skip a row.
        if (!locationName && !quantityRaw) {
          continue;
        }

        if (!sku && !productName) {
          throw new Error("sku or productName is required");
        }

        const product = sku
          ? await this.prisma.product.findFirst({
              where: { sku, ...NOT_DELETED }
            })
          : await this.prisma.product.findFirst({
              where: {
                name: { equals: productName!, mode: "insensitive" },
                ...NOT_DELETED
              }
            });
        if (!product) {
          throw new Error(sku ? `Product with SKU "${sku}" not found` : `Product "${productName}" not found`);
        }

        if (!locationName) {
          throw new Error("locationName is required");
        }

        const location = await this.prisma.location.findFirst({
          where: {
            name: { equals: locationName, mode: "insensitive" },
            ...NOT_DELETED
          }
        });
        if (!location) {
          throw new Error(`Location "${locationName}" not found`);
        }

        if (user.role === Role.GODOWN_MANAGER) {
          if (!user.assignedLocationId || location.id !== user.assignedLocationId) {
            throw new ForbiddenException("You can only import stock into your assigned godown");
          }
        }

        const quantity = Number.parseInt(quantityRaw, 10);
        if (!Number.isFinite(quantity) || quantity < 1) {
          throw new Error("quantity must be a positive integer");
        }

        const remarks = row.remarks?.trim();
        await this.movementsService.createMovement(
          {
            productId: product.id,
            toLocationId: location.id,
            quantity,
            movementType: MovementType.PURCHASE,
            remarks: remarks ? `Bulk import — ${remarks}` : "Bulk import",
            performedBy: user.sub
          },
          user
        );
        summary.created += 1;
      } catch (error) {
        summary.errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return summary;
  }
}
