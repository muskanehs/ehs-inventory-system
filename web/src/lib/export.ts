import { api } from "@/lib/api";

export async function uploadImport(path: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  // Do not set Content-Type manually — the browser must add the multipart boundary.
  const response = await api.post(path, formData);
  return response.data.data as {
    created: number;
    skipped: number;
    errors: { row: number; message: string }[];
  };
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
