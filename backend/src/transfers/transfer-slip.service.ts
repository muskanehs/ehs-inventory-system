import { Injectable, NotFoundException } from "@nestjs/common";
import { TransferType } from "@prisma/client";
import PDFDocument = require("pdfkit");
import type { AuthUserPayload } from "../common/types/auth-user";
import { TransfersService } from "./transfers.service";

const STORE = {
  name: "EHS",
  address: "Sevoke Road, Siliguri, 734001",
  contact: "2430240",
  gstin: "19ACRPA8005A1ZY"
};

const INK = "#171717";
const MUTED = "#737373";
const RULE = "#E5E5E5";
const PAGE_LEFT = 48;
const PAGE_RIGHT = 547;
const CONTENT_WIDTH = PAGE_RIGHT - PAGE_LEFT;

@Injectable()
export class TransferSlipService {
  constructor(private readonly transfersService: TransfersService) {}

  async generatePdf(transferId: string, user: AuthUserPayload): Promise<Buffer> {
    const transfer = await this.transfersService.findOne(transferId, user);
    if (!transfer) {
      throw new NotFoundException("Transfer not found");
    }
    if (transfer.transferType !== TransferType.INTERNAL) {
      throw new NotFoundException("Transfer slip is only available for internal transfers");
    }

    const dateLabel = new Date(transfer.createdAt).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
    const fromName = transfer.fromLocation?.name ?? "—";
    const toName = transfer.toLocation?.name ?? "—";
    const routeLabel = `${fromName} to ${toName}`;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: PAGE_LEFT,
        size: "A4",
        info: {
          Title: "Transfer Slip",
          Author: STORE.name
        }
      });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Header: store name (left) + date (top right)
      const headerTop = 48;
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(18);
      doc.text(STORE.name, PAGE_LEFT, headerTop, {
        width: CONTENT_WIDTH * 0.65,
        align: "left"
      });

      doc.fillColor(MUTED).font("Helvetica").fontSize(10);
      doc.text(dateLabel, PAGE_LEFT, headerTop + 4, {
        width: CONTENT_WIDTH,
        align: "right"
      });

      // Address + contact + GSTIN stacked under store name
      let y = headerTop + 28;
      doc.fillColor(MUTED).font("Helvetica").fontSize(10);
      doc.text(STORE.address, PAGE_LEFT, y, { width: CONTENT_WIDTH * 0.7 });
      y = doc.y + 6;
      doc.text(`Contact  ${STORE.contact}`, PAGE_LEFT, y);
      y = doc.y + 2;
      doc.text(`GSTIN  ${STORE.gstin}`, PAGE_LEFT, y);

      // Divider
      y = doc.y + 18;
      doc
        .moveTo(PAGE_LEFT, y)
        .lineTo(PAGE_RIGHT, y)
        .lineWidth(1)
        .strokeColor(RULE)
        .stroke();

      // Document title + route
      y += 20;
      doc.fillColor(MUTED).font("Helvetica").fontSize(9);
      doc.text("TRANSFER SLIP", PAGE_LEFT, y, {
        characterSpacing: 1.2
      });

      y = doc.y + 8;
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(14);
      doc.text(routeLabel, PAGE_LEFT, y, { width: CONTENT_WIDTH });

      // Items section
      y = doc.y + 22;
      doc.fillColor(MUTED).font("Helvetica").fontSize(9);
      doc.text("ITEMS", PAGE_LEFT, y, { characterSpacing: 1.2 });

      y = doc.y + 10;
      const colProduct = PAGE_LEFT;
      const colSku = PAGE_LEFT + 280;
      const colQty = PAGE_LEFT + 400;
      const rowHeight = 24;

      // Table header
      doc
        .moveTo(PAGE_LEFT, y)
        .lineTo(PAGE_RIGHT, y)
        .lineWidth(1)
        .strokeColor(RULE)
        .stroke();
      y += 8;

      doc.fillColor(MUTED).font("Helvetica").fontSize(9);
      doc.text("Product", colProduct, y);
      doc.text("SKU", colSku, y);
      doc.text("Qty", colQty, y, { width: PAGE_RIGHT - colQty, align: "right" });

      y += 16;
      doc
        .moveTo(PAGE_LEFT, y)
        .lineTo(PAGE_RIGHT, y)
        .lineWidth(1)
        .strokeColor(RULE)
        .stroke();
      y += 10;

      doc.fillColor(INK).font("Helvetica");
      for (const item of transfer.items) {
        if (y > 720) {
          doc.addPage();
          y = PAGE_LEFT;
        }

        const productName = item.product?.name ?? "—";
        const sku = item.product?.sku ?? "—";
        const qty = `${item.quantity} ${item.product?.unit ?? ""}`.trim();

        doc.font("Helvetica").fontSize(10).fillColor(INK);
        const nameHeight = doc.heightOfString(productName, {
          width: colSku - colProduct - 12
        });
        const lineHeight = Math.max(rowHeight, nameHeight + 6);
        doc.text(productName, colProduct, y, {
          width: colSku - colProduct - 12
        });
        doc.text(sku, colSku, y, { width: colQty - colSku - 8 });
        doc.text(qty, colQty, y, {
          width: PAGE_RIGHT - colQty,
          align: "right"
        });

        y += lineHeight;
        doc
          .moveTo(PAGE_LEFT, y - 4)
          .lineTo(PAGE_RIGHT, y - 4)
          .lineWidth(0.5)
          .strokeColor(RULE)
          .stroke();
      }

      doc.end();
    });
  }
}
