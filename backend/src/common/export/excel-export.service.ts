import { Injectable } from "@nestjs/common";
import * as ExcelJS from "exceljs";

export type ExcelColumn = {
  header: string;
  key: string;
  width?: number;
};

@Injectable()
export class ExcelExportService {
  async buildWorkbook(columns: ExcelColumn[], rows: Record<string, unknown>[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Export");

    sheet.columns = columns.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width ?? 20
    }));

    sheet.getRow(1).font = { bold: true };
    rows.forEach((row) => sheet.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async buildGroupedWorkbook(
    columns: ExcelColumn[],
    groups: { sheetName: string; rows: Record<string, unknown>[] }[]
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    for (const group of groups) {
      const safeName = group.sheetName.replace(/[\\/*?:[\]]/g, "").slice(0, 31) || "Sheet";
      const sheet = workbook.addWorksheet(safeName);
      sheet.columns = columns.map((col) => ({
        header: col.header,
        key: col.key,
        width: col.width ?? 20
      }));
      sheet.getRow(1).font = { bold: true };
      group.rows.forEach((row) => sheet.addRow(row));
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
