#!/usr/bin/env bash
set -euo pipefail

# Operational backup for Dockerized MySQL container.
# Usage:
#   BACKUP_DIR=/opt/20byte/backups ./scripts/backup/mysql-daily-backup.sh

MYSQL_CONTAINER="${MYSQL_CONTAINER:-20byte_mysql}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-password}"
MYSQL_DATABASE="${MYSQL_DATABASE:-20byte}"
BACKUP_DIR="${BACKUP_DIR:-/opt/20byte/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

TIMESTAMP="$(date +%F_%H-%M-%S)"
mkdir -p "${BACKUP_DIR}"

BACKUP_FILE="${BACKUP_DIR}/20byte-${TIMESTAMP}.sql.gz"

docker exec "${MYSQL_CONTAINER}" sh -lc \
  "mysqldump -u${MYSQL_USER} -p${MYSQL_PASSWORD} ${MYSQL_DATABASE}" \
  | gzip > "${BACKUP_FILE}"

# Keep operational backup directory bounded.
find "${BACKUP_DIR}" -type f -name "20byte-*.sql.gz" -mtime +"${RETENTION_DAYS}" -delete

echo "Backup written to ${BACKUP_FILE}"
