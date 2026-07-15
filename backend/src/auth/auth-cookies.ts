import { CookieOptions, Response } from "express";

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";

const ACCESS_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function baseCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === "production";
  // Production SPA (e.g. Vercel) calling API (e.g. Render) is cross-site;
  // SameSite=Lax cookies are dropped by the browser, so login/change-password
  // appears to work in UI state but authenticated mutations never persist.
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/"
  };
}

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string }
) {
  const base = baseCookieOptions();
  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...base,
    maxAge: ACCESS_MAX_AGE_MS
  });
  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...base,
    maxAge: REFRESH_MAX_AGE_MS
  });
}

export function clearAuthCookies(res: Response) {
  const base = baseCookieOptions();
  res.clearCookie(ACCESS_TOKEN_COOKIE, base);
  res.clearCookie(REFRESH_TOKEN_COOKIE, base);
}

export function readCookieToken(
  cookies: Record<string, string | undefined> | undefined,
  name: string
): string | null {
  const value = cookies?.[name];
  return typeof value === "string" && value.length > 0 ? value : null;
}
