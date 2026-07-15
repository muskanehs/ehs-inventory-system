import { existsSync } from "fs";
import { resolve } from "path";
import { config as loadEnv } from "dotenv";

/**
 * Load env from the process cwd and monorepo root so local runs pick up
 * inventory-system/.env when started from backend/.
 */
const candidates = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../.env"),
  resolve(__dirname, "../../../.env"),
  resolve(__dirname, "../../../../.env")
];

for (const path of candidates) {
  if (existsSync(path)) {
    loadEnv({ path, override: false });
  }
}
