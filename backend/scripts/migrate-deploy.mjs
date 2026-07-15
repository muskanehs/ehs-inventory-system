/**
 * Runs `prisma migrate deploy` with DIRECT_URL ensured.
 * If DIRECT_URL is unset, derives it from DATABASE_URL by stripping Neon "-pooler".
 */
import { spawnSync } from "node:child_process";

function resolveDirectUrl(databaseUrl, explicit) {
  if (explicit?.trim()) return explicit.trim();
  if (!databaseUrl?.trim()) return "";
  // ep-xxx-pooler.region.aws.neon.tech → ep-xxx.region.aws.neon.tech
  return databaseUrl.trim().replace(/-pooler\./gi, ".");
}

const databaseUrl = process.env.DATABASE_URL ?? "";
const directUrl = resolveDirectUrl(databaseUrl, process.env.DIRECT_URL);

if (!databaseUrl.trim()) {
  console.error("[FATAL] DATABASE_URL is required for migrations");
  process.exit(1);
}
if (!directUrl) {
  console.error("[FATAL] DIRECT_URL is required (or set DATABASE_URL so it can be derived)");
  process.exit(1);
}

if (!process.env.DIRECT_URL?.trim()) {
  console.log(
    "[migrate] DIRECT_URL not set; using derived URL from DATABASE_URL (Neon -pooler stripped if present)"
  );
}

if (/-pooler\./i.test(directUrl) || /[?&]pgbouncer=true/i.test(directUrl)) {
  console.error(
    "[FATAL] DIRECT_URL still points at a pooler. Set DIRECT_URL to Neon's direct connection string."
  );
  process.exit(1);
}

process.env.DIRECT_URL = directUrl;

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: process.env,
  shell: true
});

process.exit(result.status ?? 1);
