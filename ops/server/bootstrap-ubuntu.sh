#!/usr/bin/env bash
set -euo pipefail

# StableCasino production bootstrap for Ubuntu 22.04/24.04
# Run as root:
#   sudo bash ops/server/bootstrap-ubuntu.sh

DOMAIN="${DOMAIN:-stablecasino.fun}"
APP_USER="${APP_USER:-stablecasino}"
APP_DIR="${APP_DIR:-/var/www/stablecasino}"
BACKEND_PORT="${BACKEND_PORT:-4000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

echo "[1/8] Installing system packages..."
apt-get update
apt-get install -y \
  curl \
  git \
  nginx \
  postgresql \
  postgresql-contrib \
  certbot \
  python3-certbot-nginx \
  ufw

if ! command -v node >/dev/null 2>&1; then
  echo "[2/8] Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  echo "[2/8] Node.js already installed: $(node -v)"
fi

echo "[3/8] Enabling services..."
systemctl enable nginx
systemctl enable postgresql
systemctl start postgresql
systemctl start nginx

echo "[4/8] Configuring firewall..."
ufw allow OpenSSH || true
ufw allow 'Nginx Full' || true
ufw --force enable || true

echo "[5/8] Creating app user and directories..."
id -u "${APP_USER}" >/dev/null 2>&1 || useradd -m -s /bin/bash "${APP_USER}"
mkdir -p "${APP_DIR}"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

echo "[6/8] Installing Nginx site config..."
cat >/etc/nginx/sites-available/stablecasino <<EOF
server {
  listen 80;
  listen [::]:80;
  server_name ${DOMAIN} www.${DOMAIN};

  client_max_body_size 2m;

  location /_next/ {
    proxy_pass http://127.0.0.1:${FRONTEND_PORT};
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
  }

  location ~ ^/(auth|player|blackjack|fees|coin|config|holders|admin|health)(/|$) {
    proxy_pass http://127.0.0.1:${BACKEND_PORT};
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
  }

  location / {
    proxy_pass http://127.0.0.1:${FRONTEND_PORT};
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
  }
}
EOF

ln -sf /etc/nginx/sites-available/stablecasino /etc/nginx/sites-enabled/stablecasino
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "[7/8] Installing systemd service templates..."
cat >/etc/systemd/system/stablecasino-backend.service <<EOF
[Unit]
Description=StableCasino backend
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/backend/.env
ExecStart=/usr/bin/npm --workspace backend run start
Restart=always
RestartSec=5
KillSignal=SIGINT
SyslogIdentifier=stablecasino-backend

[Install]
WantedBy=multi-user.target
EOF

cat >/etc/systemd/system/stablecasino-frontend.service <<EOF
[Unit]
Description=StableCasino frontend
After=network.target stablecasino-backend.service
Requires=stablecasino-backend.service

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/frontend/.env
ExecStart=/usr/bin/npm --workspace frontend run start -- -p ${FRONTEND_PORT}
Restart=always
RestartSec=5
KillSignal=SIGINT
SyslogIdentifier=stablecasino-frontend

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable stablecasino-backend
systemctl enable stablecasino-frontend

echo "[8/8] Bootstrap complete."
echo
echo "Next:"
echo "  1) Put your app code at: ${APP_DIR}"
echo "  2) Run: sudo -u ${APP_USER} bash ops/server/deploy-app.sh"
echo "  3) Run SSL: sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
echo "  4) Validate: systemctl status stablecasino-backend stablecasino-frontend nginx"
