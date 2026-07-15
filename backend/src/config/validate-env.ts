import "./load-env";

const PLACEHOLDER_SECRET_PATTERN = /^(change_this_|changeme|password|secret|example)/i;

function requireVar(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`[FATAL] Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

function assertNotPlaceholder(name: string, value: string) {
  if (PLACEHOLDER_SECRET_PATTERN.test(value) || value.length < 16) {
    console.error(
      `[FATAL] ${name} looks like a placeholder or is too short. Set a strong production secret (16+ chars).`
    );
    process.exit(1);
  }
}

function hasTlsInDatabaseUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes("sslmode=require") ||
    lower.includes("sslmode=verify-full") ||
    lower.includes("sslmode=verify-ca") ||
    lower.includes("ssl=true")
  );
}

/** Call before NestFactory.create / listen. Exits process on failure. */
export function validateEnv(): void {
  const nodeEnv = process.env.NODE_ENV?.trim() || "development";
  const isProduction = nodeEnv === "production";

  const databaseUrl = requireVar("DATABASE_URL");
  const jwtAccess = requireVar("JWT_ACCESS_SECRET");
  const jwtRefresh = requireVar("JWT_REFRESH_SECRET");

  if (isProduction) {
    assertNotPlaceholder("JWT_ACCESS_SECRET", jwtAccess);
    assertNotPlaceholder("JWT_REFRESH_SECRET", jwtRefresh);

    requireVar("CORS_ORIGIN");
    requireVar("REDIS_URL");

    const allowInsecureDb = process.env.DATABASE_SSL === "disable";
    if (!allowInsecureDb && !hasTlsInDatabaseUrl(databaseUrl)) {
      console.error(
        "[FATAL] DATABASE_URL must enable TLS in production (e.g. ?sslmode=require). " +
          "Set DATABASE_SSL=disable only for private non-TLS networks (not recommended)."
      );
      process.exit(1);
    }

    if (/inventory_password|localhost:5433|@localhost\b/i.test(databaseUrl) && !allowInsecureDb) {
      console.error(
        "[FATAL] DATABASE_URL appears to use local/default credentials. Use a production database URL."
      );
      process.exit(1);
    }
  }
}
