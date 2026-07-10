# TÀI LIỆU YÊU CẦU NGHIỆP VỤ (BRD)
## Hệ thống n8n Self-hosted — Tự động hóa sản xuất & đăng video AI lên MXH

| | |
|---|---|
| **Phiên bản** | 1.1 (Draft — chờ duyệt; đổi nhà cung cấp video sang fal.ai) |
| **Ngày** | 10/07/2026 |
| **Người yêu cầu** | Chủ dự án (cá nhân) |
| **Người soạn** | BA (Claude) |

---

## 1. Tổng quan & Mục tiêu

Xây dựng một hệ thống **n8n self-hosted** trên server Ubuntu riêng, đóng vai trò nền tảng tự động hóa trung tâm. Nghiệp vụ cốt lõi của giai đoạn 1: **pipeline sản xuất video bằng AI từ ảnh + mô tả do người dùng cung cấp, duyệt qua Zalo, rồi tự động đăng lên TikTok và YouTube theo lịch.**

**Mục tiêu đo được:**
- Tự động hóa ≥ 90% quy trình từ "nhập ý tưởng vào Google Sheet" đến "video xuất hiện trên TikTok/YouTube" — người dùng chỉ can thiệp ở bước nhập liệu và bấm duyệt.
- Sản lượng: **~3–4 video/tuần (~12–16 video/tháng)**, độ dài **15–30 giây**, lồng tiếng **tiếng Việt**.
- Tổng chi phí AI: **≤ $20/tháng**.
- Workflow kích hoạt đúng lịch, độ tin cậy cao (job lỗi phải có cảnh báo, không im lặng thất bại).

---

## 2. Phạm vi

### 2.1 Trong phạm vi (Giai đoạn 1)
- Triển khai n8n self-hosted trên server Ubuntu (Docker + PostgreSQL).
- Truy cập từ xa qua HTTPS với domain riêng; nhận webhook từ internet.
- Google Sheet làm "content calendar" (đầu vào + theo dõi trạng thái).
- Pipeline AI: Claude viết kịch bản → TTS lồng tiếng Việt → model image-to-video qua **fal.ai** (mặc định tầm trung, ghi đè được từng video) → FFmpeg hậu kỳ (ghép clip, ghép tiếng, phụ đề).
- Duyệt nội dung qua **Zalo OA** (gửi preview, nhận phản hồi duyệt/từ chối qua webhook).
- Tự động đăng lên **TikTok** và **YouTube (Shorts)** theo lịch trong Sheet.
- Cập nhật trạng thái + link bài đăng về Google Sheet; cảnh báo lỗi.

### 2.2 Ngoài phạm vi (để giai đoạn sau)
- Đăng Facebook Reels, Instagram (user có nhắc FB — đưa vào backlog Giai đoạn 2).
- AI Agent trả lời bình luận, phân tích số liệu lượt xem (backlog).
- Chế độ FFmpeg-only (ảnh tĩnh + hiệu ứng, không gọi AI video) — pipeline thiết kế mở để bổ sung sau nếu cần tăng sản lượng vượt ngân sách.
- Đăng lên trang cá nhân Facebook/Zalo (API không hỗ trợ).

---

## 3. Người dùng & Bối cảnh

| Vai trò | Mô tả |
|---|---|
| **Chủ kênh (duy nhất)** | Nhập ảnh + mô tả video vào Google Sheet; duyệt video qua Zalo; theo dõi kết quả trong Sheet. Dùng điện thoại là chính khi duyệt. |
| **Hệ thống n8n** | Chạy toàn bộ pipeline tự động theo lịch/webhook. |

---

## 4. Yêu cầu chức năng

### WF-0. Hạ tầng nền (một lần)
| ID | Yêu cầu |
|---|---|
| FR-0.1 | n8n chạy bằng Docker Compose trên Ubuntu, dùng **PostgreSQL** (không dùng SQLite) để đảm bảo ổn định. |
| FR-0.2 | Server **không có IP public** → truy cập từ xa + webhook qua **Cloudflare Tunnel** (domain quản lý tại Cloudflare, TLS ở edge) → nginx trên host → n8n. Không mở port nào ra internet. |
| FR-0.3 | n8n tự khởi động lại khi server reboot hoặc container crash (`restart: always`). |
| FR-0.4 | Backup tự động database n8n + credentials (tối thiểu hàng tuần). |
| FR-0.5 | Bảo mật: n8n đặt sau xác thực (basic auth/user management), không lộ port trực tiếp ra internet ngoài reverse proxy. |

### WF-1. Tiếp nhận nội dung (Google Sheet — Content Calendar)
| ID | Yêu cầu |
|---|---|
| FR-1.1 | Google Sheet có các cột tối thiểu: `ID`, `Link ảnh (Drive)`, `Mô tả video`, `Nền tảng đích (TikTok/YouTube/cả hai)`, `Ngày giờ đăng`, `Model video` (bỏ trống = model mặc định; ghi tên model fal.ai để ghi đè), `Trạng thái`, `Link kịch bản`, `Link video`, `Link bài đăng`, `Ghi chú lỗi`. |
| FR-1.2 | n8n quét Sheet theo lịch (Schedule Trigger, ví dụ mỗi 30 phút) tìm hàng `Trạng thái = Mới`. |
| FR-1.3 | Vòng đời trạng thái: `Mới → Đang sản xuất → Chờ duyệt → Đã duyệt / Từ chối → Đã lên lịch → Đã đăng / Lỗi`. Mọi chuyển trạng thái do n8n tự cập nhật. |

### WF-2. Sản xuất video (AI Pipeline)
| ID | Yêu cầu |
|---|---|
| FR-2.1 | **Biên kịch:** Claude API nhận `Mô tả video` + ngữ cảnh ảnh → sinh (a) kịch bản lời thoại tiếng Việt ~40–80 từ (khớp 15–30s), (b) tiêu đề, (c) mô tả/caption, (d) hashtag cho từng nền tảng. |
| FR-2.2 | **Lồng tiếng:** TTS chuyển kịch bản thành audio tiếng Việt (đề xuất: Google Cloud TTS — có free tier; tùy chọn nâng cấp ElevenLabs). |
| FR-2.3 | **Tạo video:** gọi model image-to-video qua **fal.ai API** với ảnh nguồn + prompt chuyển động do Claude sinh. Model mặc định tầm trung (đề xuất **Kling**); cột `Model video` trong Sheet cho phép ghi đè từng video (model rẻ hơn như Wan/Seedance, hoặc cao cấp như Veo qua fal.ai). Video 15–30s = ghép 2–6 clip 5–10s. |
| FR-2.4 | **Hậu kỳ:** FFmpeg trên server ghép các clip, thay/phủ audio bằng lồng tiếng TTS, thêm phụ đề tiếng Việt (tùy chọn), xuất định dạng dọc 9:16, ≤ 60s, chuẩn TikTok/Shorts. |
| FR-2.5 | Video thành phẩm + kịch bản lưu vào Google Drive; link ghi ngược vào Sheet. |
| FR-2.6 | **Chốt chi phí:** hệ thống ghi nhận chi phí ước tính mỗi lần gọi fal.ai (theo bảng giá từng model) và cộng dồn theo tháng; vượt ngưỡng cấu hình (mặc định $18) thì dừng tạo mới và cảnh báo qua Zalo, tránh vỡ ngân sách. |

### WF-3. Duyệt qua Zalo
| ID | Yêu cầu |
|---|---|
| FR-3.1 | Khi video sẵn sàng, n8n gửi tin nhắn qua **Zalo OA API** tới tài khoản Zalo của chủ kênh: link xem video + tiêu đề + caption + 2 lựa chọn **Duyệt / Từ chối**. |
| FR-3.2 | Phản hồi của người dùng trả về n8n qua **Zalo OA webhook**. `Duyệt` → trạng thái `Đã lên lịch`. `Từ chối` (kèm lý do tùy chọn) → trạng thái `Từ chối`, ghi lý do vào Sheet. |
| FR-3.3 | Nếu quá 24h không phản hồi, gửi nhắc lại 1 lần; quá 48h → giữ nguyên `Chờ duyệt` (không tự đăng). **Không bao giờ đăng khi chưa duyệt.** |
| FR-3.4 | *Ràng buộc:* yêu cầu đăng ký **Zalo Official Account** + cấu hình webhook — là điều kiện tiên quyết do chủ dự án thực hiện (xem mục 7). |

### WF-4. Đăng bài tự động
| ID | Yêu cầu |
|---|---|
| FR-4.1 | Đến `Ngày giờ đăng`, n8n tự động đăng video `Đã lên lịch` lên các nền tảng đích. |
| FR-4.2 | **YouTube:** upload qua YouTube Data API v3 (OAuth2), định dạng Shorts, kèm tiêu đề/mô tả/hashtag từ Claude. |
| FR-4.3 | **TikTok:** đăng qua TikTok Content Posting API (yêu cầu TikTok Developer App được duyệt — điều kiện tiên quyết, xem mục 7 và rủi ro R-2). |
| FR-4.4 | Sau khi đăng thành công: cập nhật `Trạng thái = Đã đăng` + link bài vào Sheet, gửi xác nhận qua Zalo. |
| FR-4.5 | Đăng lỗi: retry tối đa 3 lần (giãn cách lũy tiến); vẫn lỗi → `Trạng thái = Lỗi` + chi tiết lỗi vào Sheet + cảnh báo Zalo. |

### WF-5. Giám sát & cảnh báo
| ID | Yêu cầu |
|---|---|
| FR-5.1 | Mọi workflow có Error Workflow chung: bất kỳ lỗi nào → thông báo Zalo kèm tên workflow, bước lỗi, thông điệp lỗi. |
| FR-5.2 | Báo cáo tuần (tùy chọn, nice-to-have): tổng video đã đăng, chi phí Veo ước tính, số lỗi. |

---

## 5. Yêu cầu phi chức năng

| ID | Yêu cầu |
|---|---|
| NFR-1 | **Độ tin cậy:** trigger theo lịch phải chạy đúng giờ; hệ thống chịu được reboot server không mất job (queue/state lưu trong Postgres). |
| NFR-2 | **Chi phí:** tổng chi AI ≤ $20/tháng (fal.ai ~$18 + Claude ~$1 + TTS ~free tier). Có cơ chế hard-stop (FR-2.6). |
| NFR-3 | **Bảo mật:** mọi API key/credential lưu trong n8n Credentials (mã hóa); HTTPS bắt buộc; không commit secret vào file cấu hình. |
| NFR-4 | **Khả năng mở rộng:** bước tạo video là module riêng nhận tham số `model` — thêm/đổi model fal.ai (hoặc chế độ FFmpeg-only sau này) chỉ cần sửa cấu hình, không sửa toàn bộ pipeline. |
| NFR-5 | **Vận hành:** log giữ ≥ 30 ngày; backup Postgres hàng tuần, giữ 4 bản gần nhất. |

---

## 6. Kiến trúc & Stack đề xuất

```
Internet ──► Cloudflare (TLS, domain) ──tunnel outbound──┐
┌───────── Server Ubuntu (không IP public) ──────────────┤
│  Host: cloudflared (systemd) ──► nginx :80 (localhost) │
│  Docker Compose:                                       │
│   • n8n  (bind 127.0.0.1:5678)                         │
│   • PostgreSQL (chỉ mạng nội bộ)                       │
│   • FFmpeg (trong image n8n custom)                    │
└────────────────────────────────────────────────────────┘
        ▲ webhook (Zalo OA, v.v.)  ▲ truy cập từ xa

Dịch vụ ngoài:
  Google Sheets/Drive · Claude API (biên kịch)
  fal.ai API — image-to-video, model cấu hình được (tạo video) · Google Cloud TTS (giọng Việt)
  Zalo OA API (duyệt) · YouTube Data API · TikTok Content Posting API
```

**Ước tính chi phí tháng:** fal.ai ~12–16 video × ~$1–1.5/video (model tầm trung, 15–30s) ≈ **$15–18** · Claude ≈ **<$1** · Google TTS ≈ **$0** (free tier) · TikTok/YouTube API: miễn phí → **Tổng ≈ $16–19/tháng** ✅ *(đơn giá theo bảng giá fal.ai, cập nhật lại khi triển khai)*

---

## 7. Điều kiện tiên quyết (chủ dự án chuẩn bị)

| # | Hạng mục | Ghi chú |
|---|---|---|
| P-1 | Mua 1 tên miền + đưa DNS về quản lý tại Cloudflare (free) | Bắt buộc cho Cloudflare Tunnel (webhook + HTTPS); server không cần IP public |
| P-2 | **Zalo Official Account** đã đăng ký & được duyệt | Bắt buộc cho luồng duyệt; thủ tục có thể mất vài ngày |
| P-3 | Google Cloud project: bật Sheets, Drive, YouTube Data API, Cloud TTS + billing | Một project dùng chung |
| P-4 | **TikTok Developer App** đăng ký & được duyệt quyền Content Posting | Thủ tục duyệt của TikTok có thể lâu/khắt khe |
| P-5 | Anthropic API key (Claude) | |
| P-7 | Tài khoản **fal.ai** + API key, nạp credit | Nhà cung cấp model tạo video |
| P-6 | Kênh YouTube + tài khoản TikTok đích | |

---

## 8. Rủi ro & Giảm thiểu

| ID | Rủi ro | Mức | Giảm thiểu |
|---|---|---|---|
| R-1 | Giá model trên fal.ai thay đổi / model bị gỡ → vỡ ngân sách hoặc gián đoạn | Trung bình | FR-2.6 hard-stop theo ngưỡng $; NFR-4 đổi model chỉ bằng cấu hình |
| R-2 | **TikTok API khó được duyệt** cho developer cá nhân | **Cao** | Phương án dự phòng: giai đoạn đầu n8n gửi video + caption qua Zalo để đăng TikTok thủ công (1 chạm), YouTube vẫn full tự động |
| R-3 | Zalo OA đăng ký chậm / chính sách hạn chế | Trung bình | Trong lúc chờ: duyệt tạm qua Google Sheet (đổi trạng thái) — không đổi thiết kế |
| R-4 | Video AI vi phạm chính sách nội dung nền tảng | Thấp | Bước duyệt thủ công (FR-3) là chốt chặn |
| R-5 | Server mất điện/mạng đúng giờ đăng | Thấp | Retry (FR-4.5) + job quét lại các bài `Đã lên lịch` quá hạn |

---

## 9. Lộ trình đề xuất

| Giai đoạn | Nội dung | Kết quả |
|---|---|---|
| **GĐ 1a — Nền tảng** | Docker + n8n + Postgres + HTTPS/domain + backup | Truy cập n8n từ xa an toàn |
| **GĐ 1b — Pipeline sản xuất** | Sheet → Claude → TTS → fal.ai (image-to-video) → FFmpeg → Drive | Video thành phẩm tự động từ 1 hàng Sheet |
| **GĐ 1c — Duyệt & đăng** | Zalo OA duyệt → đăng YouTube → đăng TikTok (hoặc dự phòng R-2) | Luồng end-to-end hoàn chỉnh |
| **GĐ 2 — Mở rộng (backlog)** | Facebook Reels, AI Agent trả lời bình luận, báo cáo lượt xem, chế độ FFmpeg-only tăng sản lượng | — |

---

## 10. Tiêu chí nghiệm thu (Giai đoạn 1)

1. Nhập 1 hàng mới (ảnh + mô tả + giờ đăng) vào Sheet → trong vòng 1 chu kỳ quét, hệ thống tự sản xuất video 15–30s lồng tiếng Việt và gửi Zalo xin duyệt.
2. Bấm Duyệt trên Zalo → đúng giờ đã hẹn, video xuất hiện trên YouTube Shorts (và TikTok nếu API được duyệt), Sheet cập nhật link bài + trạng thái `Đã đăng`.
3. Bấm Từ chối → hệ thống không đăng, Sheet ghi `Từ chối` + lý do.
4. Rút mạng server 5 phút rồi cắm lại → n8n tự phục hồi, không mất job.
5. Tháng chạy thử: tổng chi phí AI ghi nhận ≤ $20.
