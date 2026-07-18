import { Injectable, NotFoundException } from "@nestjs/common";
import { TransferType } from "@prisma/client";
import PDFDocument = require("pdfkit");
import type { AuthUserPayload } from "../common/types/auth-user";
import { TransfersService } from "./transfers.service";

@Injectable()
export class DispatchSlipService {
  constructor(private readonly transfersService: TransfersService) {}

  async generatePdf(transferId: string, user: AuthUserPayload): Promise<Buffer> {
    const transfer = await this.transfersService.findOne(transferId, user);
    if (!transfer) {
      throw new NotFoundException("Transfer not found");
    }
    if (transfer.transferType !== TransferType.CUSTOMER) {
      throw new NotFoundException("Dispatch slip is only available for customer transfers");
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(20).font("Helvetica-Bold").text("Dispatch Slip", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(10).font("Helvetica").fillColor("#666666");
      doc.text(`Date: ${new Date(transfer.createdAt).toLocaleDateString("en-IN")}`, {
        align: "center"
      });
      doc.moveDown(1.5);
      doc.fillColor("#000000");

      doc.fontSize(12).font("Helvetica-Bold").text("Collect From");
      doc.font("Helvetica").fontSize(11);
      doc.text(transfer.fromLocation?.name ?? "—");
      doc.text(`Type: ${transfer.fromLocation?.type ?? "—"}`);
      doc.moveDown(1);

      doc.fontSize(12).font("Helvetica-Bold").text("Customer Details");
      doc.font("Helvetica").fontSize(11);
      if (transfer.customerName || transfer.customerPhone || transfer.customerAddress) {
        if (transfer.customerName) doc.text(`Name: ${transfer.customerName}`);
        if (transfer.customerPhone) doc.text(`Phone: ${transfer.customerPhone}`);
        if (transfer.customerAddress) doc.text(`Address: ${transfer.customerAddress}`);
      } else {
        doc.fillColor("#666666").text("Not provided");
        doc.fillColor("#000000");
      }
      doc.moveDown(1);

      doc.fontSize(12).font("Helvetica-Bold").text("Items");
      doc.moveDown(0.5);

      const tableTop = doc.y;
      const colProduct = 50;
      const colSku = 220;
      const colQty = 380;
      const rowHeight = 20;

      doc.fontSize(10).font("Helvetica-Bold");
      doc.text("Product", colProduct, tableTop);
      doc.text("SKU", colSku, tableTop);
      doc.text("Quantity", colQty, tableTop);
      doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

      let y = tableTop + rowHeight;
      doc.font("Helvetica");
      for (const item of transfer.items) {
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
        doc.text(item.product?.name ?? "—", colProduct, y, { width: 160 });
        doc.text(item.product?.sku ?? "—", colSku, y, { width: 150 });
        doc.text(
          `${item.quantity} ${item.product?.unit ?? ""}`.trim(),
          colQty,
          y,
          { width: 120 }
        );
        y += rowHeight;
      }

      doc.moveDown(2);
      doc.fontSize(10).fillColor("#666666");
      doc.text(
        `Requested by: ${transfer.requestedByUser?.name ?? "Unknown"}`,
        50,
        doc.y
      );
      doc.text("EHS", { align: "center" });

      doc.end();
    });
  }
}
