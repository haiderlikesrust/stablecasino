#!/usr/bin/env bash
set -euo pipefail

# Deploy/update app code on the server.
# Run as app user (not root), from repository root:
#   bash ops/server/deploy-app.sh

APP_DIR="${APP_DIR:-/var/www/stablecasino}"

if [[ ! -f "package.json" ]] || [[ ! -d "backend" ]] || [[ ! -d "frontend" ]]; then
  echo "Run this script from repo root (stablecasino/)."
  exit 1
fi

echo "[1/7] Installing dependencies..."
npm install

echo "[2/7] Preparing env files..."
if [[ ! -f backend/.env ]]; then
  cp backend/.env.example backend/.env
  echo "Created backend/.env from example. Fill it before continuing."
fi

if [[ ! -f frontend/.env ]]; then
  cp frontend/.env.example frontend/.env
fi

echo "[3/7] Applying production defaults..."
if grep -q "^NODE_ENV=" backend/.env; then
  sed -i 's/^NODE_ENV=.*/NODE_ENV=production/' backend/.env
else
  echo "NODE_ENV=production" >> backend/.env
fi

if grep -q "^CORS_ORIGIN=" backend/.env; then
  sed -i 's|^CORS_ORIGIN=.*|CORS_ORIGIN=https://stablecasino.fun,https://www.stablecasino.fun|' backend/.env
else
  echo "CORS_ORIGIN=https://stablecasino.fun,https://www.stablecasino.fun" >> backend/.env
fi

if grep -q "^NEXT_PUBLIC_API_URL=" frontend/.env; then
  sed -i 's|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=https://stablecasino.fun|' frontend/.env
else
  echo "NEXT_PUBLIC_API_URL=https://stablecasino.fun" >> frontend/.env
fi

echo "[4/7] Building backend + frontend..."
npm run build:backend
npm run build:frontend

echo "[5/7] Running Prisma generate + deploy migration..."
npm --workspace backend run prisma:generate
npm --workspace backend run prisma:deploy

echo "[6/7] Reloading services..."
sudo systemctl restart stablecasino-backend
sudo systemctl restart stablecasino-frontend

echo "[7/7] Showing service status..."
sudo systemctl --no-pager --full status stablecasino-backend stablecasino-frontend | sed -n '1,120p'

echo
echo "Deployment complete."
echo "Health check: curl -sS http://127.0.0.1:4000/health"
