import { api } from "@/lib/api";

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

  const url = window.URL.createObjectURL(response.data);
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
