/* YAMURADA 予約カレンダー（オーナー用）。LINEの中（LIFF）で開く。
   ・本人確認：LINEのアクセストークンをGASに送る。GASがLINEに確かめて、オーナーだけ通す
   ・このページ自体は、予約のデータを持たない。見えるのは、確認が通ったあとにGASから届いた分だけ
   ・文字は、必ず textContent で入れる（名前やご要望に変な文字が入っても、画面を壊せないように）
   ・localhost で ?demo=1 を付けて開くと、ダミーの予約で画面だけ試せる（本物には、つながない） */
(function () {
  'use strict';

  var CFG = window.CAL_CONFIG || {};
  var ENDPOINT = CFG.endpoint || '';
  var DEMO = !CFG.liffId && /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]demo=1/.test(location.search);

  var WEEK = '日月火水木金土';
  var SEAT = { counter: 'カウンター（厨房の前）', wall: 'カウンター（壁向き）', table: 'テーブル', multi: '席つなぎ（貸切）' };
  var SEAT_PICK = { counter: SEAT.counter, wall: SEAT.wall, table: SEAT.table }; // 予約の追加で選べる席（「席つなぎ」は、別のボタンで）
  var TYPE = { seat: '席のみ', banquet: '宴会' };
  var SRC = { web: 'ネット', tel: '電話', sns: 'LINE・SNS', walk: '来店' };
  var FIRST_H = 18, LAST_H = 25;             // GASから教われなかったときだけ使う（ふだんは cal_month の返事の hours を使う）
  var MAX_PEOPLE = { counter: 6, wall: 4, table: 11, multi: 25 }; // 同上（max）。本当の確認は、GASがする

  var ERR = {
    auth: 'ログインの確認ができませんでした。いったんページを閉じて、LINEのメニューから開き直してください。',
    owner: 'このカレンダーは、オーナーのLINEからだけ開けます。（このLINEアカウントは、登録されていません）',
    config: 'まだ設定が終わっていません。（GASの LIFF_CHANNEL_ID が空です）',
    locked: '確認が混み合っているため、少し止めています。10分ほどしてから、開き直してください。',
    net: '通信できませんでした。電波のよいところで、もう一度ためしてください。',
    netadd: '通信できませんでした。予約は入っているかもしれません。日の一覧で確かめてから、もう一度入れてください。',
    busy: 'ほかの処理をしています。少し待って、もう一度ためしてください。',
    date: 'この日には入れられません（今日から60日先までです）。',
    bad: '入力を確かめてください。',
    tel: '電話番号は、数字10〜11けたで入れてください。（わからないときは、空にしておけます）',
    people: '人数が、この席に入れられる数をこえています。',
    big: 'この日の予約が多すぎて、保存できませんでした。',
    many: 'お休みの日が多すぎます。',
    nf: 'その予約は、すでに消えています。',
    nfvisit: '14時の掃除で、記録に入りました。画面からは直せません。直すときは、制作者に連絡してください。',
    past: '過ぎた日の予約は、キャンセル・訂正できません。（来店の記録の元になるため）',
    visited: '来店（か「来なかった」）を記録ずみの予約です。キャンセル・訂正するときは、先に「未入力に戻す」を押してください。',
    webdate: 'ネット予約の日付は、直せません。（お客さまのメールのURLに日付が入っているため）取り消して、入れ直してください。',
    netedit: '通信できませんでした。直ったかもしれません。日の一覧（日付を移したときは、移した先の日も）で確かめてから、もう一度ためしてください。',
    nfedit: 'その予約が、見つかりません。もう直っているかもしれません。日の一覧（日付を移したときは、移した先の日も）で確かめてください。',
    error: 'うまくいきませんでした。もう一度ためしてください。'
  };

  var app = document.getElementById('app');
  var toastEl = document.getElementById('toast');
  var state = { view: 'boot', month: null, monthData: null, date: null, dayData: null, sel: null };
  var busyEl = null, toastTimer = null;

  /* ---------- 小さな道具 ---------- */

  function el(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'class') e.className = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k]);
    });
    var add = function (c) {
      if (c == null || c === false) return;
      if (Array.isArray(c)) { c.forEach(add); return; }
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    };
    for (var i = 2; i < arguments.length; i++) add(arguments[i]);
    return e;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function show(nodes) { clear(app); nodes.forEach(function (n) { if (n) app.appendChild(n); }); window.scrollTo(0, 0); }

  // 名前を消した予約（記録に書けなかった日の分）は、そう表示する
  function nameOf(b) { return b.name ? b.name + ' 様' : '（名前は消しました）'; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function parts(ymd) { var p = ymd.split('-'); return { y: +p[0], m: +p[1], d: +p[2] }; }
  function dow(ymd) { var p = parts(ymd); return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay(); }
  function dateLabel(ymd) { var p = parts(ymd); return p.m + '/' + p.d + '(' + WEEK.charAt(dow(ymd)) + ')'; }
  // 時間の文字（19.25 → 19:15、25.5 → 深夜1:30（25:30））。開始は15分きざみ
  function hourLabel(h) {
    var hh = Math.floor(h + 1e-9), m = Math.round((h - hh) * 60), m2 = (m < 10 ? '0' : '') + m;
    return h >= 24 ? '深夜' + (hh - 24) + ':' + m2 + '（' + hh + ':' + m2 + '）' : hh + ':' + m2;
  }
  function telLabel(t) {
    t = String(t || '');
    if (t.length === 11) return t.slice(0, 3) + '-' + t.slice(3, 7) + '-' + t.slice(7);
    if (t.length === 10) return t.slice(0, 2) + '-' + t.slice(2, 6) + '-' + t.slice(6);
    return t;
  }
  function tableLabel(i) {
    var n = state.monthData && state.monthData.tables && state.monthData.tables[i]; // 卓の大きさは、GASが教える
    return ('ABCDEFGHIJ'.charAt(i) || String(i + 1)) + (n ? '（' + n + '人がけ）' : '');
  }

  /* ---------- 席の図（席をつなぐ） ---------- */

  function stayH() { return (state.monthData && state.monthData.stayHours) || 2; } // 1回の長さ（時間）。GASが教える（貸切の時間は、あとで変わるかもしれない）
  var ZONE_NAME = { counter: 'カウンター（厨房の前）', wall: 'カウンター（壁向き）' };
  function unitName(u) { return u.charAt(0) === 't' ? 'テーブル' + tableLabel(parseInt(u.slice(1), 10)) : (ZONE_NAME[u] || u); }
  function unitsOf(b) { return (b.tb || []).map(function (i) { return 't' + i; }).concat(b.zn || []); }
  function unitSeats(u) {
    var md = state.monthData || {};
    if (u.charAt(0) === 't') return ((md.tables || [3, 2, 6])[parseInt(u.slice(1), 10)]) || 0;
    return ((md.zones || { counter: 6, wall: 4 })[u]) || 0;
  }
  // ある時間に、どの席が使われているか（GASの数え方と同じ。重なるのは、開始が2時間未満はなれているものの予約）
  function usage(list, h) {
    var u = { t: {}, z: { counter: 0, wall: 0 }, blocked: false };
    (list || []).forEach(function (b) {
      if (Math.abs(b.h - h) >= stayH()) return;
      if (b.seat === 'table' || b.seat === 'multi') { (b.tb || []).forEach(function (i) { u.t[i] = b.no; }); if (b.ov) u.blocked = true; }
      if (b.seat === 'counter' || b.seat === 'wall') u.z[b.seat] += b.people;
      if (b.seat === 'multi') (b.zn || []).forEach(function (z) { u.z[z] += 99; });
    });
    return u;
  }
  // 席の図（下が入口）。右＝テーブル（奥から A・B・C。入口に近いのが C）／左の奥＝厨房の前カウンター／左の手前＝壁向きカウンター
  // sel＝選んでいる席 {id:true}、use＝使われている席（usage の結果。なければ null）、onToggle＝押したときの動き（なければ、見るだけ）
  function seatMap(sel, use, onToggle) {
    var md = state.monthData || {}, nT = (md.tables || [3, 2, 6]).length;
    var wrap = el('div', { class: 'seatmap', role: 'group', 'aria-label': '席の図' });
    function tile(id, area) {
      var on = !!sel[id], busy = false;
      if (use) busy = id.charAt(0) === 't' ? (!!use.t[id.slice(1)] || use.blocked) : use.z[id] > 0;
      var idx = id.charAt(0) === 't' ? parseInt(id.slice(1), 10) : -1;
      var down = on && idx >= 0 && idx + 1 < nT && sel['t' + (idx + 1)];
      var label = id.charAt(0) === 't' ? 'テーブル' + 'ABCDEFGHIJ'.charAt(idx) : ZONE_NAME[id];
      var state_ = on ? (onToggle ? 'つながっている' : 'この予約') : (busy ? '使用中' : (onToggle ? '空き' : ''));
      var attrs = { class: 'tile ' + area + (on ? ' on' : '') + (busy ? ' busy' : '') + (down ? ' link-down' : '') };
      if (onToggle) { attrs.type = 'button'; attrs['aria-pressed'] = on ? 'true' : 'false'; attrs.onclick = function () { onToggle(id); }; }
      var node = el(onToggle ? 'button' : 'div', attrs, el('span', { class: 'tn', text: id.charAt(0) === 't' ? label : 'カウンター' }), el('span', { class: 'ts', text: (id === 'counter' ? '厨房の前・' : id === 'wall' ? '壁向き・' : '') + unitSeats(id) + '席' }), el('span', { class: 'tst', text: state_ }));
      return node;
    }
    for (var i = 0; i < nT; i++) wrap.appendChild(tile('t' + i, 'ta' + i));
    wrap.appendChild(tile('wall', 'twall'));
    wrap.appendChild(tile('counter', 'tcounter'));
    wrap.appendChild(el('div', { class: 'maplabel mback', text: '奥' }));
    wrap.appendChild(el('div', { class: 'maplabel mdoor', text: '入口' }));
    return wrap;
  }

  function toast(msg, isErr) {
    toastEl.textContent = msg;
    toastEl.className = (isErr ? 'err ' : '') + 'show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, isErr ? 7000 : 2600); // エラーは、読めるように長めに出す
  }

  function setBusy(on) {
    if (on && !busyEl) { busyEl = el('div', { class: 'busy', role: 'alert', text: '読み込み中…' }); document.body.appendChild(busyEl); }
    if (!on && busyEl) { document.body.removeChild(busyEl); busyEl = null; }
  }

  // 「はい／いいえ」の確認。安全なほう（いいえ）に、最初から印が付く
  function confirmBox(message, yes, no, dangerous) {
    return new Promise(function (resolve) {
      var prev = document.activeElement;
      var done = function (v) { document.removeEventListener('keydown', onKey); document.body.removeChild(bg); if (prev && prev.focus) prev.focus(); resolve(v); };
      var noBtn = no === null ? null : el('button', { class: 'plain', type: 'button', text: no || 'いいえ', onclick: function () { done(false); } });
      var yesBtn = el('button', { class: dangerous ? 'danger fill' : 'primary', type: 'button', text: yes || 'はい', onclick: function () { done(true); } });
      var bg = el('div', { class: 'dlg-bg' }, el('div', { class: 'dlg', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': '確認' },
        el('p', { text: message }), el('div', { class: 'row' }, noBtn, yesBtn)));
      var onKey = function (e) { if (e.key === 'Escape') done(false); };
      document.addEventListener('keydown', onKey);
      document.body.appendChild(bg);
      (noBtn || yesBtn).focus();
    });
  }

  /* ---------- GASとの通信 ---------- */

  var token = '', reauthTried = false;
  // ページが移っても残る小さな印（sessionStorage）。使えない環境でも、止まらないようにする
  function flag(k, v) { try { if (v === undefined) return window.sessionStorage.getItem(k); if (v === '') window.sessionStorage.removeItem(k); else window.sessionStorage.setItem(k, v); } catch (e) { /* 使えなければ、印なし */ } return null; }

  function api(act, body) {
    var payload = { act: act, t: token };
    Object.keys(body || {}).forEach(function (k) { payload[k] = body[k]; });
    if (DEMO) return demoApi(payload);
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 25000) : null;
    // 「text/plain」で送ると、ブラウザの事前確認（CORS）が省けて、GASで受け取れる（予約の欄と同じ）
    return fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload), signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (timer) clearTimeout(timer);
        if (!j || typeof j !== 'object') return { ok: false, reason: 'error' };
        if (j.reason === 'auth' && !reauthTried && window.liff) {
          // 開きっぱなしで、トークンの期限が切れたのかもしれない。取り直して、1回だけやり直す
          reauthTried = true;
          try {
            var t2 = window.liff.getAccessToken();
            if (t2 && t2 !== token) { token = t2; return api(act, body); }
            // LINEの中では、ログインし直せない。ふつうのブラウザで開いているときだけ、ログインし直す（ページが移っても繰り返さないよう、印を残す）
            if (!window.liff.isInClient() && flag('cal_relogin') !== '1') {
              flag('cal_relogin', '1');
              window.liff.logout();
              window.liff.login({ redirectUri: location.href });
              return new Promise(function () { }); // ページが移る
            }
          } catch (e) { /* 取り直せなかったら、そのまま「断り」を出す */ }
        }
        if (j.ok) { reauthTried = false; flag('cal_relogin', ''); }
        return j;
      })
      .catch(function () { if (timer) clearTimeout(timer); return { ok: false, reason: 'net' }; });
  }

  // 失敗したときの共通の画面。認証が通らないときは、先へ進めない
  function fatal(reason) {
    show([el('h1', { text: '予約カレンダー' }), el('p', { class: 'msg err', text: ERR[reason] || ERR.error }),
      el('div', { class: 'row' }, el('button', { class: 'primary', type: 'button', text: 'ページを開き直す', onclick: function () { location.reload(); } }))]);
  }

  /* ---------- 月の画面 ---------- */

  function loadMonth(keep) {
    setBusy(true);
    return api('cal_month').then(function (r) {
      setBusy(false);
      if (!r.ok) { if (r.reason === 'auth' || r.reason === 'owner' || r.reason === 'config' || r.reason === 'locked' || !state.monthData) return fatal(r.reason); toast(ERR[r.reason] || ERR.error, true); return; }
      state.monthData = r;
      if (!keep || !state.month) state.month = r.today.slice(0, 7);
      renderMonth();
    });
  }

  function renderMonth() {
    var d = state.monthData, ym = state.month.split('-'), y = +ym[0], m = +ym[1];
    var byDate = {}; d.days.forEach(function (x) { byDate[x.date] = x; });
    var closed = {}; d.closed.forEach(function (x) { closed[x] = 1; });
    var firstYm = d.today.slice(0, 7), lastYm = d.last.slice(0, 7);
    var prevYm = m === 1 ? (y - 1) + '-12' : y + '-' + pad2(m - 1);
    var nextYm = m === 12 ? (y + 1) + '-01' : y + '-' + pad2(m + 1);

    var grid = el('div', { class: 'grid', role: 'group', 'aria-label': y + '年' + m + '月' });
    for (var w = 0; w < 7; w++) grid.appendChild(el('div', { class: 'dow' + (w === 0 ? ' sun' : w === 6 ? ' sat' : ''), text: WEEK.charAt(w) }));
    // 最初の月は、過ぎた週を出さない（見られない日で、画面がうまるのを防ぐ）。今日のある週から始める
    var startDay = state.month === firstYm ? parts(d.today).d : 1;
    var lead = new Date(Date.UTC(y, m - 1, startDay)).getUTCDay();
    for (var b = 0; b < lead; b++) grid.appendChild(el('div', { class: 'cell blank' }));
    var days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    for (var day = startDay; day <= days; day++) {
      var ymd = y + '-' + pad2(m) + '-' + pad2(day), info = byDate[ymd], wd = dow(ymd);
      var cls = 'cell' + (wd === 0 ? ' sun' : wd === 6 ? ' sat' : '');
      if (!info) { grid.appendChild(el('div', { class: cls + ' off' }, el('span', { class: 'd', text: String(day) }))); continue; }
      if (ymd === d.today) cls += ' today';
      if (info.n) cls += ' has';
      if (closed[ymd]) cls += ' closed';
      var label = dateLabel(ymd) + '、' + (closed[ymd] ? 'お休み、' : '') + info.n + '件';
      grid.appendChild(el('button', { class: cls, type: 'button', 'aria-label': label, onclick: openDay.bind(null, ymd) },
        el('span', { class: 'd', text: String(day) }),
        info.n ? el('span', { class: 'n', text: info.n + '件' }) : null,
        closed[ymd] ? el('span', { class: 'x', text: '休' }) : null));
    }

    show([
      el('h1', { text: 'YAMURADA 予約カレンダー' }),
      d.paused ? el('div', { class: 'banner', role: 'status', text: 'ネット予約は、いま止めています。（再開するときは、LINEで「予約再開」と送ります）' }) : null,
      el('div', { class: 'monthbar' },
        el('button', { class: 'plain', type: 'button', 'aria-label': '前の月', text: '◀', disabled: state.month <= firstYm ? 'disabled' : false, onclick: function () { state.month = prevYm; renderMonth(); } }),
        el('h2', { text: y + '年' + m + '月' }),
        el('button', { class: 'plain', type: 'button', 'aria-label': '次の月', text: '▶', disabled: state.month >= lastYm ? 'disabled' : false, onclick: function () { state.month = nextYm; renderMonth(); } })),
      grid,
      el('p', { class: 'legend', text: '数字は、予約の件数です。「休」は、お休みに設定した日です。日を押すと、その日の予約が見られます。' }),
      // 昨日のネット予約が残っているあいだ（14時まで）は、来店ボタンを押せる。未入力があるときは、目立たせる
      d.yest && d.yest.n ? el('div', { class: 'row' },
        el('button', { class: d.yest.pend ? 'primary' : 'plain', type: 'button',
          text: '昨日（' + dateLabel(d.yest.date) + '）の来店を確認する　' + (d.yest.pend ? '未入力 ' + d.yest.pend + '件' : '入力ずみ'),
          onclick: function () { openDay(d.yest.date); } })) : null,
      el('div', { class: 'row' },
        el('button', { class: d.yest && d.yest.pend ? 'plain' : 'primary', type: 'button', text: '今日の予約を見る', onclick: function () { openDay(d.today); } }),
        el('button', { class: 'plain', type: 'button', text: '最新にする', onclick: function () { loadMonth(true); } }))
    ]);
    state.view = 'month';
  }

  /* ---------- 1日の画面 ---------- */

  function openDay(date) {
    state.date = date;
    setBusy(true);
    return api('cal_day', { date: date }).then(function (r) {
      setBusy(false);
      if (!r.ok) { if (r.reason === 'auth' || r.reason === 'owner' || r.reason === 'locked') return fatal(r.reason); toast(ERR[r.reason] || ERR.error, true); return; }
      state.dayData = r;
      renderDay();
      return true;
    });
  }

  function renderDay() {
    var r = state.dayData, date = r.date, total = 0;
    var past = !!(state.monthData && date < state.monthData.today); // 昨日の営業日：来店ボタンだけ。予約の追加・お休みの変更はできない
    var webN = 0, came = 0, pend = 0;
    r.list.forEach(function (b) {
      total += b.people;
      if (b.src === 'web') { webN++; if (b.vp) came += b.vp; else if (!b.nv) pend++; }
    });

    var cards = r.list.map(function (b) {
      var chips = el('div', { class: 'chips' }, el('span', { class: 'chip', text: SRC[b.src] || SRC.web }),
        b.src === 'web' && r.canVisit ? visitChip(b) : null,
        b.note ? el('span', { class: 'chip note', text: '★ご要望あり' }) : null,
        b.ov ? el('span', { class: 'chip over', text: '満席をこえて入れた' }) : null,
        b.cf ? el('span', { class: 'chip over', text: '入れたとき席が重なっていた' }) : null);
      return el('button', { class: 'card', type: 'button', onclick: function () { state.sel = b.no; renderDetail(); } },
        el('div', { class: 't', text: hourLabel(b.h) + '　（番号' + b.no + '）' }),
        el('div', { class: 'who', text: nameOf(b) }),
        el('div', { class: 'meta', text: b.people + '名　' + SEAT[b.seat] + '（' + TYPE[b.type] + '）' }),
        b.seat === 'multi' ? el('div', { class: 'meta', text: unitsOf(b).map(unitName).join('・') }) : null,
        chips);
    });

    show([
      el('button', { class: 'link back', type: 'button', text: '← 月に戻る', onclick: function () { loadMonth(true); } }),
      el('h1', { text: dateLabel(date) }),
      r.closed ? el('div', { class: 'banner closed', role: 'status', text: 'この日は、お休みに設定しています。（ネット予約は受けません）' }) : null,
      el('p', { class: 'sum', text: r.list.length ? r.list.length + '件・合計' + total + '名' : '予約は、ありません。' }),
      r.canVisit && webN ? el('p', { class: 'sum', text: 'ネット予約の来店：' + came + '名' + (pend ? '　（未入力 ' + pend + '件）' : '') }) : null,
      past ? el('p', { class: 'hint', text: '昨日の分です。ネット予約の「来店」か「来なかった」を押してください（14時までです）。' }) : el('div', { class: 'row' },
        el('button', { class: 'primary', type: 'button', text: '＋ 予約を追加', onclick: function () { renderForm(date); } }),
        el('button', { class: r.closed ? 'plain' : 'danger', type: 'button', text: r.closed ? 'お休みを解除する' : 'この日は休み', onclick: function () { toggleClosed(date, !r.closed); } })),
      r.list.length ? el('div', null, cards) : el('p', { class: 'empty', text: 'この日の予約は、まだありません。' }),
      el('div', { class: 'row' }, el('button', { class: 'plain', type: 'button', text: '最新にする', onclick: function () { openDay(date); } }))
    ]);
    state.view = 'day';
  }

  // 来店ボタンの状態の小さな札（ネット予約だけ）
  function visitChip(b) {
    return b.vp ? el('span', { class: 'chip ok', text: '来店 ' + b.vp + '名' })
      : b.nv ? el('span', { class: 'chip', text: '来なかった' })
      : el('span', { class: 'chip over', text: '来店 未入力' });
  }

  function toggleClosed(date, toClosed) {
    var msg = toClosed
      ? dateLabel(date) + 'を、お休みにしますか？\nこの日は、ネット予約を受けなくなります。'
      : dateLabel(date) + 'の、お休みを解除しますか？\nネット予約を、また受けられます。';
    confirmBox(msg, toClosed ? '休みにする' : '解除する', 'いいえ', false).then(function (yes) {
      if (!yes) return;
      setBusy(true);
      api('cal_closed', { date: date, closed: toClosed }).then(function (r) {
        setBusy(false);
        if (!r.ok) { toast(ERR[r.reason] || ERR.error, true); return; }
        toast(r.closed ? 'お休みにしました' : 'お休みを解除しました');
        if (r.closed && r.n) {
          confirmBox('この日には、すでに予約が ' + r.n + '件 入っています。\n予約は消えていません。お客さまに電話してから、この画面でキャンセルしてください。', 'わかった', null, false).then(function () { openDay(date); });
        } else openDay(date);
      });
    });
  }

  /* ---------- 予約の詳細・キャンセル ---------- */

  function findSel() {
    var l = state.dayData ? state.dayData.list : [];
    for (var i = 0; i < l.length; i++) if (l[i].no === state.sel) return l[i];
    return null;
  }

  function selOf(b) { var o = {}; unitsOf(b).forEach(function (u) { o[u] = true; }); return o; }
  function item(label, valueNode, cls) { return el('div', { class: 'it' }, el('dt', { text: label }), el('dd', { class: cls || '' }, valueNode)); }

  function renderDetail() {
    var b = findSel(), date = state.date;
    if (!b) { renderDay(); return; }
    var tel = b.tel ? el('a', { href: 'tel:' + b.tel, text: telLabel(b.tel) }) : '（なし）';
    var tb = b.tb && b.tb.length ? b.tb.map(tableLabel).join('・') : null;
    show([
      el('button', { class: 'link back', type: 'button', text: '← ' + dateLabel(date) + 'に戻る', onclick: renderDay }),
      el('h1', { text: dateLabel(date) + ' ' + hourLabel(b.h) }),
      el('div', { class: 'detail' }, el('dl', null,
        item('お名前', nameOf(b)),
        item('電話番号', tel),
        item('人数・席', b.people + '名　' + SEAT[b.seat] + (tb && b.seat !== 'multi' ? '（卓 ' + tb + '）' : '')),
        b.seat === 'multi' ? item('つないだ席', el('div', null, el('div', { text: unitsOf(b).map(unitName).join('・') }), seatMap(selOf(b), null, null))) : null,
        item('ご利用', TYPE[b.type]),
        item('受けた経路', SRC[b.src] || SRC.web),
        item('ご要望・ご質問', b.note || '（なし）', 'note'),
        b.ov ? item('メモ', b.seat === 'table'
          ? '満席をこえて入れた予約です。この予約があるあいだ、その時間（と、開始が2時間未満はなれている時間）のテーブルは、ネットでは満席になります。席が空いたら、この予約をキャンセルして、入れ直してください。'
          : '満席をこえて入れた予約です。この席は、人数で数えているので、この予約のぶんも埋まった扱いになります。') : null,
        b.cf ? item('メモ', '入れたときに、同じ席を使う予約がほかにあった（席が重なっていた）予約です。ほかの予約をキャンセルしたあとは、重なっていないこともあります。席の割り当てを、お店で確かめてください。') : null,
        item('予約の番号', String(b.no)),
        b.src === 'web' && state.dayData.canVisit ? item('来店の記録', b.vp ? '来店 ' + b.vp + '名' : b.nv ? '来なかった' : '未入力') : null)),
      b.src === 'web' && state.dayData.canVisit ? visitBox(b) : null,
      // 昨日の営業日の予約は、キャンセルできない（来店の記録の元になるため）
      state.monthData && date < state.monthData.today ? null : el('div', { class: 'row' },
        (b.src === 'web' && (b.vp || b.nv)) ? null : el('button', { class: 'plain', type: 'button', text: 'この予約を訂正する', onclick: function () { renderEdit(b); } }),
        el('button', { class: 'danger', type: 'button', text: 'この予約をキャンセルする', onclick: function () { cancelBooking(b); } }))
    ]);
    state.view = 'detail';
  }

  // 来店ボタン（ネット予約だけ）。人数は、予約の人数が入っている。少ない・多いときは、直してから押す
  function visitBox(b) {
    var inp = el('input', { type: 'number', id: 'v-people', inputmode: 'numeric', min: '1', max: '50', value: String(b.vp || b.people) });
    return el('div', { class: 'visit' },
      el('div', { class: 'f' }, el('label', { for: 'v-people', text: '来店した人数' }), inp,
        el('div', { class: 'hint', text: '月の来店人数の数え方に使います。予約と人数がちがうときは、直してください。' })),
      el('div', { class: 'row' },
        el('button', { class: 'primary', type: 'button', text: '来店を記録する', onclick: function () { sendVisit(b, 'came', inp.value); } }),
        el('button', { class: 'plain', type: 'button', text: '来なかった', onclick: function () { sendVisit(b, 'no', 0); } }),
        b.vp || b.nv ? el('button', { class: 'plain', type: 'button', text: '未入力に戻す', onclick: function () { sendVisit(b, 'clear', 0); } }) : null));
  }

  function sendVisit(b, v, people) {
    var n = parseInt(people, 10) || 0;
    if (v === 'came' && !(n >= 1 && n <= 50)) { toast(ERR.people, true); return; }
    // 予約の人数の2倍をこえるときは、打ち間違いかもしれないので、一度確かめる
    if (v === 'came' && n > b.people * 2) {
      confirmBox('予約は ' + b.people + '名ですが、' + n + '名で記録します。\nまちがいありませんか？', 'この人数で記録', '直す', false).then(function (yes) { if (yes) doVisit(b, v, n); });
      return;
    }
    doVisit(b, v, n);
  }

  function doVisit(b, v, n) {
    var date = state.date;
    setBusy(true);
    api('cal_visit', { date: date, no: b.no, v: v, people: n }).then(function (r) {
      setBusy(false);
      if (!r.ok) { toast(r.reason === 'nf' ? ERR.nfvisit : (ERR[r.reason] || ERR.error), true); if (r.reason === 'nf') openDay(date); return; }
      toast(v === 'came' ? '来店を記録しました（' + r.vp + '名）' : v === 'no' ? '「来なかった」にしました' : '未入力に戻しました');
      // 最新の一覧を読み直して、この予約の画面に戻る
      api('cal_day', { date: date }).then(function (d) {
        if (d.ok) { state.dayData = d; renderDetail(); } else openDay(date);
      });
    });
  }

  function cancelBooking(b) {
    var date = state.date;
    confirmBox(dateLabel(date) + ' ' + hourLabel(b.h) + '\n' + nameOf(b) + '　' + b.people + '名\n\nこの予約を消しますか？\n（消すと、元には戻せません。お客さまには、LINEでは知らせません）', 'はい、消す', 'いいえ', true).then(function (yes) {
      if (!yes) return;
      setBusy(true);
      api('cal_cancel', { date: date, no: b.no }).then(function (r) {
        setBusy(false);
        if (!r.ok && r.reason !== 'nf') { toast(ERR[r.reason] || ERR.error, true); return; }
        toast(r.ok ? '予約を消しました' : ERR.nf, !r.ok);
        openDay(date);
      });
    });
  }

  /* ---------- 予約の追加 ---------- */

  function field(label, input, hint, id) { return el('div', { class: 'f' }, el('label', { for: id, text: label }), input, hint ? el('div', { class: 'hint', text: hint }) : null); }

  function seg(name, options, value) {
    var wrap = el('div', { class: 'seg', role: 'radiogroup' });
    Object.keys(options).forEach(function (k) {
      var inp = el('input', { type: 'radio', name: name, value: k });
      if (k === value) inp.checked = true;
      wrap.appendChild(el('label', null, inp, el('span', { text: options[k] })));
    });
    return wrap;
  }
  function segValue(form, name) { var x = form.querySelector('input[name="' + name + '"]:checked'); return x ? x.value : ''; }

  function renderForm(date) {
    var form = el('form', { novalidate: 'novalidate' });
    var dateIn = el('input', { type: 'date', id: 'f-date', required: 'required', value: date, min: state.monthData.today, max: state.monthData.last });
    var timeSel = el('select', { id: 'f-h' });
    var hrs = state.monthData.hours || { first: FIRST_H, last: LAST_H };
    var stepH = hrs.step || 1; // GASが古くて刻みを教えないときは、1時間（古いGASは15分を読めない）
    for (var h = hrs.first; h <= hrs.last + 1e-9; h += stepH) timeSel.appendChild(el('option', { value: String(h), text: hourLabel(h) }));
    timeSel.value = (hrs.first <= 20 && 20 <= hrs.last) ? '20' : String(hrs.first);
    var people = el('input', { type: 'number', id: 'f-people', inputmode: 'numeric', min: '1', max: String((state.monthData.max || MAX_PEOPLE).table), value: '2' });
    var name = el('input', { type: 'text', id: 'f-name', maxlength: '30', autocomplete: 'off', placeholder: '例）山田 太郎' });
    var tel = el('input', { type: 'tel', id: 'f-tel', inputmode: 'tel', maxlength: '14', autocomplete: 'off', placeholder: '例）09012345678' });
    var note = el('textarea', { id: 'f-note', maxlength: '200', placeholder: 'アレルギー・記念日など' });
    var counter = el('div', { class: 'count', text: '0 / 200' });
    note.addEventListener('input', function () { counter.textContent = note.value.length + ' / 200'; });
    var err = el('div', { class: 'ferr', role: 'alert' });
    var submit = el('button', { class: 'primary', type: 'submit', text: '予約を入れる' });

    form.appendChild(field('日付', dateIn, '今日から60日先まで。当日もOKです。', 'f-date'));
    form.appendChild(field('開始の時間', timeSel, '1回2時間で数えます。', 'f-h'));
    // 席をつなぐ（大人数・貸切）：席の図をタップして選ぶ。選んだ席は、その時間、ネットでは満席になる
    var maxes = state.monthData.max || MAX_PEOPLE;
    var linkOn = false, selUnits = {};
    var occ = (state.dayData && state.dayData.date === date) ? state.dayData.list : []; // その日の予約（使われている席を、図に出すため）
    var occFail = false; // その日の予約を読めなかったとき（図は「空き」に見えるので、知らせる）
    var seatRow = el('div', { class: 'f' }, el('div', { class: 'lab', text: '席' }), seg('seat', SEAT_PICK, 'table'));
    var mapBox = el('div', { class: 'mapbox' });
    var mapSum = el('div', { class: 'mapsum', role: 'status' });
    var linkBtn = el('button', { class: 'plain linkbtn', type: 'button', 'aria-pressed': 'false', text: '席をつなぐ（大人数・貸切）' });
    mapBox.hidden = true; mapSum.hidden = true;
    function drawMap() {
      clear(mapBox); clear(mapSum);
      var use = usage(occ, Number(timeSel.value));
      mapBox.appendChild(seatMap(selUnits, use, function (id) { if (selUnits[id]) delete selUnits[id]; else selUnits[id] = true; drawMap(); }));
      var ids = Object.keys(selUnits).sort(), seats = 0, pp = parseInt(people.value, 10) || 0, busy = false;
      ids.forEach(function (u) { seats += unitSeats(u); if (u.charAt(0) === 't' ? (use.t[u.slice(1)] || use.blocked) : use.z[u] > 0) busy = true; });
      mapSum.className = 'mapsum' + (ids.length && (seats < pp || busy) ? ' warn' : '');
      if (!ids.length) { mapSum.appendChild(el('div', { text: '使う席をタップすると、つながります。（もう一度タップすると、外れます）' })); if (occFail) mapSum.appendChild(el('div', { text: 'この日の予約を読めませんでした。（使われている席は、送ったときに確かめます）' })); return; }
      mapSum.appendChild(el('div', { text: 'つないだ席：' + ids.map(unitName).join('・') }));
      mapSum.appendChild(el('div', { text: '合計 ' + seats + '席　／　予約 ' + pp + '名' }));
      if (seats < pp) mapSum.appendChild(el('div', { text: '席が足りません。' }));
      if (busy) mapSum.appendChild(el('div', { text: 'この時間に、使われている席が入っています。' }));
      if (occFail) mapSum.appendChild(el('div', { text: 'この日の予約を読めませんでした。（使われている席は、送ったときに確かめます）' }));
    }
    linkBtn.addEventListener('click', function () {
      linkOn = !linkOn;
      seatRow.hidden = linkOn; mapBox.hidden = !linkOn; mapSum.hidden = !linkOn;
      linkBtn.setAttribute('aria-pressed', linkOn ? 'true' : 'false');
      linkBtn.textContent = linkOn ? '席をつなぐのをやめる' : '席をつなぐ（大人数・貸切）';
      people.max = String(linkOn ? maxes.multi : maxes.table);
      if (linkOn) drawMap();
    });
    timeSel.addEventListener('change', function () { if (linkOn) drawMap(); });
    people.addEventListener('input', function () { if (linkOn) drawMap(); });
    dateIn.addEventListener('change', function () {
      var d = dateIn.value;
      if (!d) return;
      if (state.dayData && state.dayData.date === d) { occ = state.dayData.list; if (linkOn) drawMap(); return; }
      occ = []; occFail = false; if (linkOn) drawMap();
      api('cal_day', { date: d }).then(function (r) { if (dateIn.value !== d) return; occ = r && r.ok ? r.list : []; occFail = !(r && r.ok); if (linkOn) drawMap(); });
    });
    form.appendChild(seatRow);
    form.appendChild(el('div', { class: 'f' }, linkBtn, el('div', { class: 'hint', text: '12名以上や、貸切のときに使います。選んだ席は、その時間、ネットでは満席になります。' })));
    form.appendChild(mapBox);
    form.appendChild(mapSum);
    form.appendChild(field('人数', people, null, 'f-people'));
    form.appendChild(el('div', { class: 'f' }, el('div', { class: 'lab', text: 'ご利用' }), seg('type', TYPE, 'seat')));
    form.appendChild(el('div', { class: 'f' }, el('div', { class: 'lab', text: 'どこで受けた予約？' }), seg('src', { tel: SRC.tel, sns: SRC.sns, walk: SRC.walk }, 'tel')));
    form.appendChild(field('お名前', name, '空のままでもよいです。（「名前なし」で入ります）', 'f-name'));
    form.appendChild(field('電話番号', tel, '空のままでもよいです。', 'f-tel'));
    form.appendChild(el('div', { class: 'f' }, el('label', { for: 'f-note', text: 'ご要望・ご質問' }), note, counter));
    form.appendChild(err);
    form.appendChild(el('div', { class: 'row' }, el('button', { class: 'plain', type: 'button', text: 'やめる', onclick: renderDay }), submit));

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      err.textContent = '';
      var p = parseInt(people.value, 10), seatV = linkOn ? 'multi' : segValue(form, 'seat');
      var telV = tel.value.replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 65248); }).replace(/[^0-9]/g, '');
      if (!dateIn.value) { err.textContent = '日付を入れてください。'; dateIn.focus(); return; }
      if (linkOn && !Object.keys(selUnits).length) { err.textContent = 'つなぐ席を、図からタップして選んでください。'; return; }
      var mx = (state.monthData.max || MAX_PEOPLE)[seatV];
      if (!(p >= 1 && p <= mx)) { err.textContent = SEAT[seatV] + 'は、1〜' + mx + '名で入れてください。'; people.focus(); return; }
      if (telV && !/^0\d{9,10}$/.test(telV)) { err.textContent = ERR.tel; tel.focus(); return; }
      var body = { date: dateIn.value, h: Number(timeSel.value), people: p, seat: seatV, type: segValue(form, 'type'), src: segValue(form, 'src'), name: name.value, tel: telV, note: note.value };
      if (linkOn) body.units = Object.keys(selUnits).sort();
      submit.disabled = true;
      send(body, form, err, submit);
    });

    show([el('button', { class: 'link back', type: 'button', text: '← やめて戻る', onclick: renderDay }), el('h1', { text: '予約を追加' }), form]);
    state.view = 'form';
  }

  // 送る。「お休みの日」「満席」と返ってきたら、確かめてから、許可をつけて送り直す
  function send(body, form, err, submit) {
    setBusy(true);
    api('cal_add', body).then(function (r) {
      setBusy(false);
      if (r.ok) {
        toast(r.dup ? 'すでに入っています（番号' + r.no + '）' : '予約を入れました（番号' + r.no + '）');
        state.date = body.date;
        return openDay(body.date);
      }
      var ask = r.reason === 'closed' ? 'closed' : r.reason === 'full' ? 'full' : r.reason === 'cap' ? 'cap' : '';
      if (ask) {
        var msg = ask === 'closed'
          ? dateLabel(body.date) + 'は、お休みに設定してある日です。\nそれでも入れますか？'
          : ask === 'cap'
            ? '選んだ席は ' + r.cap + '席ですが、人数は ' + body.people + '名です。\n席が足りませんが、それでも入れますか？'
            : body.units
              ? 'この時間に、すでに使われている席が入っています。\nそれでも入れますか？（席が重なります）'
              : '満席です。（その時間の席は、もう埋まっています）\nそれでも入れますか？';
        confirmBox(msg, 'はい、入れる', 'いいえ', false).then(function (yes) {
          if (!yes) { submit.disabled = false; return; }
          if (ask === 'closed') body.forceClosed = true; else if (ask === 'cap') body.forceCap = true; else body.forceFull = true;
          send(body, form, err, submit);
        });
        return;
      }
      submit.disabled = false;
      if (r.reason === 'auth' || r.reason === 'owner' || r.reason === 'locked') return fatal(r.reason);
      err.textContent = r.reason === 'net' ? ERR.netadd : (ERR[r.reason] || ERR.error);
    });
  }

  /* ---------- 予約の訂正（時間・人数・席・ご利用・名前・電話・ご要望。お客さまには、メールもLINEも出ない） ---------- */

  function renderEdit(b) {
    var date0 = state.date, isWeb = (b.src || 'web') === 'web', isMulti = b.seat === 'multi';
    var form = el('form', { novalidate: 'novalidate' });
    var hrs = state.monthData.hours || { first: FIRST_H, last: LAST_H }, stepH = hrs.step || 1;
    var timeSel = el('select', { id: 'e-h' });
    for (var h = hrs.first; h <= hrs.last + 1e-9; h += stepH) timeSel.appendChild(el('option', { value: String(h), text: hourLabel(h) }));
    if (!timeSel.querySelector('option[value="' + b.h + '"]')) timeSel.appendChild(el('option', { value: String(b.h), text: hourLabel(b.h) }));
    timeSel.value = String(b.h);
    var maxes = state.monthData.max || MAX_PEOPLE;
    var people = el('input', { type: 'number', id: 'e-people', inputmode: 'numeric', min: '1', max: String(isMulti ? maxes.multi : maxes.table), value: String(b.people) });
    var dateIn = isWeb ? null : el('input', { type: 'date', id: 'e-date', required: 'required', value: date0, min: state.monthData.today, max: state.monthData.last });
    var name = el('input', { type: 'text', id: 'e-name', maxlength: '30', autocomplete: 'off', value: b.name || '' });
    var tel = el('input', { type: 'tel', id: 'e-tel', inputmode: 'tel', maxlength: '14', autocomplete: 'off', value: b.tel || '' });
    var note = el('textarea', { id: 'e-note', maxlength: '200' });
    note.value = b.note || '';
    var counter = el('div', { class: 'count', text: note.value.length + ' / 200' });
    note.addEventListener('input', function () { counter.textContent = note.value.length + ' / 200'; });
    var err = el('div', { class: 'ferr', role: 'alert' });
    var submit = el('button', { class: 'primary', type: 'submit', text: '直して保存する' });

    form.appendChild(isWeb
      ? el('div', { class: 'f' }, el('div', { class: 'lab', text: '日付' }), el('div', { text: dateLabel(date0) }), el('div', { class: 'hint', text: 'ネット予約の日付は、直せません。日付を変えるときは、取り消して、入れ直してください。' }))
      : field('日付', dateIn, '今日から60日先まで。', 'e-date'));
    form.appendChild(field('開始の時間', timeSel, '1回2時間で数えます。', 'e-h'));
    form.appendChild(isMulti
      ? el('div', { class: 'f' }, el('div', { class: 'lab', text: '席' }), el('div', { text: unitsOf(b).map(unitName).join('・') }), el('div', { class: 'hint', text: '席つなぎの予約は、席の組み合わせを直せません。変えるときは、取り消して、入れ直してください。' }))
      : el('div', { class: 'f' }, el('div', { class: 'lab', text: '席' }), seg('seat', SEAT_PICK, b.seat)));
    form.appendChild(field('人数', people, null, 'e-people'));
    form.appendChild(el('div', { class: 'f' }, el('div', { class: 'lab', text: 'ご利用' }), seg('type', TYPE, b.type)));
    form.appendChild(field('お名前', name, '空のままでもよいです。（「名前なし」で入ります）', 'e-name'));
    form.appendChild(field('電話番号', tel, '空のままでもよいです。', 'e-tel'));
    form.appendChild(el('div', { class: 'f' }, el('label', { for: 'e-note', text: 'ご要望・ご質問' }), note, counter));
    form.appendChild(el('div', { class: 'hint', text: isWeb
      ? 'お客さまには、メールもLINEも、自動では送られません。時間や人数を変えたときは、お電話でお伝えください。（お客さまのメールのURLは、そのまま使えます）'
      : 'お客さまには、自動では何も送られません。' }));
    form.appendChild(err);
    form.appendChild(el('div', { class: 'row' }, el('button', { class: 'plain', type: 'button', text: 'やめる', onclick: renderDetail }), submit));

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      err.textContent = '';
      var p = parseInt(people.value, 10), seatV = isMulti ? 'multi' : segValue(form, 'seat');
      var telV = tel.value.replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 65248); }).replace(/[^0-9]/g, '');
      if (dateIn && !dateIn.value) { err.textContent = '日付を入れてください。'; dateIn.focus(); return; }
      var mx = maxes[seatV];
      if (!(p >= 1 && p <= mx)) { err.textContent = SEAT[seatV] + 'は、1〜' + mx + '名で入れてください。'; people.focus(); return; }
      if (telV && !/^0\d{9,10}$/.test(telV)) { err.textContent = ERR.tel; tel.focus(); return; }
      var body = { date: date0, no: b.no, h: Number(timeSel.value), people: p, seat: seatV, type: segValue(form, 'type'), name: name.value, tel: telV, note: note.value };
      if (dateIn && dateIn.value !== date0) body.newDate = dateIn.value;
      submit.disabled = true;
      sendEdit(body, err, submit);
    });

    show([el('button', { class: 'link back', type: 'button', text: '← やめて戻る', onclick: renderDetail }), el('h1', { text: '予約を訂正する' }), el('p', { class: 'hint', text: dateLabel(date0) + ' ' + hourLabel(b.h) + '　' + nameOf(b) + '　（番号' + b.no + '）' }), form]);
    state.view = 'edit';
  }

  // 送る。「お休みの日」「満席」と返ってきたら、確かめてから、許可をつけて送り直す
  function sendEdit(body, err, submit) {
    setBusy(true);
    api('cal_edit', body).then(function (r) {
      setBusy(false);
      if (r.ok) {
        toast(r.date !== body.date ? '予約を直しました（日付を移したので、番号は ' + r.no + ' に変わりました）' : '予約を直しました（番号' + r.no + '）');
        // 一覧を読み直せたときだけ、詳細へ進む（読めなかったときは、ちがう予約を出さない）
        return openDay(r.date).then(function (ok) {
          if (ok) { state.sel = r.no; if (findSel()) renderDetail(); }
          else { state.date = body.date; toast('直しました。一覧を読み込めなかったので、「最新にする」を押して確かめてください。', true); }
        });
      }
      var ask = r.reason === 'closed' ? 'closed' : r.reason === 'full' ? 'full' : r.reason === 'cap' ? 'cap' : '';
      if (ask) {
        var msg = ask === 'closed'
          ? dateLabel(body.newDate || body.date) + 'は、お休みに設定してある日です。\nそれでも、この日に移しますか？'
          : ask === 'cap'
            ? 'つないだ席は ' + r.cap + '席ですが、人数は ' + body.people + '名です。\n席が足りませんが、それでも直しますか？'
            : body.seat === 'multi'
              ? 'この時間に、すでに使われている席が入っています。\nそれでも直しますか？（席が重なります）'
              : '満席です。（その時間の席は、もう埋まっています）\nそれでも直しますか？\n（名前・電話だけ直すときも、この確認が出ます）';
        confirmBox(msg, 'はい、直す', 'いいえ', false).then(function (yes) {
          if (!yes) { submit.disabled = false; return; }
          if (ask === 'closed') body.forceClosed = true; else if (ask === 'cap') body.forceCap = true; else body.forceFull = true;
          sendEdit(body, err, submit);
        });
        return;
      }
      submit.disabled = false;
      if (r.reason === 'auth' || r.reason === 'owner' || r.reason === 'locked') return fatal(r.reason);
      if (r.reason === 'nf') { err.textContent = ERR.nfedit; return; }
      err.textContent = r.reason === 'net' ? ERR.netedit : (ERR[r.reason] || ERR.error);
    });
  }

  /* ---------- 起動（LINEログイン → 本人確認 → 月の画面） ---------- */

  function start() {
    token = '';
    if (!DEMO) {
      if (!CFG.liffId || !ENDPOINT) {
        show([el('h1', { text: '予約カレンダー' }), el('p', { class: 'msg', text: 'まだ設定前です。（calendar-config.js の liffId と endpoint が空です）' })]);
        return;
      }
      if (!window.liff) { fatal('net'); return; }
    }
    show([el('p', { class: 'msg', text: '読み込み中…' })]);
    var ready = DEMO ? Promise.resolve() : window.liff.init({ liffId: CFG.liffId });
    ready.then(function () {
      if (!DEMO) {
        if (!window.liff.isLoggedIn()) { window.liff.login(); return; }
        token = window.liff.getAccessToken() || '';
        if (!token) { fatal('auth'); return; }
      }
      return loadMonth(false);
    }).catch(function () { fatal('net'); });
  }

  // 通知を見て戻ってきたときに、最新にする
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible' || busyEl) return;
    if (state.view === 'month') loadMonth(true);
    else if (state.view === 'day') openDay(state.date);
  });

  /* ---------- 画面だけ試すための、ダミーのGAS（localhost の ?demo=1 のときだけ） ---------- */

  var demo = null;
  function demoApi(p) {
    if (!demo) {
      var t = new Date(Date.now() + 9 * 3600000 - 4 * 3600000), today = t.getUTCFullYear() + '-' + pad2(t.getUTCMonth() + 1) + '-' + pad2(t.getUTCDate());
      demo = { today: today, closed: [], paused: false, days: {} };
      var tm = new Date(t.getTime() + 86400000), tmr = tm.getUTCFullYear() + '-' + pad2(tm.getUTCMonth() + 1) + '-' + pad2(tm.getUTCDate());
      demo.days[tmr] = { n: 3, list: [
        { no: 1, h: 19, name: '山田 太郎', tel: '09012345678', people: 4, seat: 'table', type: 'seat', src: 'web', ov: 0, tb: [0], note: '卵アレルギーがあります。誕生日です。' },
        { no: 2, h: 20, name: '佐藤 花子', tel: '09087654321', people: 2, seat: 'counter', type: 'seat', src: 'tel', ov: 0, tb: [], note: '' },
        { no: 3, h: 25, name: '＜script＞alert(1)＜/script＞', tel: '', people: 8, seat: 'table', type: 'banquet', src: 'walk', ov: 1, tb: [], note: '<b>太字になってはいけない</b>' }] };
      // 来店ボタンを試すための、今日と昨日の分（ネット予約と電話）
      demo.days[today] = { n: 3, list: [
        { no: 1, h: 19, name: '田中 一郎', tel: '09011112222', people: 4, seat: 'table', type: 'seat', src: 'web', ov: 0, tb: [0], note: '', vp: 0, nv: 0 },
        { no: 2, h: 20, name: '高橋 美咲', tel: '09033334444', people: 2, seat: 'counter', type: 'seat', src: 'web', ov: 0, tb: [], note: '', vp: 2, nv: 0 },
        { no: 3, h: 21, name: '電話 花子', tel: '', people: 2, seat: 'table', type: 'seat', src: 'tel', ov: 0, tb: [], note: '' }] };
      var yd = new Date(t.getTime() - 86400000), ydy = yd.getUTCFullYear() + '-' + pad2(yd.getUTCMonth() + 1) + '-' + pad2(yd.getUTCDate());
      demo.yest = ydy;
      demo.days[ydy] = { n: 1, list: [
        { no: 1, h: 20, name: '伊藤 健', tel: '09055556666', people: 3, seat: 'table', type: 'seat', src: 'web', ov: 0, tb: [0], note: '', vp: 0, nv: 0 }] };
    }
    var addDays = function (ymd, n) { var q = parts(ymd), d = new Date(Date.UTC(q.y, q.m - 1, q.d + n)); return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()); };
    var last = addDays(demo.today, 60);
    return new Promise(function (resolve) {
      setTimeout(function () {
        var day = demo.days[p.date];
        if (p.act === 'cal_month') {
          var days = [], d = demo.today;
          while (d <= last) { var x = demo.days[d]; days.push({ date: d, n: x ? x.list.length : 0, p: 0 }); d = addDays(d, 1); }
          var yl = (demo.days[demo.yest] ? demo.days[demo.yest].list : []).filter(function (z) { return z.src === 'web'; });
          return resolve({ ok: true, today: demo.today, last: last, paused: demo.paused, closed: demo.closed.slice(), days: days,
            yest: { date: demo.yest, n: yl.length, pend: yl.filter(function (z) { return !z.vp && !z.nv; }).length }, hours: { first: 18, last: 25 }, max: MAX_PEOPLE, tables: [3, 2, 6], zones: { counter: 6, wall: 4 } });
        }
        if (p.act === 'cal_day') return resolve({ ok: true, date: p.date, closed: demo.closed.indexOf(p.date) >= 0, canVisit: p.date <= demo.today, list: day ? day.list.slice().sort(function (a, b) { return a.h - b.h; }) : [] });
        if (p.act === 'cal_visit') {
          var vb = null;
          (day ? day.list : []).forEach(function (z) { if (z.no === p.no) vb = z; });
          if (!vb) return resolve({ ok: false, reason: 'nf' });
          if (vb.src !== 'web') return resolve({ ok: false, reason: 'bad' });
          vb.vp = p.v === 'came' ? p.people : 0; vb.nv = p.v === 'no' ? 1 : 0;
          return resolve({ ok: true, v: p.v === 'clear' ? '' : p.v, vp: vb.vp });
        }
        if (p.act === 'cal_closed') {
          var i = demo.closed.indexOf(p.date);
          if (p.closed && i < 0) demo.closed.push(p.date);
          if (!p.closed && i >= 0) demo.closed.splice(i, 1);
          return resolve({ ok: true, closed: !!p.closed, n: day ? day.list.length : 0 });
        }
        if (p.act === 'cal_cancel') {
          if (!day) return resolve({ ok: false, reason: 'nf' });
          for (var k = 0; k < day.list.length; k++) if (day.list[k].no === p.no) { day.list.splice(k, 1); return resolve({ ok: true }); }
          return resolve({ ok: false, reason: 'nf' });
        }
        if (p.act === 'cal_edit') {
          var eb = null;
          (day ? day.list : []).forEach(function (z) { if (z.no === p.no) eb = z; });
          if (!eb) return resolve({ ok: false, reason: 'nf' });
          if (p.newDate && eb.src === 'web') return resolve({ ok: false, reason: 'webdate' });
          if (p.newDate && p.newDate !== p.date) {
            day.list.splice(day.list.indexOf(eb), 1);
            var nd = demo.days[p.newDate] = demo.days[p.newDate] || { n: 0, list: [] };
            nd.n++; eb.no = nd.n; nd.list.push(eb);
            eb.h = p.h; eb.people = p.people; eb.type = p.type; eb.name = p.name || '（名前なし）'; eb.tel = p.tel; eb.note = p.note;
            return resolve({ ok: true, no: eb.no, date: p.newDate, over: 0 });
          }
          if (!p.forceFull && p.people > 8 && p.seat === 'table') return resolve({ ok: false, reason: 'full' });
          eb.h = p.h; eb.people = p.people; eb.type = p.type; eb.name = p.name || '（名前なし）'; eb.tel = p.tel; eb.note = p.note; if (eb.seat !== 'multi') eb.seat = p.seat;
          return resolve({ ok: true, no: eb.no, date: p.date, over: 0 });
        }
        if (p.act === 'cal_add') {
          if (demo.closed.indexOf(p.date) >= 0 && !p.forceClosed) return resolve({ ok: false, reason: 'closed' });
          day = demo.days[p.date] = demo.days[p.date] || { n: 0, list: [] };
          var un = p.units || [], dTb = [], dZn = [];
          un.forEach(function (u) { if (u.charAt(0) === 't') dTb.push(parseInt(u.slice(1), 10)); else dZn.push(u); });
          if (!un.length && p.people > 8 && !p.forceFull) return resolve({ ok: false, reason: 'full' });
          day.n++;
          day.list.push({ no: day.n, h: p.h, name: p.name || '（名前なし）', tel: p.tel, people: p.people, seat: p.seat, type: p.type, src: p.src, ov: !un.length && p.people > 8 ? 1 : 0, cf: 0, tb: dTb, zn: dZn, note: p.note });
          return resolve({ ok: true, no: day.n });
        }
        resolve({ ok: false, reason: 'bad' });
      }, 150);
    });
  }

  start();
})();
