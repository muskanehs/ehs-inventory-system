# Deploy on Hostinger KVM (Ubuntu) — PM2 + Apache

No firewall steps (you can skip `ufw`). Keep Nest on localhost only via Apache proxy.

## Files

| File | Purpose |
|------|---------|
| [`ecosystem.config.cjs`](../ecosystem.config.cjs) | PM2 process for Nest API |
| [`docs/apache.conf`](./apache.conf) | Apache SPA + `/api` + `/socket.io` proxy |
| [`docker-compose.data.yml`](../docker-compose.data.yml) | Postgres + Redis via Docker |
| [`deploy/deploy.sh`](../deploy/deploy.sh) | Install, build, migrate, restart PM2 |

## One-time server setup

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y apache2 git curl build-essential ca-certificates
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2

# Docker (Postgres + Redis)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
# log out and back in (or newssh) so `docker` works without sudo

sudo a2enmod rewrite proxy proxy_http proxy_wstunnel headers ssl
sudo systemctl enable --now apache2
```

```bash
sudo mkdir -p /var/www
cd /var/www
sudo git clone <YOUR_REPO_URL> inventory-system
sudo chown -R "$USER:$USER" /var/www/inventory-system
cd /var/www/inventory-system
```

Create a root **`.env`** (credentials for Compose) and **`backend/.env`** (Nest). See `.env.example` / `backend/.env.example`.

Root `.env` (used by `docker compose`):

```env
POSTGRES_DB=inventory_db
POSTGRES_USER=inventory_user
POSTGRES_PASSWORD=use_a_long_random_password
```

`backend/.env` (Nest on the host talks to Docker on localhost):

- `NODE_ENV=production`
- `PORT=3000`
- `DATABASE_URL=postgresql://inventory_user:YOUR_PASSWORD@127.0.0.1:5433/inventory_db?schema=public`
- `DIRECT_URL=` (same as `DATABASE_URL` for local Docker Postgres)
- `REDIS_URL=redis://127.0.0.1:6379`
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (long random values)
- `CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com`
- Brevo vars if password-reset OTP is needed

Start Postgres + Redis (ports bound to `127.0.0.1` only):

```bash
docker compose -f docker-compose.data.yml --env-file .env up -d
docker compose -f docker-compose.data.yml ps
```

Edit **`docs/apache.conf`**: set `ServerName`, `ServerAlias`, and `DocumentRoot` if your path/domain differ.

```bash
sudo cp docs/apache.conf /etc/apache2/sites-available/inventory.conf
sudo a2ensite inventory.conf
sudo a2dissite 000-default.conf   # optional
sudo apache2ctl configtest
sudo systemctl reload apache2

chmod +x deploy/deploy.sh
./deploy/deploy.sh
pm2 startup    # run the command it prints once
pm2 save
```

Point DNS **A** record to the VPS IP. Optional TLS:

```bash
sudo apt install -y certbot python3-certbot-apache
sudo certbot --apache -d yourdomain.com -d www.yourdomain.com
```

After HTTPS, set `CORS_ORIGIN` to the `https://` origins and reload PM2 (`pm2 restart inventory-api --update-env`).

## Updates

```bash
cd /var/www/inventory-system
git pull
docker compose -f docker-compose.data.yml --env-file .env up -d
./deploy/deploy.sh
```

## Data services

```bash
# status / logs
docker compose -f docker-compose.data.yml ps
docker compose -f docker-compose.data.yml logs -f postgres
docker compose -f docker-compose.data.yml logs -f redis

# stop / start
docker compose -f docker-compose.data.yml stop
docker compose -f docker-compose.data.yml start
```

Data lives in Docker volumes (`postgres_data`, `redis_data`). Changing `POSTGRES_PASSWORD` after the first start does not update an existing volume — set a strong password before the first `up -d`.

## Layout

```
Browser → Apache :80/:443
            ├─ /           → web/dist
            ├─ /api        → 127.0.0.1:3000 (PM2 inventory-api)
            └─ /socket.io  → 127.0.0.1:3000

Docker (localhost only)
  postgres → 127.0.0.1:5433
  redis    → 127.0.0.1:6379
```

Do not publish ports 3000, 5433, or 6379 in Hostinger’s panel; Apache should be the only public entry.
