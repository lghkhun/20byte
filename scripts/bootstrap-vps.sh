#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
NGINX_SITE_SOURCE="$ROOT_DIR/deploy/nginx/20byte.production.conf"
NGINX_SITE_TARGET="/etc/nginx/sites-available/20byte"
NGINX_SITE_LINK="/etc/nginx/sites-enabled/20byte"
UPSTREAM_SNIPPET="/etc/nginx/snippets/20byte-active-upstream.conf"
DEFAULT_PROXY_TARGET="${DEFAULT_PROXY_TARGET:-http://127.0.0.1:3000}"

if ! command -v sudo >/dev/null 2>&1; then
  echo "[bootstrap] sudo is required"
  exit 1
fi

if [ ! -f "$NGINX_SITE_SOURCE" ]; then
  echo "[bootstrap] missing nginx site source: $NGINX_SITE_SOURCE"
  exit 1
fi

echo "[bootstrap] ensuring nginx snippet directory exists..."
sudo install -d -m 755 /etc/nginx/snippets

if [ ! -f "$UPSTREAM_SNIPPET" ]; then
  echo "[bootstrap] writing initial upstream snippet to $DEFAULT_PROXY_TARGET"
  tmpfile="$(mktemp)"
  printf 'proxy_pass %s;\n' "$DEFAULT_PROXY_TARGET" >"$tmpfile"
  sudo install -m 644 "$tmpfile" "$UPSTREAM_SNIPPET"
  rm -f "$tmpfile"
fi

echo "[bootstrap] installing nginx site config..."
sudo install -m 644 "$NGINX_SITE_SOURCE" "$NGINX_SITE_TARGET"
sudo ln -sfn "$NGINX_SITE_TARGET" "$NGINX_SITE_LINK"

echo "[bootstrap] validating nginx configuration..."
sudo nginx -t

echo "[bootstrap] reloading nginx..."
sudo systemctl reload nginx

echo "[bootstrap] done"
