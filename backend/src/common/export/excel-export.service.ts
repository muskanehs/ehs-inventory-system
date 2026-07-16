import { BadRequestException, Injectable } from "@nestjs/common";
import { Response } from "express";
import * as ExcelJS from "exceljs";

export type ExcelColumn = {
  header: string;
  key: string;
  width?: number;
};

export type ParsedSheetRow = Record<string, string>;

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Normalize ExcelJS cell values (formulas, rich text, dates) to plain strings. */
function cellToString(value: ExcelJS.CellValue | null | undefined): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray((value as ExcelJS.CellRichTextValue).richText)) {
      return (value as ExcelJS.CellRichTextValue).richText
        .map((part) => part.text ?? "")
        .join("")
        .trim();
    }
    if ("text" in value && typeof (value as ExcelJS.CellHyperlinkValue).text === "string") {
      return String((value as ExcelJS.CellHyperlinkValue).text).trim();
    }
    if ("result" in value) {
      const result = (value as ExcelJS.CellFormulaValue).result;
      if (result != null && typeof result !== "object") {
        return String(result).trim();
      }
      if (result && typeof result === "object" && "error" in result) {
        return "";
      }
      return cellToString(result as ExcelJS.CellValue);
    }
    if ("sharedString" in value) {
      return String((value as { sharedString?: string }).sharedString ?? "").trim();
    }
    if ("error" in value) {
      return "";
    }
  }
  return String(value).trim();
}

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

  /**
   * Send a complete XLSX buffer with correct binary headers.
   * Uses res.end(Buffer) to avoid charset encoding of the body.
   */
  sendExcelFile(res: Response, buffer: Buffer, filename: string): void {
    const safeName = filename.replace(/[^\w.\-() ]+/g, "_");
    res.setHeader("Content-Type", XLSX_MIME);
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    res.setHeader("Content-Length", String(buffer.length));
    res.end(buffer);
  }

  async parseWorkbook(buffer: Buffer, expectedHeaders: string[]): Promise<ParsedSheetRow[]> {
    if (!buffer?.length) {
      throw new BadRequestException("Invalid or corrupted Excel file");
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    } catch {
      throw new BadRequestException("Invalid or corrupted Excel file");
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException("Workbook has no sheets");
    }

    const headerRow = sheet.getRow(1);
    const headerMap = new Map<number, string>();
    headerRow.eachCell((cell, colNumber) => {
      const normalized = cellToString(cell.value).toLowerCase();
      if (normalized) headerMap.set(colNumber, normalized);
    });

    if (headerMap.size === 0) {
      throw new BadRequestException("Invalid headers: first row is empty");
    }

    const rows: ParsedSheetRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const record: ParsedSheetRow = {};
      let hasValue = false;
      row.eachCell((cell, colNumber) => {
        const key = headerMap.get(colNumber);
        if (!key) return;
        const value = cellToString(cell.value);
        if (value) hasValue = true;
        record[key] = value;
      });
      if (hasValue) rows.push(record);
    });

    const missing = expectedHeaders.filter(
      (header) => !Array.from(headerMap.values()).includes(header.toLowerCase())
    );
    if (missing.length > 0) {
      throw new BadRequestException(`Missing required columns: ${missing.join(", ")}`);
    }

    return rows;
  }

  parseCsv(buffer: Buffer, expectedHeaders: string[]): ParsedSheetRow[] {
    if (!buffer?.length) {
      throw new BadRequestException("Invalid or empty CSV file");
    }

    const text = buffer.toString("utf-8").replace(/^\uFEFF/, "");
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length === 0) {
      throw new BadRequestException("Invalid or empty CSV file");
    }

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
    if (headers.length === 0 || headers.every((h) => !h)) {
      throw new BadRequestException("Invalid headers: first row is empty");
    }

    const missing = expectedHeaders.filter((header) => !headers.includes(header.toLowerCase()));
    if (missing.length > 0) {
      throw new BadRequestException(`Missing required columns: ${missing.join(", ")}`);
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
