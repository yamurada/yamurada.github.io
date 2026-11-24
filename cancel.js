/* キャンセル確認ページの動き。お店の情報・文章は shop-data.js（ここはふだん触りません）
 * ・メールのURL（cancel.html#c=日付.番号.合言葉）を開くと、予約の内容を見せる。このとき、予約は消えない
 * ・「キャンセルする」ボタンを押したときだけ、キャンセルする
 * ・合言葉は URL の # のあとに入っているので、サーバーには送られない。ページの中から、予約を受け取る側（GAS）にだけ送る */
(function () {
  var S = window.SHOP, box = document.getElementById('cancelBody');
  var y = document.getElementById('year'); if (y) y.textContent = new Date().getFullYear();
  if (!box) return;
  function plain(str) { return String(str || '').replace(/｜/g, ''); }
  document.querySelectorAll('[data-shop="name"]').forEach(function (e) { e.textContent = plain(S && S.name); });
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === 'class') e.className = attrs[k]; else if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); }
    (children || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function clear() { box.textContent = ''; }
  var tel = (S && S.tel) || '', telHref = 'tel:' + String(tel).replace(/[^0-9+]/g, '');
  function telBtn() { return el('p', { class: 'more' }, [el('a', { class: 'btn', href: telHref, text: '電話する　' + tel })]); }
  function msg(lines, withTel, cls) {
    clear();
    var p = el('p', { class: 'cancel-msg' + (cls ? ' ' + cls : '') });
    lines.forEach(function (t, i) { if (i) p.appendChild(el('br')); p.appendChild(document.createTextNode(t)); });
    box.appendChild(p);
    if (withTel) box.appendChild(telBtn());
  }

  var endpoint = S && S.reserve && S.reserve.endpoint;
  var m = /^#c=([0-9]{4}-[0-9]{2}-[0-9]{2}\.[0-9]{1,4}\.[0-9a-f]{64})$/.exec(location.hash || '');
  if (!endpoint || !/^https:\/\/script\.google\.com\//.test(endpoint)) { msg(['ページを表示できませんでした。', 'お手数ですが、お電話でお問い合わせください。'], true); return; }
  if (!m) { msg(['URLが正しくありません。', 'ご予約完了のメールにあるURLを、そのまま開いてください。', 'うまくいかないときは、お電話でお願いします。'], true); return; }
  var code = m[1];

  function dateLabel(ymd) {
    var p = ymd.split('-').map(Number), w = '日月火水木金土'.charAt(new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay());
    return p[0] + '年' + p[1] + '月' + p[2] + '日（' + w + '）';
  }
  function hourLabel(h) {
    var hh = Math.floor(h + 1e-9), mm = Math.round((h - hh) * 60), m2 = (mm < 10 ? '0' : '') + mm;
    return h >= 24 ? '深夜' + (hh - 24) + ':' + m2 + '（' + hh + ':' + m2 + '）' : hh + ':' + m2;
  }
  var SEAT_TXT = { counter: 'カウンター（厨房の前）', wall: 'カウンター（壁向き）', table: 'テーブル席' }, TYPE_TXT = { seat: '席のみ', banquet: '宴会（コース）' };
  var STAY = (S.reserve && S.reserve.stayHours) || 2;

  function post(act) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);
    return fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ act: act, c: code }), signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { clearTimeout(timer); if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(function (e) { clearTimeout(timer); throw e; });
  }
  function fail(res) {
    var r = res && res.reason;
    if (r === 'nf') msg(['この予約は、見つかりませんでした。', 'すでにキャンセルされたか、お店で取り消した可能性があります。', 'ご不明な点は、お電話でお願いします。'], true);
    else if (r === 'busy') msg(['ただいま、混み合っています。', 'しばらくしてから、もう一度このページを開いてください。', 'お急ぎのときは、お電話でお願いします。'], true);
    else msg(['うまくいきませんでした。', 'お手数ですが、お電話でご確認ください。'], true);
  }
  // 「M月D日（曜）」
  function shortDate(ymd) { var p = ymd.split('-').map(Number); return p[1] + '月' + p[2] + '日（' + '日月火水木金土'.charAt(new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()) + '）'; }
  function summary(i) {
    return el('p', { class: 'sum' }, [
      '予約番号　' + i.no, el('br'),
      dateLabel(i.date), el('br'),
      hourLabel(i.h) + '〜' + hourLabel(i.h + STAY) + '（' + STAY + '時間）', el('br'),
      i.people + '名　' + (SEAT_TXT[i.seat] || '') + '／' + (TYPE_TXT[i.type] || '')
    ]);
  }
  // 当日以降：ネットではできない
  function lateView(i) {
    clear();
    box.appendChild(summary(i));
    var lines = [i.until ? 'ネットでキャンセルできる期限（' + shortDate(i.until) + 'の23:59）をすぎました。' : 'ご来店の当日になったため、ネットではキャンセルできません。', 'お手数ですが、お電話でお願いします。'];
    if (i.type === 'banquet') lines.push('宴会（コース）のご予約は、当日のキャンセルの場合、コース料金の全額をいただきます。');
    var p = el('p', { class: 'cancel-msg' });
    lines.forEach(function (t, k) { if (k) p.appendChild(el('br')); p.appendChild(document.createTextNode(t)); });
    box.appendChild(p);
    box.appendChild(telBtn());
  }

  post('cancel_info').then(function (res) {
    if (!res || !res.ok) { fail(res); return; }
    if (!res.canCancel) { lateView(res); return; }
    clear();
    box.appendChild(summary(res));
    box.appendChild(el('p', { class: 'cancel-msg' }, [res.until ? shortDate(res.until) + 'の23:59までのキャンセルなので、料金はかかりません。' : 'ご来店の前日の23:59までのキャンセルなので、料金はかかりません。', el('br'), 'この予約を、キャンセルしますか？']));
    var go = el('button', { class: 'btn cancel-go', type: 'button', text: 'この予約をキャンセルする' });
    var busy = false;
    go.addEventListener('click', function () {
      if (busy) return;
      busy = true; go.disabled = true; go.textContent = 'キャンセルしています…';
      post('cancel_do').then(function (r) {
        if (r && r.ok) {
          msg(['ご予約をキャンセルしました。', 'キャンセルのメールをお送りします（届かなくても、キャンセルは済んでいます）。', 'またのご来店を、お待ちしています。']);
          try { history.replaceState(null, '', location.pathname); } catch (e) { /* 何もしない */ }
          return;
        }
        if (r && r.reason === 'late') { lateView({ no: res.no, date: res.date, h: res.h, people: res.people, seat: res.seat, type: r.type || res.type, until: r.until || res.until }); return; }
        fail(r);
      }).catch(function () {
        // 送れたか分からないときは、決めつけない。ページを開き直せば、結果が分かる
        msg(['通信がうまくいきませんでした。', 'キャンセルできたか分からないため、このページをもう一度開いて、確かめてください。', 'うまくいかないときは、お電話でお願いします。'], true);
      });
    });
    box.appendChild(el('p', { class: 'more' }, [go]));
    box.appendChild(el('p', { class: 'field-hint' }, ['ご予約の変更（日時・人数など）は、キャンセルせずに、お電話でお願いします。']));
  }).catch(function () {
    msg(['通信がうまくいきませんでした。', '電波のよいところで、もう一度開いてください。', 'うまくいかないときは、お電話でお願いします。'], true);
  });
})();
