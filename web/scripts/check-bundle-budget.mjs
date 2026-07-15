import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { gzipSync } from "zlib";

const DIST_DIR = join(process.cwd(), "dist", "assets");
const MAIN_CHUNK_MAX_GZIP_KB = Number(process.env.MAIN_CHUNK_MAX_GZIP_KB ?? 400);
const ENTRY_CHUNK_MAX_GZIP_KB = Number(process.env.ENTRY_CHUNK_MAX_GZIP_KB ?? 200);

function gzipSizeKb(filePath) {
  const content = readFileSync(filePath);
  return gzipSync(content).length / 1024;
}

function listJsAssets(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".js"))
    .map((name) => ({ name, path: join(dir, name) }));
}

const assets = listJsAssets(DIST_DIR);
if (assets.length === 0) {
  console.error("No JS assets found in dist/assets. Run `npm run build` first.");
  process.exit(1);
}

const violations = [];

for (const asset of assets) {
  const gzipKb = gzipSizeKb(asset.path);
  const isEntry = asset.name.startsWith("index-");
  const limit = isEntry ? ENTRY_CHUNK_MAX_GZIP_KB : MAIN_CHUNK_MAX_GZIP_KB;

  console.log(`${asset.name}: ${gzipKb.toFixed(1)} KB gzip (limit ${limit} KB)`);

  if (gzipKb > limit) {
    violations.push(`${asset.name} ${gzipKb.toFixed(1)} KB gzip exceeds ${limit} KB`);
  }
}

if (violations.length > 0) {
  console.error("\nBundle budget exceeded:");
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}

console.log("\nBundle budget check passed.");
