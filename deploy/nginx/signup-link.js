// Thêm link "Đăng ký" vào trang đăng nhập n8n.
// Được nginx tiêm vào HTML qua sub_filter (xem n8n.conf) — không sửa gì bên trong n8n.
// n8n là SPA nên phải theo dõi liên tục: chỉ hiện link khi đang ở route /signin.
(function () {
  var FORM_URL = '/register';
  function tick() {
    var onSignin = window.location.pathname === '/signin';
    var el = document.getElementById('custom-signup-link');
    if (!onSignin) {
      if (el) el.remove();
      return;
    }
    if (el) return;
    var a = document.createElement('a');
    a.id = 'custom-signup-link';
    a.href = FORM_URL;
    a.textContent = 'Chưa có tài khoản? Đăng ký ngay';
    // Gắn vào form đăng nhập nếu có; SPA của n8n có thể không dùng thẻ <form>
    // nên luôn có phương án nút nổi cố định phía dưới card.
    var form = document.querySelector('form');
    if (form) {
      a.style.cssText =
        'display:block;text-align:center;margin-top:14px;font-weight:600;' +
        'color:#ff6d5a;text-decoration:none;font-size:14px;';
      form.appendChild(a);
    } else if (document.body) {
      a.style.cssText =
        'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);' +
        'font-weight:600;color:#ff6d5a;text-decoration:none;font-size:14px;' +
        'background:#fff;border:1px solid #e0dce8;border-radius:20px;' +
        'padding:9px 18px;box-shadow:0 2px 8px rgba(68,28,23,.08);z-index:99999;';
      document.body.appendChild(a);
    }
  }
  setInterval(tick, 400);

  // Nút "Quản trị" nổi — chỉ hiện với owner/admin, ở mọi trang trừ /signin và /register.
  var adminChecked = false;
  var isAdmin = false;
  function adminTick() {
    var path = window.location.pathname;
    var hidden = path === '/signin' || path === '/register' || path === '/admin';
    var btn = document.getElementById('custom-admin-link');
    if (!adminChecked) {
      adminChecked = true;
      fetch('/rest/login', { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          var u = j && j.data;
          isAdmin = !!(u && (u.isOwner || u.role === 'global:owner' || u.role === 'global:admin'));
        })
        .catch(function () {});
      return;
    }
    if (!isAdmin || hidden) { if (btn) btn.remove(); return; }
    if (btn) return;
    var a = document.createElement('a');
    a.id = 'custom-admin-link';
    a.href = '/admin';
    a.textContent = '⚙️ Quản trị';
    a.style.cssText =
      'position:fixed;bottom:20px;right:20px;font-weight:600;color:#fff;' +
      'text-decoration:none;font-size:13px;background:#ff6d5a;border-radius:20px;' +
      'padding:9px 16px;box-shadow:0 2px 10px rgba(255,109,90,.4);z-index:99999;';
    document.body.appendChild(a);
  }
  setInterval(adminTick, 800);
})();
