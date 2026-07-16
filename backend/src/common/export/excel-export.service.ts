import { Injectable } from "@nestjs/common";
import * as ExcelJS from "exceljs";

export type ExcelColumn = {
  header: string;
  key: string;
  width?: number;
};

export type ParsedSheetRow = Record<string, string>;

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

  async parseWorkbook(buffer: Buffer, expectedHeaders: string[]): Promise<ParsedSheetRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];

    const headerRow = sheet.getRow(1);
    const headerMap = new Map<number, string>();
    headerRow.eachCell((cell, colNumber) => {
      const normalized = String(cell.value ?? "")
        .trim()
        .toLowerCase();
      if (normalized) headerMap.set(colNumber, normalized);
    });

    const rows: ParsedSheetRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const record: ParsedSheetRow = {};
      let hasValue = false;
      row.eachCell((cell, colNumber) => {
        const key = headerMap.get(colNumber);
        if (!key) return;
        const value = String(cell.value ?? "").trim();
        if (value) hasValue = true;
        record[key] = value;
      });
      if (hasValue) rows.push(record);
    });

    const missing = expectedHeaders.filter(
      (header) => !Array.from(headerMap.values()).includes(header.toLowerCase())
    );
    if (missing.length > 0) {
      throw new Error(`Missing required columns: ${missing.join(", ")}`);
    }

    return rows;
  }

  parseCsv(buffer: Buffer, expectedHeaders: string[]): ParsedSheetRow[] {
    const text = buffer.toString("utf-8").replace(/^\uFEFF/, "");
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length === 0) return [];

    const parseLine = (line: string): string[] => {
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i += 1;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === "," && !inQuotes) {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      return values;
    };

    const headers = parseLine(lines[0]).map((h) => h.toLowerCase());
    const missing = expectedHeaders.filter((header) => !headers.includes(header.toLowerCase()));
    if (missing.length > 0) {
      throw new Error(`Missing required columns: ${missing.join(", ")}`);
    }

    const rows: ParsedSheetRow[] = [];
    for (const line of lines.slice(1)) {
      const values = parseLine(line);
      const record: ParsedSheetRow = {};
      let hasValue = false;
      headers.forEach((header, index) => {
        const value = (values[index] ?? "").trim();
        if (value) hasValue = true;
        record[header] = value;
      });
      if (hasValue) rows.push(record);
    }
    return rows;
  }
}
