#!/usr/bin/env bash
set -euo pipefail

HOST="${1:-20byte-vps}"
MYSQL_PORT="${MYSQL_PORT:-3307}"
REDIS_PORT="${REDIS_PORT:-6379}"

listener_pids() {
  lsof -nP -t -iTCP:"$1" -sTCP:LISTEN 2>/dev/null | sort -u
}

MYSQL_PIDS="$(listener_pids "$MYSQL_PORT" || true)"
REDIS_PIDS="$(listener_pids "$REDIS_PORT" || true)"

if [[ -n "$MYSQL_PIDS" && -n "$REDIS_PIDS" ]]; then
  SHARED_SSH_PID="$(
    comm -12 <(printf "%s\n" "$MYSQL_PIDS") <(printf "%s\n" "$REDIS_PIDS") \
      | while read -r pid; do
          [[ -z "$pid" ]] && continue
          if [[ "$(ps -p "$pid" -o comm= | xargs)" == "ssh" ]]; then
            echo "$pid"
          fi
        done \
      | head -n1
  )"

  if [[ -n "$SHARED_SSH_PID" ]]; then
    echo "[tunnel:vps] Tunnel sudah aktif (PID $SHARED_SSH_PID)."
    echo "[tunnel:vps] Detail: $(ps -p "$SHARED_SSH_PID" -o args=)"
    exit 0
  fi
fi

if [[ -n "$MYSQL_PIDS" || -n "$REDIS_PIDS" ]]; then
  echo "[tunnel:vps] Gagal start: ada port yang sedang dipakai proses lain."
  [[ -n "$MYSQL_PIDS" ]] && lsof -nP -iTCP:"$MYSQL_PORT" -sTCP:LISTEN
  [[ -n "$REDIS_PIDS" ]] && lsof -nP -iTCP:"$REDIS_PORT" -sTCP:LISTEN
  echo "[tunnel:vps] Stop proses di atas dulu, lalu jalankan ulang: npm run tunnel:vps"
  exit 1
fi

exec ssh -N -o ExitOnForwardFailure=yes \
  -L "${MYSQL_PORT}:127.0.0.1:${MYSQL_PORT}" \
  -L "${REDIS_PORT}:127.0.0.1:${REDIS_PORT}" \
  "$HOST"
