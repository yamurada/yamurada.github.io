/* プライバシーポリシーのページの組み立て。文章は shop-data.js の privacy に書きます（ここはふだん触りません） */
(function () {
  var S = window.SHOP, box = document.getElementById('privacyBody');
  if (!S || !S.privacy || !box) { if (box) box.textContent = 'ページを表示できませんでした。お手数ですが、お電話でお問い合わせください。'; return; }
  var P = S.privacy;
  function plain(str) { return String(str || '').replace(/｜/g, ''); }
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  var info = [S.name, P.representative ? '代表者：' + P.representative : '', S.address, '電話 ' + S.tel].filter(Boolean).join('／');
  box.appendChild(el('p', { class: 'pp-lead' }, plain(info)));
  (P.sections || []).forEach(function (sec) {
    box.appendChild(el('h3', null, sec.h));
    (sec.p || []).forEach(function (t) { box.appendChild(el('p', null, plain(t))); });
  });
  if (P.updated) box.appendChild(el('p', { class: 'pp-date' }, '制定：' + P.updated));
  var y = document.getElementById('year'); if (y) y.textContent = new Date().getFullYear();
  document.querySelectorAll('[data-shop="name"]').forEach(function (e) { e.textContent = plain(S.name); });
})();
