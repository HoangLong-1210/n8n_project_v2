# Triển khai n8n Self-hosted trên Ubuntu (GĐ 1a)

Bộ file này triển khai hạ tầng theo [BRD v1.1](../docs/BRD-n8n-video-automation.md) cho
**server Ubuntu KHÔNG có IP public**:
**n8n + PostgreSQL (Docker) + nginx (host) + Cloudflare Tunnel (HTTPS, webhook) + FFmpeg + backup**, đáp ứng FR-0.1 → FR-0.5.

```
Internet ──► Cloudflare (TLS) ──tunnel──► cloudflared (host) ──► nginx :80 ──► n8n 127.0.0.1:5678
```

```
deploy/
├── docker-compose.yml   # 2 service: postgres, n8n (custom, bind 127.0.0.1:5678)
├── n8n/Dockerfile       # n8n + FFmpeg
├── nginx/n8n.conf       # reverse proxy nginx (host, chỉ nghe localhost) — TLS do Cloudflare lo
├── .env.example         # mẫu cấu hình → copy thành .env
├── scripts/backup.sh    # backup tuần, giữ 4 bản
└── local-files/         # workspace video tạm (tự tạo khi chạy)
```

---

## Yêu cầu trước khi chạy (điều kiện tiên quyết P-1)

1. Server Ubuntu (không cần IP public, không cần mở port nào — tunnel chỉ đi outbound).
2. **Một tên miền** đã đưa về quản lý DNS tại **Cloudflare** (tài khoản free):
   - Mua domain ở bất kỳ đâu (Porkbun/Namecheap ~$2-10/năm, hoặc nhà cung cấp VN).
   - Tạo tài khoản Cloudflare → Add site → đổi **nameserver** tại nơi mua về nameserver Cloudflare chỉ định.

## Bước 1 — Cài Docker (bỏ qua nếu đã có)

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # rồi logout/login lại
docker --version && docker compose version
```

## Bước 2 — Đưa thư mục `deploy/` lên server

Từ máy Windows (PowerShell), ví dụ:

```powershell
scp -r D:\claude_n8n\deploy user@IP_SERVER:~/n8n-deploy
```

## Bước 3 — Cấu hình

```bash
cd ~/n8n-deploy
cp .env.example .env

# Sinh secret rồi dán vào .env
openssl rand -base64 24   # → POSTGRES_PASSWORD
openssl rand -hex 32      # → N8N_ENCRYPTION_KEY  (LƯU RIÊNG 1 BẢN — mất là mất credentials!)

nano .env                 # điền N8N_HOST = domain của bạn + 2 secret trên
chmod +x scripts/backup.sh
```

## Bước 4 — Khởi chạy n8n

```bash
docker compose up -d --build
docker compose logs -f n8n   # chờ dòng "Editor is now accessible via..."
```

n8n lúc này chỉ nghe ở `127.0.0.1:5678` — chưa ra internet. Tiếp bước 4b.

## Bước 4b — Cài nginx (reverse proxy nội bộ)

```bash
sudo apt update && sudo apt install -y nginx

# Cài config (thay n8n.tenmien.com bằng domain thật của bạn)
sudo cp nginx/n8n.conf /etc/nginx/sites-available/n8n.conf
sudo sed -i "s/N8N_HOST_PLACEHOLDER/n8n.tenmien.com/g" /etc/nginx/sites-available/n8n.conf
sudo ln -sf /etc/nginx/sites-available/n8n.conf /etc/nginx/sites-enabled/n8n.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Không cần certbot/SSL — TLS do Cloudflare lo ở edge (bước 4c).

## Bước 4c — Cloudflare Tunnel (HTTPS + webhook, không cần IP public)

**Trên dashboard Cloudflare** (one.dash.cloudflare.com → Networks → Tunnels):
1. **Create a tunnel** → chọn `Cloudflared` → đặt tên `n8n-server` → Cloudflare hiện lệnh cài kèm **token**.
2. Tab **Public Hostname** → Add:
   - Subdomain: `n8n` · Domain: `tenmien.com`
   - Service: `HTTP` → `localhost:80`   *(trỏ vào nginx)*

**Trên server** — chạy lệnh cài mà dashboard đưa (dạng như sau):

```bash
# Cài cloudflared + đăng ký chạy nền như systemd service
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
sudo cloudflared service install <TOKEN_TỪ_DASHBOARD>

# Kiểm tra
systemctl status cloudflared
```

Mở **https://n8n.tenmien.com** từ bất kỳ đâu → tạo tài khoản owner (email + mật khẩu mạnh) ngay lần đầu.

> 💡 Sau này thêm app khác trên cùng server: chỉ cần thêm 1 file conf nginx (server_name mới)
> + thêm 1 Public Hostname trong tunnel trỏ về `localhost:80`. Không đụng gì đến n8n.

## Bước 5 — Bật backup hàng tuần (FR-0.4)

```bash
crontab -e
# Thêm dòng: backup 3h sáng Chủ nhật hàng tuần
0 3 * * 0 cd $HOME/n8n-deploy && ./scripts/backup.sh >> backups/backup.log 2>&1
```

Chạy thử ngay: `./scripts/backup.sh` — kết quả nằm trong `backups/`.

## Bước 6 — Kiểm tra nghiệm thu GĐ 1a

| # | Kiểm tra | Lệnh / cách làm |
|---|---|---|
| 1 | HTTPS hoạt động, truy cập từ xa | Mở `https://N8N_HOST` từ điện thoại (4G, không WiFi nhà) |
| 2 | Webhook nhận được từ internet | Tạo workflow Webhook test → `curl https://N8N_HOST/webhook-test/...` |
| 3 | Tự phục hồi sau reboot (FR-0.3) | `sudo reboot` → chờ 2 phút → n8n + nginx + cloudflared tự sống lại |
| 4 | FFmpeg sẵn sàng (FR-2.4) | `docker compose exec n8n ffmpeg -version` |
| 5 | Dùng Postgres, không SQLite | `docker compose exec postgres psql -U n8n -d n8n -c '\dt'` → thấy bảng n8n |
| 6 | Backup chạy được | `./scripts/backup.sh` → file trong `backups/` |
| 7 | Port 5678 KHÔNG lộ ra LAN (FR-0.5) | Từ máy khác cùng mạng: `curl -m 5 http://IP_LAN_SERVER:5678` phải **thất bại** |
| 8 | Tunnel hoạt động | `systemctl status cloudflared` → active; dashboard Cloudflare hiện tunnel **HEALTHY** |

## Vận hành thường ngày

```bash
docker compose logs -f n8n        # xem log
docker compose pull && docker compose up -d --build   # cập nhật phiên bản
docker compose restart n8n        # khởi động lại riêng n8n
```

## Khôi phục từ backup

```bash
docker compose stop n8n
gunzip -c backups/n8n_db_<STAMP>.sql.gz | docker compose exec -T postgres psql -U n8n -d n8n
docker run --rm -v n8n_n8n_data:/target -v $PWD/backups:/backup alpine \
  sh -c "rm -rf /target/* && tar xzf /backup/n8n_data_<STAMP>.tar.gz -C /target"
docker compose start n8n
```
