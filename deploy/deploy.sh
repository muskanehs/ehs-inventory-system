#!/usr/bin/env bash
# Build + migrate + restart API. Run on the VPS from the repo root.
# Usage: ./deploy/deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if command -v docker >/dev/null 2>&1 && [[ -f docker-compose.data.yml ]]; then
  echo "==> Ensuring Postgres + Redis (Docker)"
  if [[ -f .env ]]; then
    docker compose -f docker-compose.data.yml --env-file .env up -d
  else
    docker compose -f docker-compose.data.yml up -d
  fi
fi

echo "==> Installing dependencies"
npm install

echo "==> Prisma generate + migrate"
(
  cd backend
  npx prisma generate
  npx prisma migrate deploy
)

echo "==> Building backend"
npm run build -w backend

echo "==> Building web (VITE_API_URL=/api)"
(
  cd web
  export VITE_API_URL="${VITE_API_URL:-/api}"
  npm run build
)

echo "==> Ensuring backend/logs exists"
mkdir -p backend/logs

if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe inventory-api >/dev/null 2>&1; then
    echo "==> Restarting PM2 app inventory-api"
    pm2 restart ecosystem.config.cjs --update-env
  else
    echo "==> Starting PM2 app inventory-api"
    pm2 start ecosystem.config.cjs
  fi
  pm2 save
else
  echo "WARN: pm2 not found — start manually: pm2 start ecosystem.config.cjs"
fi

echo "==> Done"
echo "    Static UI:  $ROOT/web/dist"
echo "    API (PM2):  inventory-api → http://127.0.0.1:3000"
