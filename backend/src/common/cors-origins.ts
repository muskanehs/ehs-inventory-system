/** Shared CORS origin allowlist for HTTP and Socket.IO. */
export function getCorsOrigins(): string[] | boolean {
  const isProduction = process.env.NODE_ENV === "production";
  const raw = process.env.CORS_ORIGIN?.trim();

  if (raw) {
    return raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  if (isProduction) {
    return false;
  }

  return [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173"
  ];
}
