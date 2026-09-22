#!/bin/bash
# ==============================================================================
# BarberAgency — WordPress Database & Uploads Offsite Backup Script
# Backs up MariaDB/MySQL database + wp-content/uploads tarball to S3
# ==============================================================================
set -euo pipefail

CONFIG_FILE="${BACKUP_CONFIG:-/etc/barberagency/backup.env}"
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "[$(date -u +%FT%TZ)] [FATAL] Configuration file $CONFIG_FILE not found." >&2
  exit 1
fi
# shellcheck source=/dev/null
source "$CONFIG_FILE"

WP_BACKUP_LOCAL_DIR="${WP_BACKUP_LOCAL_DIR:-/var/backups/barberagency/wordpress}"
mkdir -p "$WP_BACKUP_LOCAL_DIR"
chmod 700 "$WP_BACKUP_LOCAL_DIR"

TIMESTAMP=$(date -u +%Y%m%d_%H%M%S)
WP_DB_FILE="${WP_BACKUP_LOCAL_DIR}/wp_db_${TIMESTAMP}.sql.gz"
WP_UPLOADS_FILE="${WP_BACKUP_LOCAL_DIR}/wp_uploads_${TIMESTAMP}.tar.gz"

echo "[$(date -u +%FT%TZ)] [INFO] Starting WordPress backup..."

# 1. Dump WordPress Database
docker exec -t "${WP_CONTAINER}" mysqldump -u "${WP_DB_USER}" -p"${WP_DB_PASS}" "${WP_DB_NAME}" | gzip > "${WP_DB_FILE}"
echo "[$(date -u +%FT%TZ)] [INFO] WordPress database dump completed: $(stat -c%s "${WP_DB_FILE}") bytes."

# 2. Archive wp-content/uploads
docker exec -t "${WP_CONTAINER}" tar -czf - -C /var/www/html/wp-content uploads > "${WP_UPLOADS_FILE}" || true
echo "[$(date -u +%FT%TZ)] [INFO] wp-content/uploads archive completed: $(stat -c%s "${WP_UPLOADS_FILE}") bytes."

# 3. Checksums
sha256sum "${WP_DB_FILE}" > "${WP_DB_FILE}.sha256"
sha256sum "${WP_UPLOADS_FILE}" > "${WP_UPLOADS_FILE}.sha256"

# 4. S3 Upload
AWS_ARGS=()
if [[ -n "${S3_ENDPOINT:-}" ]]; then
  AWS_ARGS+=(--endpoint-url "${S3_ENDPOINT}")
fi

aws s3 cp "${WP_DB_FILE}" "s3://${S3_BUCKET}/wordpress/daily/wp_db_${TIMESTAMP}.sql.gz" "${AWS_ARGS[@]}"
aws s3 cp "${WP_DB_FILE}.sha256" "s3://${S3_BUCKET}/wordpress/daily/wp_db_${TIMESTAMP}.sql.gz.sha256" "${AWS_ARGS[@]}"
aws s3 cp "${WP_UPLOADS_FILE}" "s3://${S3_BUCKET}/wordpress/daily/wp_uploads_${TIMESTAMP}.tar.gz" "${AWS_ARGS[@]}"
aws s3 cp "${WP_UPLOADS_FILE}.sha256" "s3://${S3_BUCKET}/wordpress/daily/wp_uploads_${TIMESTAMP}.tar.gz.sha256" "${AWS_ARGS[@]}"

# 5. Local Retention (7 days for daily WordPress backups)
find "${WP_BACKUP_LOCAL_DIR}" -name "wp_*.gz" -mtime +7 -delete || true
find "${WP_BACKUP_LOCAL_DIR}" -name "wp_*.sha256" -mtime +7 -delete || true

echo "[$(date -u +%FT%TZ)] [DONE] WordPress backup cycle complete."
