#!/bin/bash
# ==============================================================================
# BarberAgency — WordPress Database & Uploads Offsite Backup Script
# Resilient to EasyPanel dynamic container names:
# - MariaDB database dump executed from MariaDB container (mariadb:11)
# - wp-content/uploads tarball executed from WordPress app container
# ==============================================================================
set -euo pipefail

CONFIG_FILE="${BACKUP_CONFIG:-/etc/barberagency/backup.env}"
if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$CONFIG_FILE"
elif [[ "${1:-}" != "--dry-run" ]]; then
  echo "[$(date -u +%FT%TZ)] [FATAL] Configuration file $CONFIG_FILE not found." >&2
  exit 1
else
  echo "[$(date -u +%FT%TZ)] [WARN] Configuration file $CONFIG_FILE not found; proceeding in dry-run mode." >&2
fi

# Required configuration variables (for backup execution):
# WP_DB_NAME (e.g. wordpress)
# WP_DB_USER (e.g. root)
# WP_DB_PASS (database password from backup.env)
# S3_BUCKET (e.g. barberagency-backups)
# S3_ENDPOINT (optional custom S3 endpoint)
# WP_BACKUP_LOCAL_DIR (e.g. /var/backups/barberagency/wordpress)
# Optional overrides:
# WP_CONTAINER (if unset, auto-detected via ancestor=easypanel/barberagency/barberagency:latest)
# WP_DB_CONTAINER (if unset, auto-detected via ancestor=mariadb:11)

resolve_wordpress_container() {
  if [[ -n "${WP_CONTAINER:-}" ]]; then
    echo "[$(date -u +%FT%TZ)] [INFO] Using explicit WP_CONTAINER override: ${WP_CONTAINER}" >&2
    echo "${WP_CONTAINER}"
    return 0
  fi

  echo "[$(date -u +%FT%TZ)] [INFO] Resolving WordPress app container dynamically (filter: ancestor=easypanel/barberagency/barberagency:latest)..." >&2
  local matches=()
  while IFS= read -r line; do
    [[ -n "$line" ]] && matches+=("$line")
  done < <(docker ps --filter "ancestor=easypanel/barberagency/barberagency:latest" --format "{{.Names}}")

  local count="${#matches[@]}"
  if [[ "${count}" -eq 0 ]]; then
    echo "[$(date -u +%FT%TZ)] [FATAL] No running WordPress container found matching ancestor=easypanel/barberagency/barberagency:latest. Fail-closed." >&2
    exit 1
  elif [[ "${count}" -gt 1 ]]; then
    echo "[$(date -u +%FT%TZ)] [FATAL] Ambiguous WordPress containers found (${count}): ${matches[*]}. Fail-closed." >&2
    exit 1
  fi

  local resolved="${matches[0]}"
  echo "[$(date -u +%FT%TZ)] [INFO] Resolved WordPress app container: ${resolved}" >&2
  echo "${resolved}"
}

resolve_mariadb_container() {
  if [[ -n "${WP_DB_CONTAINER:-}" ]]; then
    echo "[$(date -u +%FT%TZ)] [INFO] Using explicit WP_DB_CONTAINER override: ${WP_DB_CONTAINER}" >&2
    echo "${WP_DB_CONTAINER}"
    return 0
  fi

  echo "[$(date -u +%FT%TZ)] [INFO] Resolving MariaDB container dynamically (filter: ancestor=mariadb:11)..." >&2
  local matches=()
  while IFS= read -r line; do
    [[ -n "$line" ]] && matches+=("$line")
  done < <(docker ps --filter "ancestor=mariadb:11" --format "{{.Names}}")

  local count="${#matches[@]}"
  if [[ "${count}" -eq 0 ]]; then
    echo "[$(date -u +%FT%TZ)] [FATAL] No running MariaDB container found matching ancestor=mariadb:11. Fail-closed." >&2
    exit 1
  elif [[ "${count}" -gt 1 ]]; then
    echo "[$(date -u +%FT%TZ)] [FATAL] Ambiguous MariaDB containers found (${count}): ${matches[*]}. Fail-closed." >&2
    exit 1
  fi

  local resolved="${matches[0]}"
  echo "[$(date -u +%FT%TZ)] [INFO] Resolved MariaDB container: ${resolved}" >&2
  echo "${resolved}"
}

RESOLVED_WP_CONTAINER=$(resolve_wordpress_container)
RESOLVED_WP_DB_CONTAINER=$(resolve_mariadb_container)

# Support dry-run mode for container resolution and tool verification without executing backup
if [[ "${1:-}" == "--dry-run" ]]; then
  echo "[$(date -u +%FT%TZ)] [DRY-RUN] Target WordPress container: ${RESOLVED_WP_CONTAINER}"
  echo "[$(date -u +%FT%TZ)] [DRY-RUN] Target MariaDB container: ${RESOLVED_WP_DB_CONTAINER}"
  echo "[$(date -u +%FT%TZ)] [DRY-RUN] Verifying dump tool inside MariaDB container..."
  docker exec "${RESOLVED_WP_DB_CONTAINER}" which mariadb-dump || docker exec "${RESOLVED_WP_DB_CONTAINER}" which mysqldump
  echo "[$(date -u +%FT%TZ)] [DRY-RUN] Verifying tar tool inside WordPress container..."
  docker exec "${RESOLVED_WP_CONTAINER}" which tar
  echo "[$(date -u +%FT%TZ)] [DRY-RUN] Resolution and binary check successful (WORDPRESS_MATCHES=1, MARIADB_MATCHES=1)."
  exit 0
fi

WP_BACKUP_LOCAL_DIR="${WP_BACKUP_LOCAL_DIR:-/var/backups/barberagency/wordpress}"
mkdir -p "$WP_BACKUP_LOCAL_DIR"
chmod 700 "$WP_BACKUP_LOCAL_DIR"

TIMESTAMP=$(date -u +%Y%m%d_%H%M%S)
WP_DB_FILE="${WP_BACKUP_LOCAL_DIR}/wp_db_${TIMESTAMP}.sql.gz"
WP_UPLOADS_FILE="${WP_BACKUP_LOCAL_DIR}/wp_uploads_${TIMESTAMP}.tar.gz"

echo "[$(date -u +%FT%TZ)] [INFO] Starting WordPress backup (DB container: ${RESOLVED_WP_DB_CONTAINER}, App container: ${RESOLVED_WP_CONTAINER})..."

# 1. Dump WordPress Database from MariaDB container
# Use mariadb-dump if available, fallback to mysqldump
DUMP_BIN="mysqldump"
if docker exec "${RESOLVED_WP_DB_CONTAINER}" which mariadb-dump >/dev/null 2>&1; then
  DUMP_BIN="mariadb-dump"
fi

echo "[$(date -u +%FT%TZ)] [INFO] Executing ${DUMP_BIN} on ${RESOLVED_WP_DB_CONTAINER}..."
docker exec "${RESOLVED_WP_DB_CONTAINER}" "${DUMP_BIN}" -u "${WP_DB_USER}" -p"${WP_DB_PASS}" "${WP_DB_NAME}" | gzip > "${WP_DB_FILE}"
echo "[$(date -u +%FT%TZ)] [INFO] WordPress database dump completed: $(stat -c%s "${WP_DB_FILE}") bytes."

# 2. Archive wp-content/uploads from WordPress application container
echo "[$(date -u +%FT%TZ)] [INFO] Archiving wp-content/uploads from ${RESOLVED_WP_CONTAINER}..."
docker exec "${RESOLVED_WP_CONTAINER}" tar -czf - -C /var/www/html/wp-content uploads > "${WP_UPLOADS_FILE}" || true
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
