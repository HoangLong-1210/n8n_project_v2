# 🎬 n8n Video Automation — Tự động hóa sản xuất & đăng video AI

Hệ thống **n8n self-hosted** biến ảnh + mô tả thành video AI hoàn chỉnh (kịch bản, lồng tiếng Việt) và tự động đăng lên **TikTok & YouTube Shorts** theo lịch — chỉ cần nhập liệu vào Google Sheet và bấm duyệt trên Zalo.

```
Google Sheet ──► Claude viết kịch bản ──► TTS lồng tiếng Việt ──► fal.ai tạo video
(ảnh + mô tả)                                                          │
                                                              FFmpeg hậu kỳ (9:16, 15-30s)
                                                                       │
Sheet cập nhật ◄── Đăng TikTok + YouTube ◄── Duyệt qua Zalo OA ◄── Gửi preview
   kết quả            (đúng giờ hẹn)          (✅ mới được đăng)
```

## ✨ Tính năng chính

- 📋 **Google Sheet làm content calendar** — nhập ảnh, mô tả, giờ đăng; theo dõi trạng thái từng video
- 🤖 **AI pipeline hoàn chỉnh**: Claude biên kịch tiếng Việt → Google Cloud TTS lồng tiếng → fal.ai image-to-video (model thay được từng video qua cột `Model video`)
- ✅ **Duyệt trước khi đăng** qua Zalo OA — không bao giờ tự đăng khi chưa duyệt
- ⏰ **Đăng đúng lịch** lên TikTok + YouTube Shorts, retry khi lỗi, cảnh báo qua Zalo
- 💰 **Hard-stop ngân sách**: tự dừng khi chi phí AI chạm ngưỡng $18/tháng
- 🔒 **Không cần IP public**: Cloudflare Tunnel outbound — không mở port nào ra internet

## 🏗️ Kiến trúc

```
Internet ──► Cloudflare (TLS, domain) ──tunnel outbound──┐
┌───────── Server Ubuntu (không IP public) ──────────────┤
│  Host: cloudflared (systemd) ──► nginx :80 (localhost) │
│  Docker Compose:                                       │
│   • n8n  (custom image + FFmpeg, bind 127.0.0.1:5678)  │
│   • PostgreSQL (chỉ mạng nội bộ)                       │
└────────────────────────────────────────────────────────┘
```

## 📁 Cấu trúc repo

| Đường dẫn | Nội dung |
|---|---|
| [`docs/BRD-n8n-video-automation.md`](docs/BRD-n8n-video-automation.md) | **Tài liệu yêu cầu (BRD v1.1) — nguồn chân lý** của dự án: phạm vi, yêu cầu FR/NFR, rủi ro, lộ trình |
| [`deploy/`](deploy/README.md) | Hạ tầng: Docker Compose, Dockerfile n8n + FFmpeg, nginx config, backup script, **hướng dẫn triển khai từng bước** |
| `workflows/` | *(sắp có)* JSON export các workflow n8n để import |
| [`CLAUDE.md`](CLAUDE.md) | Hướng dẫn cho Claude Code khi làm việc trong repo |

## 🚀 Triển khai

Xem hướng dẫn chi tiết 6 bước + bảng nghiệm thu tại [`deploy/README.md`](deploy/README.md). Tóm tắt:

```bash
git clone https://github.com/HoangLong-1210/n8n_project_v2.git && cd n8n_project_v2/deploy
cp .env.example .env && nano .env      # điền domain + secrets
docker compose up -d --build           # n8n + PostgreSQL
# rồi cài nginx (bước 4b) + Cloudflare Tunnel (bước 4c)
```

## 🗺️ Lộ trình

- [x] **GĐ 1a — Hạ tầng**: Docker Compose, nginx, Cloudflare Tunnel, backup *(files sẵn sàng, chờ deploy)*
- [ ] **GĐ 1b — Pipeline sản xuất**: Sheet → Claude → TTS → fal.ai → FFmpeg → Drive
- [ ] **GĐ 1c — Duyệt & đăng**: Zalo OA → YouTube Shorts + TikTok → giám sát, cảnh báo
- [ ] **GĐ 2 — Mở rộng**: Facebook Reels, AI Agent trả lời bình luận, báo cáo lượt xem

## ⚙️ Dịch vụ & API sử dụng

| Dịch vụ | Vai trò | Chi phí |
|---|---|---|
| [n8n](https://n8n.io) (self-hosted) | Nền tảng workflow | Free |
| Anthropic Claude | Biên kịch, caption, hashtag tiếng Việt | ~$1/tháng |
| Google Cloud TTS | Lồng tiếng Việt | Free tier |
| [fal.ai](https://fal.ai) | Image-to-video AI (Kling/Wan/Veo...) | ~$15–18/tháng |
| Zalo OA | Duyệt nội dung | Free |
| YouTube Data API, TikTok Content Posting API | Đăng bài | Free |
| Cloudflare | Tunnel + DNS + TLS | Free |

> ⚠️ **Lưu ý bảo mật**: không commit file `.env`; `N8N_ENCRYPTION_KEY` phải lưu riêng một bản — mất key là mất toàn bộ credentials trong n8n.
