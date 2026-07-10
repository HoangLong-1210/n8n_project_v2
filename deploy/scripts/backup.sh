#!/usr/bin/env bash
# ==========================================================
# Backup n8n (FR-0.4, NFR-5): dump PostgreSQL + volume n8n_data
# Giữ 4 bản gần nhất. Chạy hàng tuần qua cron (xem README).
# Chạy từ thư mục deploy/:  ./scripts/backup.sh
# ==========================================================
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${DEPLOY_DIR}/backups"
STAMP="$(date +%Y%m%d_%H%M%S)"
KEEP=4

mkdir -p "${BACKUP_DIR}"
cd "${DEPLOY_DIR}"

# Đọc biến từ .env
set -a; source .env; set +a

echo "[1/3] Dump PostgreSQL..."
docker compose exec -T postgres pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" \
  | gzip > "${BACKUP_DIR}/n8n_db_${STAMP}.sql.gz"

echo "[2/3] Backup volume n8n_data (settings, encryption key)..."
docker run --rm \
  -v n8n_n8n_data:/source:ro \
  -v "${BACKUP_DIR}":/backup \
  alpine tar czf "/backup/n8n_data_${STAMP}.tar.gz" -C /source .

echo "[3/3] Xóa bản cũ, giữ ${KEEP} bản gần nhất mỗi loại..."
ls -1t "${BACKUP_DIR}"/n8n_db_*.sql.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
ls -1t "${BACKUP_DIR}"/n8n_data_*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f

echo "✅ Backup xong: ${BACKUP_DIR}"
ls -lh "${BACKUP_DIR}"
