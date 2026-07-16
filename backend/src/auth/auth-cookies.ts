import { Logger } from "@nestjs/common";
import { CookieOptions, Request, Response } from "express";

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";

const ACCESS_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const logger = new Logger("AuthCookies");

function baseCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === "production";
  // Same-origin (ehsinventory.in/api) and same-site (*.ehsinventory.in) deploys:
  // SameSite=Lax is correct and works on iOS Safari. SameSite=None is only needed
  // for truly cross-site hosts (different eTLD+1) and causes Safari cookie drops.
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
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
  logger.log(
    `auth_cookies_set sameSite=${base.sameSite} secure=${base.secure} path=${base.path} hasAccess=true hasRefresh=true`
  );
}

export function clearAuthCookies(res: Response) {
  const base = baseCookieOptions();
  res.clearCookie(ACCESS_TOKEN_COOKIE, base);
  res.clearCookie(REFRESH_TOKEN_COOKIE, base);
  logger.log(
    `auth_cookies_cleared sameSite=${base.sameSite} secure=${base.secure} path=${base.path}`
  );
}

export function readCookieToken(
  cookies: Record<string, string | undefined> | undefined,
  name: string
): string | null {
  const value = cookies?.[name];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Log cookie presence only — never log token values. */
export function logAuthCookiesFromRequest(req: Request, context: string) {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  const hasAccess = Boolean(readCookieToken(cookies, ACCESS_TOKEN_COOKIE));
  const hasRefresh = Boolean(readCookieToken(cookies, REFRESH_TOKEN_COOKIE));
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : "-";
  logger.log(
    `auth_cookies_received context=${context} hasAccess=${hasAccess} hasRefresh=${hasRefresh} origin=${origin}`
  );
}
