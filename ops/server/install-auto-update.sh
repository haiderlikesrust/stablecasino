#!/usr/bin/env bash
set -euo pipefail

# Installs a systemd timer that runs the auto-updater.
#
# Run as root:
#   sudo bash /var/www/stablecasino/ops/server/install-auto-update.sh
#
# Optional environment:
#   APP_DIR=/var/www/stablecasino
#   BRANCH=master
#   REPO_USER=stablecasino
#   INTERVAL=1min

APP_DIR="${APP_DIR:-/var/www/stablecasino}"
BRANCH="${BRANCH:-master}"
REPO_USER="${REPO_USER:-stablecasino}"
INTERVAL="${INTERVAL:-1min}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash $0"
  exit 1
fi

if [[ ! -f "${APP_DIR}/ops/server/auto-update.sh" ]]; then
  echo "Missing ${APP_DIR}/ops/server/auto-update.sh"
  exit 1
fi

chmod +x "${APP_DIR}/ops/server/auto-update.sh"

cat >/etc/systemd/system/stablecasino-auto-update.service <<EOF
[Unit]
Description=StableCasino auto updater
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=${APP_DIR}
Environment=APP_DIR=${APP_DIR}
Environment=BRANCH=${BRANCH}
Environment=REPO_USER=${REPO_USER}
ExecStart=${APP_DIR}/ops/server/auto-update.sh
EOF

cat >/etc/systemd/system/stablecasino-auto-update.timer <<EOF
[Unit]
Description=Run StableCasino auto updater periodically

[Timer]
OnBootSec=2min
OnUnitActiveSec=${INTERVAL}
Persistent=true
Unit=stablecasino-auto-update.service

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now stablecasino-auto-update.timer

echo "Installed timer. Current status:"
systemctl --no-pager --full status stablecasino-auto-update.timer
echo
echo "Run now (manual trigger):"
echo "  sudo systemctl start stablecasino-auto-update.service"
echo
echo "Follow logs:"
echo "  sudo journalctl -u stablecasino-auto-update.service -f"
