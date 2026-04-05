#!/bin/sh
set -eu

if [ "${RUN_PRISMA_MIGRATE:-0}" = "1" ]; then
  echo "[docker-entrypoint] running prisma migrate deploy..."
  npx prisma migrate deploy
fi

exec "$@"
