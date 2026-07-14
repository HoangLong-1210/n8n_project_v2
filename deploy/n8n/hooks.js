// =============================================================
// Custom signup cho n8n — nạp qua EXTERNAL_HOOK_FILES (xem docker-compose.yml)
// Chạy BÊN TRONG tiến trình n8n: gọi thẳng service nội bộ (UserRepository,
// PasswordUtility) nên KHÔNG cần API key, không lo key hết hạn.
//
// Endpoint:  POST /custom-signup   body JSON: { email, fullName, password }
// Kết quả:   tài khoản global:member kích hoạt ngay (đăng nhập được luôn).
// Trang UI:  /register (file tĩnh do nginx phục vụ — deploy/nginx/register.html)
//
// Lưu ý phiên bản: dùng API nội bộ của n8n (đường dẫn dist/) — nếu n8n đổi
// cấu trúc khi update image, xem log container: dòng [custom-signup] sẽ báo lỗi.
// =============================================================
const N8N_ROOT = '/usr/local/lib/node_modules/n8n';

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10000) reject(new Error('Body quá lớn'));
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new Error('JSON không hợp lệ'));
      }
    });
    req.on('error', reject);
  });
}

module.exports = {
  n8n: {
    ready: [
      async function (server) {
        const { Container } = require(`${N8N_ROOT}/node_modules/@n8n/di`);
        const { UserRepository } = require(`${N8N_ROOT}/node_modules/@n8n/db`);
        const { PasswordUtility } = require(`${N8N_ROOT}/dist/services/password.utility`);

        const app = server.app;
        app.post('/custom-signup', async (req, res) => {
          try {
            const { email, fullName, password } = await readJsonBody(req);
            const cleanEmail = String(email || '').trim().toLowerCase();
            const cleanName = String(fullName || '').trim();

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
              return res.status(400).json({ ok: false, message: 'Email không hợp lệ' });
            }
            if (!cleanName) {
              return res.status(400).json({ ok: false, message: 'Vui lòng nhập họ tên' });
            }
            if (
              typeof password !== 'string' ||
              password.length < 8 ||
              password.length > 64 ||
              !/[0-9]/.test(password) ||
              !/[A-Z]/.test(password)
            ) {
              return res.status(400).json({
                ok: false,
                message: 'Mật khẩu phải 8-64 ký tự, có ít nhất 1 chữ số và 1 chữ in hoa',
              });
            }

            // "Nguyễn Văn A" → lastName (họ) = "Nguyễn", firstName (tên) = "Văn A"
            const parts = cleanName.split(/\s+/);
            const lastName = parts[0];
            const firstName = parts.slice(1).join(' ') || parts[0];

            const userRepository = Container.get(UserRepository);
            const existing = await userRepository.findOne({ where: { email: cleanEmail } });
            if (existing) {
              return res.status(400).json({ ok: false, message: 'Email này đã được đăng ký' });
            }

            const hashed = await Container.get(PasswordUtility).hash(password);
            // createUserWithProject tạo user + personal project trong 1 transaction;
            // có mật khẩu ngay từ đầu → tài khoản không ở trạng thái pending.
            await userRepository.createUserWithProject({
              email: cleanEmail,
              firstName: firstName.slice(0, 32),
              lastName: lastName.slice(0, 32),
              password: hashed,
              roleSlug: 'global:member',
            });

            console.log(`[custom-signup] đã tạo tài khoản: ${cleanEmail}`);
            return res.json({ ok: true });
          } catch (error) {
            console.error('[custom-signup] lỗi:', error.message);
            return res.status(500).json({ ok: false, message: 'Lỗi hệ thống, vui lòng thử lại sau' });
          }
        });

        // Express đã gắn catch-all của SPA trước khi hook này chạy —
        // phải đưa layer của route mới lên ĐẦU stack, nếu không request bị nuốt.
        const router = app._router || app.router;
        if (router && Array.isArray(router.stack)) {
          const layer = router.stack.pop();
          router.stack.unshift(layer);
        }
        console.log('[custom-signup] endpoint POST /custom-signup đã đăng ký');
      },
    ],
  },
};
