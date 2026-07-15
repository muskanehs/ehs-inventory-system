import { Request } from "express";
import { ACCESS_TOKEN_COOKIE, readCookieToken } from "./auth-cookies";

export function extractAccessToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7).trim();
    if (token) return token;
  }

  return readCookieToken(
    req.cookies as Record<string, string | undefined> | undefined,
    ACCESS_TOKEN_COOKIE
  );
}
