import { api } from "@/lib/api";

export type ImportRowIssue = {
  row: number;
  message: string;
};

export type ImportSummary = {
  created: number;
  skipped: number;
  errors: ImportRowIssue[];
  skippedRows?: ImportRowIssue[];
};

export async function uploadImport(path: string, file: File): Promise<ImportSummary> {
  const formData = new FormData();
  formData.append("file", file);
  // Do not set Content-Type manually — the browser must add the multipart boundary.
  const response = await api.post(path, formData);
  return response.data.data as ImportSummary;
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Downloads a CSV listing every failed/skipped import row when issues exist. */
export function downloadImportIssueReport(
  kind: "products" | "stock",
  summary: ImportSummary
): boolean {
  const issues = [
    ...summary.errors.map((item) => ({
      row: item.row,
      status: "failed" as const,
      message: item.message
    })),
    ...(summary.skippedRows ?? []).map((item) => ({
      row: item.row,
      status: "skipped" as const,
      message: item.message
    }))
  ].sort((a, b) => a.row - b.row);

  if (issues.length === 0) return false;

  const lines = [
    "row,status,issue",
    ...issues.map(
      (item) => `${item.row},${item.status},${escapeCsvCell(item.message)}`
    ),
    "",
    `# Summary: ${summary.created} imported, ${summary.skipped} skipped, ${summary.errors.length} failed`
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date()
    .toISOString()
    .slice(0, 19)
    .replace(/[:T]/g, (ch) => (ch === "T" ? "-" : ch === ":" ? "" : ""));
  link.href = url;
  link.download = `${kind}-import-issues-${stamp}.csv`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
  return true;
}

type ExportParams = Record<string, string | undefined>;

async function downloadBlob(response: { data: Blob; headers: unknown }, filename: string) {
  const headers = response.headers as Record<string, string | undefined>;
  const contentType = headers["content-type"] ?? "";

  if (contentType.includes("application/json")) {
    const text = await response.data.text();
    let message = "Download failed";
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
      if (typeof parsed.error === "string") message = parsed.error;
      else if (parsed.error && typeof parsed.error === "object" && parsed.error.message) {
        message = parsed.error.message;
      } else if (parsed.message) {
        message = parsed.message;
      }
    } catch {
      if (text) message = text;
    }
    throw new Error(message);
  }

  const mime =
    contentType && !contentType.includes("application/json")
      ? contentType.split(";")[0].trim()
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const blob =
    response.data.type && response.data.type !== ""
      ? response.data
      : new Blob([response.data], { type: mime });

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export async function downloadExport(
  path: string,
  filename: string,
  params?: ExportParams
) {
  const response = await api.get(path, {
    params: { format: "xlsx", ...params },
    responseType: "blob"
  });
  await downloadBlob(response, filename);
}

export async function downloadDispatchSlip(transferId: string) {
  const response = await api.get(`/transfers/${transferId}/dispatch-slip`, {
    responseType: "blob"
  });
  await downloadBlob(response, "dispatch-slip.pdf");
}

export async function downloadTransferSlip(transferId: string) {
  const response = await api.get(`/transfers/${transferId}/transfer-slip`, {
    responseType: "blob"
  });
  await downloadBlob(response, "transfer-slip.pdf");
}
