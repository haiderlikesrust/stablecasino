# StableCasino production deploy (Ubuntu + Nginx)

This runbook deploys:

- Nginx reverse proxy on port 80/443
- Backend service on `127.0.0.1:4000`
- Frontend service on `127.0.0.1:3000`
- PostgreSQL on same VM
- Auto-start via systemd

## 1) DNS (already correct from your screenshot)

Make sure these A records point to `5.175.249.19`:

- `stablecasino.fun`
- `www.stablecasino.fun` (recommended)

## 2) Connect to server

```bash
ssh root@5.175.249.19
```

## 3) Clone repo on server

```bash
mkdir -p /var/www
cd /var/www
git clone <YOUR_REPO_URL> stablecasino
cd stablecasino
```

## 4) Bootstrap machine (installs Nginx, Node, PostgreSQL, certbot, systemd units)

```bash
sudo bash ops/server/bootstrap-ubuntu.sh
```

## 5) Create PostgreSQL database

```bash
sudo -u postgres psql <<'SQL'
CREATE USER stablecasino WITH PASSWORD 'CHANGE_STRONG_DB_PASSWORD';
CREATE DATABASE stablecasino OWNER stablecasino;
GRANT ALL PRIVILEGES ON DATABASE stablecasino TO stablecasino;
SQL
```

## 6) Configure app env files

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Set at minimum in `backend/.env`:

- `NODE_ENV=production`
- `DATABASE_URL=postgresql://stablecasino:<DB_PASSWORD>@localhost:5432/stablecasino?schema=public`
- `JWT_SECRET=<long-random-secret>`
- `ADMIN_PANEL_PASSWORD=<strong-password>`
- `SOLANA_RPC_URL=<your-helius-rpc>`
- `CASINO_BANKROLL_PUBLIC_KEY=<real-key>`
- `CASINO_BANKROLL_PRIVATE_KEY=<real-key>`
- `CORS_ORIGIN=https://stablecasino.fun,https://www.stablecasino.fun`

Set at minimum in `frontend/.env`:

- `NEXT_PUBLIC_API_URL=https://stablecasino.fun`

## 7) Deploy app

```bash
sudo -u stablecasino -H bash -lc 'cd /var/www/stablecasino && bash ops/server/deploy-app.sh'
```

## 8) Enable HTTPS

```bash
sudo certbot --nginx -d stablecasino.fun -d www.stablecasino.fun
```

## 9) Validate

```bash
sudo systemctl status stablecasino-backend stablecasino-frontend nginx
curl -sS http://127.0.0.1:4000/health
curl -I https://stablecasino.fun
```

## 10) Useful ops commands

```bash
sudo journalctl -u stablecasino-backend -f
sudo journalctl -u stablecasino-frontend -f
sudo systemctl restart stablecasino-backend stablecasino-frontend
sudo nginx -t && sudo systemctl reload nginx
```

## 11) Auto-update from GitHub (pull + rebuild + restart daemons)

Install once:

```bash
cd /var/www/stablecasino
sudo bash ops/server/install-auto-update.sh
```

If your repo owner is not `stablecasino`, set it explicitly:

```bash
cd /var/www/stablecasino
sudo REPO_USER=<repo-owner-user> bash ops/server/install-auto-update.sh
```

What this does:

- Every minute, checks `origin/master` for a new commit
- If changed: fast-forward pull, runs `ops/server/deploy-app.sh`
- `deploy-app.sh` rebuilds backend/frontend, runs Prisma deploy, restarts:
  - `stablecasino-backend`
  - `stablecasino-frontend`

Useful commands:

```bash
# Trigger immediately
sudo systemctl start stablecasino-auto-update.service

# Check timer
sudo systemctl status stablecasino-auto-update.timer
sudo systemctl list-timers | grep stablecasino-auto-update

# Logs
sudo journalctl -u stablecasino-auto-update.service -f
```
