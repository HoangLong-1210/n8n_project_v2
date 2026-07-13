# Image n8n custom: thêm FFmpeg cho bước hậu kỳ video (FR-2.4)
#
# Lưu ý: n8nio/n8n hiện dựa trên Docker Hardened Images (Alpine tối giản,
# KHÔNG có apk/apt-get) — không thể cài gói trực tiếp. Giải pháp: copy
# binary FFmpeg tĩnh từ image mwader/static-ffmpeg (multi-stage build).
FROM mwader/static-ffmpeg:7.1 AS ffmpeg

FROM n8nio/n8n:latest
COPY --from=ffmpeg /ffmpeg  /usr/local/bin/ffmpeg
COPY --from=ffmpeg /ffprobe /usr/local/bin/ffprobe
