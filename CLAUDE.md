# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Self-hosted n8n automation system for producing AI-generated videos (from user-supplied images + descriptions) and auto-posting them to TikTok and YouTube Shorts. The owner is a solo user; all requirements were gathered through a BA process and are recorded in **`docs/BRD-n8n-video-automation.md` (v1.1) — this is the source of truth** for scope, requirement IDs (FR-x.x, NFR-x, P-x, R-x), budget, and roadmap. Read it before making design decisions; update it when requirements change (bump the version).

**Work with the user in Vietnamese.** Documents, comments, and chat are in Vietnamese; code/config identifiers in English.

## Architecture

Two halves:

1. **`deploy/`** — infrastructure as code for a remote **Ubuntu server with NO public IP** (not this Windows machine). Ingress chain: internet → **Cloudflare Tunnel** (TLS at the edge; domain managed in Cloudflare; `cloudflared` runs on the host as a systemd service, outbound-only, no open ports) → **nginx on the host** listening on `127.0.0.1:80` (config template: `deploy/nginx/n8n.conf`, domain placeholder replaced via sed; no certbot — Cloudflare handles TLS) → n8n. Docker Compose (project name pinned to `n8n`) runs two services: PostgreSQL (internal network only, no host port) and a custom n8n image (`deploy/n8n/Dockerfile` = official image + FFmpeg) bound to `127.0.0.1:5678` only. `deploy/scripts/backup.sh` depends on the pinned project name for volume names (`n8n_n8n_data`). Secrets live only in `.env` (never committed; `.env.example` is the template). `N8N_ENCRYPTION_KEY` is irreplaceable — losing it loses all n8n credentials. SSH access to the server uses the key at `~/.ssh/id_ed25519` on this machine.

2. **n8n workflows** (GĐ 1b/1c — being built) — the video pipeline:
   - Google Sheet = content calendar and state machine. Status lifecycle: `Mới → Đang sản xuất → Chờ duyệt → Đã duyệt/Từ chối → Đã lên lịch → Đã đăng/Lỗi`. n8n polls for `Mới` rows.
   - Production: Claude API writes Vietnamese script/caption/hashtags → Google Cloud TTS voiceover → **fal.ai** image-to-video (default mid-tier model, per-row override via the Sheet's `Model video` column) → FFmpeg stitches clips + TTS audio into 9:16, 15–30s → stored in Google Drive.
   - Approval: preview sent via **Zalo OA**; approve/reject comes back through a Zalo webhook. **Never post without approval** (FR-3.3).
   - Publishing: scheduled upload to YouTube Data API and TikTok Content Posting API, 3 retries, then error status + Zalo alert. TikTok API approval is the top project risk (R-2); fallback is sending the video via Zalo for one-tap manual posting.

## Hard Constraints

- **AI budget ≤ $20/month** with an $18 hard-stop on cumulative fal.ai spend (FR-2.6) — do not design around this; enforce it in workflows.
- Output: ~3–4 videos/week, 15–30s, Vietnamese voiceover, vertical 9:16.
- The video-generation step must stay a swappable module taking a `model` parameter (NFR-4).
- Facebook/Instagram posting, comment-reply agents, and FFmpeg-only mode are explicitly **out of scope** for phase 1 (BRD §2.2) — don't add them unprompted.

## Git Workflow

- **Never develop new features directly on `main`.** For any new feature/workflow/infrastructure change, create a branch first: `feature/<short-kebab-name>` (e.g., `feature/gd1b-video-pipeline`, `feature/zalo-approval`). Small fixes to docs/typos may go straight to `main`.
- Merge back to `main` only when the feature is complete and validated (e.g., `docker compose config` passes for infra changes; workflow JSON imports cleanly for n8n changes).
- Remote: `https://github.com/HoangLong-1210/n8n_project_v2.git`. Push the feature branch to origin so work is not lost between sessions.

## Commands

Development happens on Windows; deployment targets the Ubuntu server (see `deploy/README.md` for the full 6-step deploy + acceptance checklist).

```bash
# Validate compose changes locally (Docker Desktop available on this machine)
cd deploy && docker compose --env-file .env.example config --quiet

# On the Ubuntu server
docker compose up -d --build        # deploy / apply changes
docker compose logs -f n8n          # tail n8n logs
./scripts/backup.sh                 # manual backup (cron runs it weekly)
```

n8n workflows are built in the n8n web editor on the server; when exporting them for versioning, store JSON exports under `workflows/` (create the directory when first needed).

## Current State / Roadmap

- **GĐ 1a (infrastructure): files complete**, awaiting user deployment on their server (DNS, `.env`, compose up).
- **GĐ 1b (production pipeline)** and **GĐ 1c (Zalo approval + publishing + monitoring)**: not started.
- Pending user-side prerequisites: Zalo OA registration, TikTok Developer App approval, fal.ai account, Google Cloud project (BRD §7).
