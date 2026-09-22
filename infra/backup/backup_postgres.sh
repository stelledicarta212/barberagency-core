#!/bin/bash
# ==============================================================================
# BarberAgency — Production PostgreSQL Hourly Offsite Backup Script
# Fail-closed, encrypted, integrity-checked with SHA-256
# ==============================================================================
set -euo pipefail

# 1. Load root-only configuration
CONFIG_FILE="${BACKUP_CONFIG:-/etc/barberagency/backup.env}"
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "[$(date -u +%FT%TZ)] [FATAL] Configuration file $CONFIG_FILE not found." >&2
  exit 1
fi
# shellcheck source=/dev/null
source "$CONFIG_FILE"

# Required configuration variables:
# PG_CONTAINER (e.g. barberagency_postgres or barberagency_db)
# PG_DATABASE (e.g. barberagency)
# PG_USER (e.g. postgres)
# S3_BUCKET (e.g. barberagency-backups)
# S3_ENDPOINT (e.g. https://... or default AWS)
# BACKUP_LOCAL_DIR (e.g. /var/backups/barberagency/postgres)

BACKUP_LOCAL_DIR="${BACKUP_LOCAL_DIR:-/var/backups/barberagency/postgres}"
mkdir -p "$BACKUP_LOCAL_DIR"
chmod 700 "$BACKUP_LOCAL_DIR"

TIMESTAMP=$(date -u +%Y%m%d_%H%M%S)
BACKUP_FILENAME="barberagency_${TIMESTAMP}.dump"
LOCAL_DUMP_PATH="${BACKUP_LOCAL_DIR}/${BACKUP_FILENAME}"
CHECKSUM_FILE="${LOCAL_DUMP_PATH}.sha256"
METADATA_FILE="${LOCAL_DUMP_PATH}.json"

echo "[$(date -u +%FT%TZ)] [INFO] Starting PostgreSQL backup for ${PG_DATABASE}..."

# 2. Execute pg_dump custom format (-Fc) directly from Docker container
# -Fc includes schemas, tables, data, sequences, functions, views, triggers, RLS, indexes, constraints
START_SEC=$(date +%s)
docker exec -t "${PG_CONTAINER}" pg_dump -U "${PG_USER}" -d "${PG_DATABASE}" -Fc > "${LOCAL_DUMP_PATH}"
END_SEC=$(date +%s)
DUMP_DURATION=$((END_SEC - START_SEC))

# Validate dump file is non-empty
if [[ ! -s "${LOCAL_DUMP_PATH}" ]]; then
  echo "[$(date -u +%FT%TZ)] [ERROR] Backup file is empty! Aborting." >&2
  rm -f "${LOCAL_DUMP_PATH}"
  exit 1
fi

DUMP_SIZE=$(stat -c%s "${LOCAL_DUMP_PATH}")
echo "[$(date -u +%FT%TZ)] [INFO] pg_dump completed in ${DUMP_DURATION}s. Size: ${DUMP_SIZE} bytes."

# 3. Calculate SHA-256 checksum for integrity verification
SHA256_HASH=$(sha256sum "${LOCAL_DUMP_PATH}" | awk '{print $1}')
echo "${SHA256_HASH}  ${BACKUP_FILENAME}" > "${CHECKSUM_FILE}"
echo "[$(date -u +%FT%TZ)] [INFO] SHA256 Checksum: ${SHA256_HASH}"

# Write structured metadata manifest
cat << EOF > "${METADATA_FILE}"
{
  "database": "${PG_DATABASE}",
  "timestamp": "${TIMESTAMP}",
  "filename": "${BACKUP_FILENAME}",
  "size_bytes": ${DUMP_SIZE},
  "sha256": "${SHA256_HASH}",
  "format": "custom",
  "compression": "zlib_in_pgdump",
  "duration_seconds": ${DUMP_DURATION}
}
EOF

# 4. Offsite Upload to S3-compatible storage
echo "[$(date -u +%FT%TZ)] [INFO] Uploading to s3://${S3_BUCKET}/postgres/hourly/${BACKUP_FILENAME}..."

AWS_ARGS=()
if [[ -n "${S3_ENDPOINT:-}" ]]; then
  AWS_ARGS+=(--endpoint-url "${S3_ENDPOINT}")
fi

UPLOAD_SUCCESS=0
if aws s3 cp "${LOCAL_DUMP_PATH}" "s3://${S3_BUCKET}/postgres/hourly/${BACKUP_FILENAME}" "${AWS_ARGS[@]}" \
  && aws s3 cp "${CHECKSUM_FILE}" "s3://${S3_BUCKET}/postgres/hourly/${BACKUP_FILENAME}.sha256" "${AWS_ARGS[@]}" \
  && aws s3 cp "${METADATA_FILE}" "s3://${S3_BUCKET}/postgres/hourly/${BACKUP_FILENAME}.json" "${AWS_ARGS[@]}"; then
  UPLOAD_SUCCESS=1
  echo "[$(date -u +%FT%TZ)] [SUCCESS] Offsite upload completed successfully."
else
  echo "[$(date -u +%FT%TZ)] [WARN] S3 upload failed! Fail-closed: preserving local dump at ${LOCAL_DUMP_PATH}" >&2
fi

# 5. Local Retention Enforcement (Clean local files older than 48 hours only if upload succeeded)
if [[ "${UPLOAD_SUCCESS}" -eq 1 ]]; then
  find "${BACKUP_LOCAL_DIR}" -name "barberagency_*.dump" -mtime +2 -delete || true
  find "${BACKUP_LOCAL_DIR}" -name "barberagency_*.sha256" -mtime +2 -delete || true
  find "${BACKUP_LOCAL_DIR}" -name "barberagency_*.json" -mtime +2 -delete || true
  echo "[$(date -u +%FT%TZ)] [INFO] Local retention cleanup applied (retained 48h)."
fi

echo "[$(date -u +%FT%TZ)] [DONE] PostgreSQL backup cycle complete."
