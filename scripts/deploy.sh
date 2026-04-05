#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f ".env" ]; then
  echo "[deploy] missing .env in $ROOT_DIR"
  echo "[deploy] copy .env.docker.example to .env and fill production values first"
  exit 1
fi

COMPOSE_CMD="${COMPOSE_CMD:-docker compose}"
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-20byte}"

echo "[deploy] validating docker compose config..."
$COMPOSE_CMD --project-name "$PROJECT_NAME" config >/dev/null

echo "[deploy] pulling base images..."
$COMPOSE_CMD --project-name "$PROJECT_NAME" pull mysql redis || true

echo "[deploy] building application images..."
$COMPOSE_CMD --project-name "$PROJECT_NAME" build web worker migrate

echo "[deploy] starting stack..."
$COMPOSE_CMD --project-name "$PROJECT_NAME" up -d

echo "[deploy] current status:"
$COMPOSE_CMD --project-name "$PROJECT_NAME" ps

echo "[deploy] tail logs if needed:"
echo "  $COMPOSE_CMD --project-name \"$PROJECT_NAME\" logs -f migrate web worker"
