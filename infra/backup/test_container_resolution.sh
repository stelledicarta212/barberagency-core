#!/bin/bash
# ==============================================================================
# BarberAgency — Backup Container Resolution & Tool Diagnostics Script
# Validates dynamic Docker container discovery and binary availability
# without executing data backups or modifying production runtime.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${BACKUP_CONFIG:-/etc/barberagency/backup.env}"

if [[ -f "$CONFIG_FILE" ]]; then
  echo "[INFO] Loading configuration from ${CONFIG_FILE}..."
  # shellcheck source=/dev/null
  set -a
  source "$CONFIG_FILE"
  set +a
else
  echo "[INFO] No config file at ${CONFIG_FILE}; evaluating with environment defaults."
fi

# Ensure Docker daemon is accessible
if ! docker ps >/dev/null 2>&1; then
  echo "[FATAL] Docker daemon is not accessible or insufficient permissions." >&2
  exit 1
fi

FAILURES=0

echo "=================================================="
echo "BARBERAGENCY — CONTAINER RESOLUTION DIAGNOSTIC"
echo "=================================================="

# ------------------------------------------------------------------------------
# 1. PostgreSQL Resolution (ancestor=postgres:17)
# ------------------------------------------------------------------------------
POSTGRES_FILTER="ancestor=postgres:17"
POSTGRES_MATCHES=()
while IFS= read -r line; do
  [[ -n "$line" ]] && POSTGRES_MATCHES+=("$line")
done < <(docker ps --filter "${POSTGRES_FILTER}" --format "{{.Names}}")

POSTGRES_COUNT="${#POSTGRES_MATCHES[@]}"
POSTGRES_CONTAINER=""
POSTGRES_TOOL=""

if [[ -n "${PG_CONTAINER:-}" ]]; then
  POSTGRES_DISCOVERY="OVERRIDE (${PG_CONTAINER})"
  POSTGRES_CONTAINER="${PG_CONTAINER}"
else
  POSTGRES_DISCOVERY="DYNAMIC (${POSTGRES_FILTER})"
  if [[ "${POSTGRES_COUNT}" -eq 1 ]]; then
    POSTGRES_CONTAINER="${POSTGRES_MATCHES[0]}"
  fi
fi

if [[ -n "${POSTGRES_CONTAINER}" ]] && docker inspect "${POSTGRES_CONTAINER}" >/dev/null 2>&1; then
  POSTGRES_TOOL=$(docker exec "${POSTGRES_CONTAINER}" which pg_dump 2>/dev/null || echo "NOT_FOUND")
  if [[ "${POSTGRES_TOOL}" == "NOT_FOUND" ]]; then
    echo "[ERROR] pg_dump not found in PostgreSQL container (${POSTGRES_CONTAINER})." >&2
    FAILURES=$((FAILURES + 1))
  fi
else
  echo "[ERROR] PostgreSQL container resolution failed. Matches count: ${POSTGRES_COUNT}." >&2
  FAILURES=$((FAILURES + 1))
fi

echo "POSTGRES_DISCOVERY   = ${POSTGRES_DISCOVERY}"
echo "POSTGRES_CONTAINER   = ${POSTGRES_CONTAINER:-NONE}"
echo "POSTGRES_MATCHES     = ${POSTGRES_COUNT}"
echo "POSTGRES_TOOL        = ${POSTGRES_TOOL:-NONE}"
echo "POSTGRES_FAIL_CLOSED = YES"
echo "--------------------------------------------------"

# ------------------------------------------------------------------------------
# 2. WordPress App Container Resolution (ancestor=easypanel/barberagency/barberagency:latest)
# ------------------------------------------------------------------------------
WP_FILTER="ancestor=easypanel/barberagency/barberagency:latest"
WP_MATCHES=()
while IFS= read -r line; do
  [[ -n "$line" ]] && WP_MATCHES+=("$line")
done < <(docker ps --filter "${WP_FILTER}" --format "{{.Names}}")

WP_COUNT="${#WP_MATCHES[@]}"
WORDPRESS_CONTAINER=""
WP_TOOL=""

if [[ -n "${WP_CONTAINER:-}" ]]; then
  WORDPRESS_DISCOVERY="OVERRIDE (${WP_CONTAINER})"
  WORDPRESS_CONTAINER="${WP_CONTAINER}"
else
  WORDPRESS_DISCOVERY="DYNAMIC (${WP_FILTER})"
  if [[ "${WP_COUNT}" -eq 1 ]]; then
    WORDPRESS_CONTAINER="${WP_MATCHES[0]}"
  fi
fi

if [[ -n "${WORDPRESS_CONTAINER}" ]] && docker inspect "${WORDPRESS_CONTAINER}" >/dev/null 2>&1; then
  WP_TOOL=$(docker exec "${WORDPRESS_CONTAINER}" which tar 2>/dev/null || echo "NOT_FOUND")
  if [[ "${WP_TOOL}" == "NOT_FOUND" ]]; then
    echo "[ERROR] tar not found in WordPress container (${WORDPRESS_CONTAINER})." >&2
    FAILURES=$((FAILURES + 1))
  fi
else
  echo "[ERROR] WordPress app container resolution failed. Matches count: ${WP_COUNT}." >&2
  FAILURES=$((FAILURES + 1))
fi

echo "WORDPRESS_DISCOVERY  = ${WORDPRESS_DISCOVERY}"
echo "WORDPRESS_CONTAINER  = ${WORDPRESS_CONTAINER:-NONE}"
echo "WORDPRESS_MATCHES    = ${WP_COUNT}"
echo "WORDPRESS_TOOL       = ${WP_TOOL:-NONE}"
echo "WORDPRESS_FAIL_CLOSED= YES"
echo "--------------------------------------------------"

# ------------------------------------------------------------------------------
# 3. MariaDB Container Resolution (ancestor=mariadb:11)
# ------------------------------------------------------------------------------
MARIADB_FILTER="ancestor=mariadb:11"
MARIADB_MATCHES=()
while IFS= read -r line; do
  [[ -n "$line" ]] && MARIADB_MATCHES+=("$line")
done < <(docker ps --filter "${MARIADB_FILTER}" --format "{{.Names}}")

MARIADB_COUNT="${#MARIADB_MATCHES[@]}"
MARIADB_CONTAINER=""
MARIADB_TOOL=""

if [[ -n "${WP_DB_CONTAINER:-}" ]]; then
  MARIADB_DISCOVERY="OVERRIDE (${WP_DB_CONTAINER})"
  MARIADB_CONTAINER="${WP_DB_CONTAINER}"
else
  MARIADB_DISCOVERY="DYNAMIC (${MARIADB_FILTER})"
  if [[ "${MARIADB_COUNT}" -eq 1 ]]; then
    MARIADB_CONTAINER="${MARIADB_MATCHES[0]}"
  fi
fi

if [[ -n "${MARIADB_CONTAINER}" ]] && docker inspect "${MARIADB_CONTAINER}" >/dev/null 2>&1; then
  MARIADB_TOOL=$(docker exec "${MARIADB_CONTAINER}" which mariadb-dump 2>/dev/null || \
                docker exec "${MARIADB_CONTAINER}" which mysqldump 2>/dev/null || \
                echo "NOT_FOUND")
  if [[ "${MARIADB_TOOL}" == "NOT_FOUND" ]]; then
    echo "[ERROR] Neither mariadb-dump nor mysqldump found in MariaDB container (${MARIADB_CONTAINER})." >&2
    FAILURES=$((FAILURES + 1))
  fi
else
  echo "[ERROR] MariaDB container resolution failed. Matches count: ${MARIADB_COUNT}." >&2
  FAILURES=$((FAILURES + 1))
fi

echo "MARIADB_DISCOVERY    = ${MARIADB_DISCOVERY}"
echo "MARIADB_CONTAINER    = ${MARIADB_CONTAINER:-NONE}"
echo "MARIADB_MATCHES      = ${MARIADB_COUNT}"
echo "MARIADB_TOOL         = ${MARIADB_TOOL:-NONE}"
echo "MARIADB_FAIL_CLOSED  = YES"
echo "--------------------------------------------------"

echo "WP_DB_EXECUTION_TARGET      = MARIADB_CONTAINER"
echo "WP_UPLOADS_EXECUTION_TARGET = WORDPRESS_CONTAINER"
echo "OPTIONAL_OVERRIDES_SUPPORTED = YES (PG_CONTAINER, WP_CONTAINER, WP_DB_CONTAINER)"
echo "=================================================="

# ------------------------------------------------------------------------------
# 4. Optional Backup Script --dry-run Integration Check
# ------------------------------------------------------------------------------
if [[ "${1:-}" == "--run-scripts" ]] || [[ "${1:-}" == "--all" ]]; then
  echo "[INFO] Running backup_postgres.sh --dry-run..."
  "${SCRIPT_DIR}/backup_postgres.sh" --dry-run

  echo "[INFO] Running backup_wordpress.sh --dry-run..."
  "${SCRIPT_DIR}/backup_wordpress.sh" --dry-run
fi

if [[ "${FAILURES}" -gt 0 ]]; then
  echo "RESULT = FAIL (${FAILURES} error(s) detected)"
  exit 1
else
  echo "RESULT = PASS"
  exit 0
fi
