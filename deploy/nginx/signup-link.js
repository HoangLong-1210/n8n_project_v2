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
    var form = document.querySelector('form');
    if (!form) return;
    var a = document.createElement('a');
    a.id = 'custom-signup-link';
    a.href = FORM_URL;
    a.textContent = 'Chưa có tài khoản? Đăng ký ngay';
    a.style.cssText =
      'display:block;text-align:center;margin-top:14px;font-weight:600;' +
      'color:#ff6d5a;text-decoration:none;font-size:14px;';
    form.appendChild(a);
  }
  setInterval(tick, 400);
})();
