#!/usr/bin/env bash
set -euo pipefail

# Polls the remote repository for new commits and deploys if needed.
#
# Expected usage:
#   APP_DIR=/var/www/stablecasino BRANCH=master bash ops/server/auto-update.sh
#
# Environment variables:
#   APP_DIR   (default: /var/www/stablecasino)
#   BRANCH    (default: master)
#   REPO_USER (default: owner of APP_DIR, fallback: stablecasino)
#   LOCK_FILE (default: /var/lock/stablecasino-auto-update.lock)

APP_DIR="${APP_DIR:-/var/www/stablecasino}"
BRANCH="${BRANCH:-master}"
REPO_USER="${REPO_USER:-}"
LOCK_FILE="${LOCK_FILE:-/var/lock/stablecasino-auto-update.lock}"

if [[ ! -d "${APP_DIR}/.git" ]]; then
  echo "[auto-update] ${APP_DIR} is not a git repository"
  exit 1
fi

if [[ ! -f "${APP_DIR}/ops/server/deploy-app.sh" ]]; then
  echo "[auto-update] deploy script not found at ${APP_DIR}/ops/server/deploy-app.sh"
  exit 1
fi

if [[ -z "${REPO_USER}" ]]; then
  REPO_USER="$(stat -c '%U' "${APP_DIR}" 2>/dev/null || echo stablecasino)"
fi

if ! id -u "${REPO_USER}" >/dev/null 2>&1; then
  echo "[auto-update] repo user ${REPO_USER} does not exist"
  exit 1
fi

git_repo() {
  sudo -u "${REPO_USER}" -H git -C "${APP_DIR}" "$@"
}

mkdir -p "$(dirname "${LOCK_FILE}")"

{
  flock -n 9 || {
    echo "[auto-update] another update run is already active"
    exit 0
  }

  cd "${APP_DIR}"

  current_head="$(git_repo rev-parse HEAD)"
  remote_head="$(git_repo ls-remote origin "refs/heads/${BRANCH}" | awk '{print $1}')"

  if [[ -z "${remote_head}" ]]; then
    echo "[auto-update] could not resolve origin/${BRANCH}"
    exit 1
  fi

  if [[ "${current_head}" == "${remote_head}" ]]; then
    echo "[auto-update] no updates (HEAD=${current_head})"
    exit 0
  fi

  echo "[auto-update] update detected ${current_head} -> ${remote_head}"
  git_repo fetch origin "${BRANCH}"
  git_repo checkout "${BRANCH}"
  git_repo merge --ff-only "origin/${BRANCH}"

  echo "[auto-update] running deploy script"
  bash ops/server/deploy-app.sh
  echo "[auto-update] deploy complete at $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
} 9>"${LOCK_FILE}"
