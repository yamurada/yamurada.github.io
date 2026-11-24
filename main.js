/* ページの組み立てと動き。お店の情報は shop-data.js を直してください（ここはふだん触りません） */
(function () {
  // うまく動かなかったときでも、中身が透明のまま消えないようにする
  function showAll() { document.documentElement.classList.remove('js'); }
  function showError(msg) {
    showAll();
    var b = document.createElement('div');
    b.className = 'data-error';
    b.textContent = msg;
    document.body.insertBefore(b, document.body.firstChild);
  }

  var S = window.SHOP;
  if (!S) {
    showError('shop-data.js の書き方に間違いがあります（カンマや " の消し忘れ・付けすぎがないか見てください）。');
    return;
  }

  try { build(S); }
  catch (err) {
    console.error(err);
    showError('ページの組み立て中に問題がありました。直前に shop-data.js で直した所を見てください。（' + err.message + '）');
  }

  function build(S) {
    // ｜ は「スマホで改行してよい場所」のしるし。しるしの間はひとかたまりにして、途中で切れにくくする
    function txt(str) {
      str = String(str);
      if (str.indexOf('｜') < 0) return document.createTextNode(str);
      var f = document.createDocumentFragment();
      str.split('｜').forEach(function (part) {
        if (!part) return;
        var s = document.createElement('span');
        s.className = 'ph';
        s.textContent = part;
        f.appendChild(s);
      });
      return f;
    }
    function setText(e, str) { e.textContent = ''; e.appendChild(txt(str)); }
    function plain(str) { return String(str || '').replace(/｜/g, ''); }

    // 要素を作る小さな道具（文字はそのまま文字として入れる）
    function el(tag, attrs, children) {
      var e = document.createElement(tag);
      if (attrs) for (var k in attrs) {
        if (k === 'class') e.className = attrs[k];
        else if (k === 'text') setText(e, attrs[k]);
        else e.setAttribute(k, attrs[k]);
      }
      (children || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? txt(c) : c); });
      return e;
    }
    // 値段。数字1つなら「800円」、[650, 750] のように2つ以上なら「650円・750円」
    function yen(n) {
      if (Array.isArray(n)) return n.map(yen).filter(Boolean).join('・');
      return (typeof n === 'number') ? n.toLocaleString('ja-JP') + '円' : '';
    }
    function $(id) { return document.getElementById(id); }
    function img(src, alt, eager) {
      return el('img', { src: 'images/' + src, alt: alt || '', loading: eager ? 'eager' : 'lazy', decoding: 'async', width: '1200', height: '900' });
    }
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 1つの値を何か所にも入れる
    document.querySelectorAll('[data-shop]').forEach(function (e) {
      var v = S[e.getAttribute('data-shop')];
      if (v) setText(e, v);
    });
    var telHref = 'tel:' + String(S.tel || '').replace(/[^0-9+]/g, '');
    var mapHref = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(plain(S.address) + ' ' + plain(S.name));
    document.querySelectorAll('[data-tel]').forEach(function (a) { a.href = telHref; });
    document.querySelectorAll('[data-map]').forEach(function (a) { a.href = mapHref; });
    document.querySelectorAll('[data-insta]').forEach(function (a) { a.href = S.instagram || '#'; });
    $('year').textContent = new Date().getFullYear();

    // トップの写真（ゆっくり切り替え）
    var slides = $('heroSlides');
    (S.heroPhotos || []).forEach(function (src, i) {
      var d = el('div', { class: 'slide' + (i === 0 ? ' is-on' : '') });
      d.appendChild(img(src, '', i === 0));
      slides.appendChild(d);
    });
    var list = slides.children;
    if (list.length > 1 && !reduce) {
      var cur = 0;
      setInterval(function () {
        list[cur].classList.remove('is-on');
        cur = (cur + 1) % list.length;
        list[cur].classList.add('is-on');
      }, 6000);
    }

    // おすすめ
    var picks = $('picksList');
    (S.picks || []).forEach(function (p) {
      var card = el('div', { class: 'pick' + (p.img ? ' has-img' : '') });
      if (p.img) card.appendChild(img(p.img, p.name));
      card.appendChild(el('div', { class: 'pick-body' }, [
        p.country ? el('span', { class: 'pick-country', text: p.country }) : null,
        el('b', { text: p.name || '' }),
        el('small', { text: p.desc || '' })
      ]));
      picks.appendChild(card);
    });

    // メニュー
    var menu = $('menuList');
    (S.menu || []).forEach(function (cat) {
      var ul = el('ul', { class: 'menu' });
      (cat.items || []).forEach(function (it) {
        ul.appendChild(el('li', null, [
          el('span', { class: 'menu-name' }, [it.name || '', it.note ? el('small', { text: it.note }) : null]),
          el('b', { text: yen(it.price) })
        ]));
      });
      menu.appendChild(el('div', { class: 'menu-cat' }, [el('h3', { text: cat.category || '' }), ul]));
    });
    $('menuBadge').hidden = !S.menuProvisional;
    var notes = $('menuNotes');
    [S.menuProvisional ? S.menuNote : '', S.taxNote, S.chargeNote].filter(Boolean).forEach(function (t, i) {
      if (i) notes.appendChild(el('br'));
      notes.appendChild(txt(t));
    });

    // 宴会コース
    var cb = $('courseBox');
    if (S.course) {
      cb.appendChild(el('h2', { text: S.course.name || '宴会コース' }));
      cb.appendChild(el('p', { class: 'course-price' }, [yen(S.course.price), el('small', { text: '　' + (S.course.desc || '') })]));
      cb.appendChild(el('ol', { class: 'course-items' }, (S.course.items || []).map(function (t) { return el('li', { text: t }); })));
      var rsOn = S.reserve && /^https:\/\/script\.google\.com\//.test(S.reserve.endpoint || '') && S.reserve.turnstileSiteKey && S.privacy;
      var courseContact = (rsOn && S.reserve.courseContact) || S.course.contact;
      if (courseContact) cb.appendChild(el('p', { class: 'lead' }, [courseContact, el('br'), el('a', { href: telHref, text: S.tel || '' })]));
    } else {
      $('course').remove();
      var navCourse = document.querySelector('.nav a[href="#course"]');
      if (navCourse) navCourse.remove();
    }

    // ネット予約（予約を受け取るGASのURLと、Turnstileのサイトキーが両方あるときだけ。どちらかが空なら、予約と「プライバシーポリシー」ごと消して、電話だけにする）
    var RS = S.reserve;
    if (RS && /^https:\/\/script\.google\.com\//.test(RS.endpoint || '') && RS.turnstileSiteKey && S.privacy) {
      setupReserve(RS); // プライバシーポリシーは、別のページ（privacy.html・privacy.js）
    } else {
      $('reserve').remove();
      document.querySelectorAll('[data-reserve],[data-privacy]').forEach(function (a) { a.remove(); });
      var navRes = document.querySelector('.nav a[href="#reserve"]');
      if (navRes) navRes.remove();
    }

    function setupReserve(R) {
      var form = $('reserveForm'), done = $('reserveDone'), errBox = $('reserveError'), btn = $('reserveSubmit');
      var fDate = $('rDate'), fTime = $('rTime'), fPeople = $('rPeople'), fName = $('rName'), fTel = $('rTel'), fEmail = $('rEmail'), fNote = $('rNote'), fConsent = $('rConsent');
      form.hidden = false; // 最初はHTMLで隠してある（JavaScriptが動かないときに、使えないフォームを見せないため）
      var sending = false, availSeq = 0;
      var tsId = null, tsToken = '', tsLoading = false;
      var SEAT_TXT = { counter: 'カウンター（厨房の前）', wall: 'カウンター（壁向き）', table: 'テーブル席' }, TYPE_TXT = { seat: '席のみ', banquet: '宴会' };
      var stay = Number(R.stayHours) || 2;

      // 日本時間の「今日」から n 日後（yyyy-mm-dd）。お客さんの端末の時計や地域に左右されないようにする
      function jstDay(n) { return new Date(Date.now() + 9 * 3600 * 1000 + n * 86400 * 1000).toISOString().slice(0, 10); }
      function fullToHalf(s) { return String(s || '').replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 65248); }); }
      function onlyDigits(s) { return fullToHalf(s).replace(/[^0-9]/g, ''); }
      // 文の中にリンクがあるか（全角・空白・見えない文字でごまかしたものも見つける。GAS側と同じ見方）
      function hasLink(s) {
        var t = String(s || '');
        try { t = t.normalize('NFKC'); } catch (e) { /* そのまま調べる */ }
        t = t.toLowerCase().replace(/[​-‏‪-‮⁠-⁯﻿]/g, '').replace(/\[\.\]|\(\.\)/g, '.');
        if (/https?:|www\./.test(t.replace(/[\s　]+/g, ''))) return true;
        return /[^\s.]\.(com|net|jp|org|info|biz|xyz|cc|tk|ru|cn|ly)(\/|\?|$|[^a-z])/.test(t);
      }
      // 24時を過ぎる時間は「深夜1:00」のように見せる
      // 時間の文字（19.25 → 19:15、25.5 → 深夜1:30）。開始は15分きざみ
      function mmOf(h) { var m = Math.round((h - Math.floor(h + 1e-9)) * 60); return (m < 10 ? '0' : '') + m; }
      function hourLabel(h) { var hh = Math.floor(h + 1e-9); return h >= 24 ? '深夜' + (hh - 24) + ':' + mmOf(h) : hh + ':' + mmOf(h); }
      function amLabel(h) { return (Math.floor(h + 1e-9) - 24) + ':' + mmOf(h); } // 24時すぎの、翌日の午前の時刻
      function dateLabel(ymd) {
        var p = ymd.split('-').map(Number), w = '日月火水木金土'.charAt(new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay());
        return p[1] + '月' + p[2] + '日（' + w + '）';
      }
      function shortLabel(ymd) { var p = ymd.split('-').map(Number); return p[1] + '/' + p[2] + '（' + '日月火水木金土'.charAt(new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()) + '）'; }
      function checked(name) { var r = form.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : ''; }

      // 日付の選べる範囲：あした〜daysAhead 日先（当日は選べない）
      var days = Number(R.daysAhead) || 60;
      function setDateRange() { fDate.min = jstDay(1); fDate.max = jstDay(days); }
      setDateRange();

      // お店がお休みにした日（オーナーがLINEで送ったもの）をGASから取ってくる。取れなくても、予約はできる（送るときにGAS側でも断る）
      var closed = [];
      function renderClosed() {
        var box = $('reserveClosed'), hl = $('holidayLine');
        var old = hl.querySelector('.auto-closed');
        if (old) old.remove();
        if (!closed.length) { box.hidden = true; return; }
        var labels = closed.slice(0, 12).map(shortLabel).join('、') + (closed.length > 12 ? ' ほか' : '');
        box.textContent = '';
        box.appendChild(el('b', { text: 'お休みの予定：' }));
        box.appendChild(document.createTextNode(labels));
        box.hidden = false;
        // 営業時間のコーナーの「お休み」にも出す（今月のお休みを shop-data.js に手で書いていないときだけ）
        if (!S.holidayThisMonth) {
          var s = el('span', { class: 'auto-closed' }, [el('strong', { text: 'お休みの予定：' + labels }), el('br')]);
          hl.insertBefore(s, hl.firstChild);
        }
      }
      if (window.fetch) {
        fetch(R.endpoint + '?action=closed')
          .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
          .then(function (res) {
            if (res && res.ok && res.paused) {
              // オーナーが「予約停止」を送っているあいだ（自動停止も含む）は、フォームを隠して電話だけにする
              form.hidden = true;
              var pb = $('reserveClosed');
              pb.textContent = 'ただいま、ネット予約をお休みしています。お電話でご予約をお願いします。';
              pb.hidden = false;
              return;
            }
            if (res && res.ok && Array.isArray(res.closed)) {
              closed = res.closed.filter(function (s) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }).sort();
              renderClosed();
            }
          })
          .catch(function (err) { console.warn('お休みの日を取れませんでした', err); });
      }

      // 人数の選択肢（席によって、選べる最大の人数が変わる）
      function fillPeople() {
        var sk = checked('seat');
        var max = sk === 'counter' ? (Number(R.counterMax) || 6) : sk === 'wall' ? (Number(R.wallMax) || 4) : (Number(R.tableMax) || 11);
        var keep = fPeople.value;
        fPeople.textContent = '';
        fPeople.appendChild(el('option', { value: '', text: '選んでください' }));
        for (var n = 1; n <= max; n++) fPeople.appendChild(el('option', { value: String(n), text: n + '名' }));
        if (keep && Number(keep) <= max) fPeople.value = keep;
      }
      fillPeople();

      // 時間の選択肢：日付・人数・お席が決まったら、GASに空きを聞いて、満席の時間は選べなくする
      function resetTime(msg) {
        fTime.textContent = '';
        fTime.appendChild(el('option', { value: '', text: msg || '日付・人数・お席を選ぶと、空いている時間が出ます' }));
        fTime.disabled = true;
        $('rTimeHint').hidden = true;
      }
      function updateHint() {
        var hint = $('rTimeHint'), h = Number(fTime.value);
        if (!fTime.value || !(h >= 24) || !fDate.value) { hint.hidden = true; return; }
        hint.textContent = '深夜の時間は、選んだ日の夜の続きです（' + shortLabel(fDate.value) + 'の営業日 ＝ 翌日の午前' + amLabel(h) + '）。';
        hint.hidden = false;
      }
      function loadSlots() {
        var date = fDate.value, people = fPeople.value, seat = checked('seat');
        if (!date || !people || !seat) { resetTime(); return; }
        if (date < jstDay(1) || date > jstDay(days)) { resetTime('日付を選びなおしてください'); return; }
        if (closed.indexOf(date) >= 0) { resetTime('お店のお休みの日です'); return; }
        if (!window.fetch) { resetTime('お電話でご予約をお願いします'); return; }
        var seq = ++availSeq, keep = fTime.value;
        resetTime('空きを確かめています…');
        fetch(R.endpoint + '?action=avail&date=' + encodeURIComponent(date) + '&people=' + encodeURIComponent(people) + '&seat=' + encodeURIComponent(seat))
          .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
          .then(function (res) {
            if (seq !== availSeq) return; // もっと新しい問い合わせがあるときは、古い答えは使わない
            if (!res || !res.ok) {
              resetTime(res && res.reason === 'paused' ? 'ただいま、ネット予約をお休みしています'
                : res && (res.reason === 'late' || res.reason === 'far') ? '受付は前日の23:59までです。日付を選びなおしてください'
                : 'うまく確かめられませんでした。お電話でお願いします');
              return;
            }
            if (res.closed) { resetTime('お店のお休みの日です'); return; }
            fTime.textContent = '';
            var head = el('option', { value: '', text: '選んでください' });
            fTime.appendChild(head);
            var any = false, grp = null, grpKey = null;
            (res.slots || []).forEach(function (s) {
              var hh = Math.floor(s.h + 1e-9); // 15分きざみの枠を、1時間ごとのまとまりに分けて見やすくする
              if (hh !== grpKey) {
                grpKey = hh;
                grp = el('optgroup', { label: (hh >= 24 ? '深夜' + (hh - 24) : hh) + '時台' });
                fTime.appendChild(grp);
              }
              var o = el('option', { value: String(s.h), text: hourLabel(s.h) + '〜' + hourLabel(s.h + stay) + (s.ok ? '' : '（満席）') });
              if (s.ok) any = true; else o.disabled = true;
              grp.appendChild(o);
            });
            if (!any) head.textContent = 'この条件は満席です。日付・人数・お席を変えてください';
            fTime.disabled = !any;
            if (keep && fTime.querySelector('option[value="' + keep + '"]:not([disabled])')) fTime.value = keep;
            updateHint();
          })
          .catch(function (err) {
            if (seq !== availSeq) return;
            console.warn('空きを取れませんでした', err);
            resetTime('うまく確かめられませんでした。お電話でお願いします');
          });
      }
      resetTime();

      // 人間かどうかの確認（Cloudflare Turnstile）。予約の入力を始めたときに、はじめて読み込む
      function ensureTs() {
        if (tsId !== null || tsLoading) return;
        tsLoading = true;
        function render() {
          try {
            tsId = window.turnstile.render('#rTurnstile', {
              sitekey: R.turnstileSiteKey, language: 'ja', theme: 'dark', size: 'flexible', // 小さいスマホでも、はみ出さない
              callback: function (t) { tsToken = t; },
              'expired-callback': function () { tsToken = ''; },
              'error-callback': function () { tsToken = ''; }
            });
          } catch (err) { console.warn('確認の表示に失敗', err); tsLoading = false; }
        }
        if (window.turnstile) { render(); return; }
        var s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.async = true;
        s.onload = render;
        s.onerror = function () { tsLoading = false; };
        document.head.appendChild(s);
      }
      function resetTs() {
        tsToken = '';
        try { if (window.turnstile && tsId !== null) window.turnstile.reset(tsId); } catch (err) { /* 何もしない */ }
      }
      form.addEventListener('focusin', ensureTs);
      form.addEventListener('change', ensureTs);

      var note = $('reserveNote');
      if (R.note) note.appendChild(txt(R.note)); else note.hidden = true;

      function clearBad() { [fDate, fTime, fPeople, fName, fTel, fEmail, fNote, fConsent].forEach(function (f) { f.classList.remove('is-bad'); f.removeAttribute('aria-invalid'); }); }
      function showErr(msg, field, withTel) {
        errBox.textContent = '';
        errBox.appendChild(txt(msg));
        if (withTel) { errBox.appendChild(el('br')); errBox.appendChild(el('a', { href: telHref, text: S.tel || '' })); }
        errBox.hidden = false;
        if (field) { field.classList.add('is-bad'); field.setAttribute('aria-invalid', 'true'); field.focus(); }
      }
      function setSending(on) {
        sending = on;
        btn.disabled = on;
        btn.textContent = on ? '送信しています…' : '予約する';
      }

      // 入力の確かめ（お店側のGASでも、同じことをもう一度確かめます）
      function check(d) {
        if (!d.date) return ['ご来店の日を選んでください。', fDate];
        if (d.date < jstDay(1)) return ['ネット予約は前日の23:59までです。当日のご予約は、お電話でお願いします。', fDate, true];
        if (d.date > jstDay(days)) return [days + '日より先のご予約は、お電話でお願いします。', fDate, true];
        if (closed.indexOf(d.date) >= 0) return ['その日は、お店がお休みです。別の日を選んでください。', fDate];
        if (!d.people) return ['人数を選んでください。', fPeople];
        if (!d.seat) return ['お席（カウンター（厨房の前）／カウンター（壁向き）／テーブル席）を選んでください。', null];
        if (!d.type) return ['「席のみ」か「宴会」かを選んでください。', null];
        if (!d.h) return ['お時間を選んでください。', fTime];
        if (!d.name) return ['お名前を入れてください。', fName];
        if (!/^0\d{9,10}$/.test(d.tel)) return ['お電話番号を、市外局番から数字で入れてください（例：090-1234-5678）。', fTel];
        if (d.email.length > 100 || !/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(\.[A-Za-z0-9\-]+)+$/.test(d.email)) return ['メールアドレスを、正しく入れてください（例：example@gmail.com）。', fEmail];
        if (hasLink(d.note)) return ['ご要望・ご質問の欄に、URL（http…）は入れられません。', fNote];
        if (!fConsent.checked) return ['個人情報の使い道を読んで、チェックを入れてください。', fConsent];
        if (!tsToken) return ['「人間かどうかの確認」を済ませてください。表示されないときは、お電話でお願いします。', null, true];
        return null;
      }

      // キャンセルの決まり（shop-data.js の reserve.cancelPolicy）を、予約欄の送信ボタンの上に出す
      var policyBox = $('reservePolicy');
      if (R.cancelPolicy && R.cancelPolicy.length) {
        policyBox.appendChild(el('h4', { text: 'キャンセルについて' }));
        var ul = el('ul');
        R.cancelPolicy.forEach(function (t) { ul.appendChild(el('li', null, [txt(t)])); });
        policyBox.appendChild(ul);
        policyBox.hidden = false;
      }

      function showDone(d, no, mailOk) {
        form.hidden = true;
        done.textContent = '';
        var doneTitle = el('h3', { text: 'ご予約が確定しました', tabindex: '-1' });
        done.appendChild(doneTitle);
        done.appendChild(el('p', { class: 'sum' }, [
          '予約番号　' + no, el('br'),
          dateLabel(d.date), el('br'),
          hourLabel(d.h) + '〜' + hourLabel(d.h + stay) + '（' + stay + '時間）', el('br'),
          d.h >= 24 ? '（' + shortLabel(d.date) + 'の営業日 ＝ 翌日の午前' + amLabel(d.h) + '）' : null, d.h >= 24 ? el('br') : null,
          d.people + '名　' + SEAT_TXT[d.seat] + '（' + TYPE_TXT[d.type] + '）', el('br'),
          'お名前　' + d.name + ' 様', el('br'),
          'メール　' + d.email
        ]));
        if (mailOk === true) {
          done.appendChild(el('p', null, ['ご入力のメールアドレスに、確認メールをお送りしました。', el('br'), 'キャンセルは、メールのURLから、メールに書いてある期限（ご来店の前日の23:59）までできます。', el('br'), '届かないときは、迷惑メールのフォルダもご確認ください。']));
        } else if (mailOk !== false) {
          done.appendChild(el('p', null, ['先にお送りした確認メールを、ご確認ください。', el('br'), '届かないときは、迷惑メールのフォルダを見て、それでもないときは、お電話でお願いします。']));
        } else {
          done.appendChild(el('p', { class: 'mail-ng' }, ['確認メールを送れませんでした。', el('br'), 'ご予約は確定しています。キャンセルをご希望のときは、お電話でお願いします。']));
        }
        if (R.cancelPolicy && R.cancelPolicy.length) {
          var ul2 = el('ul', { class: 'cancel-list' });
          // メールを送れなかったときは、「メールのURLから」の1行目は出さない（「お電話で」と食い違って見えるため）
          (mailOk === false ? R.cancelPolicy.slice(1) : R.cancelPolicy).forEach(function (t) { ul2.appendChild(el('li', null, [txt(t)])); });
          done.appendChild(el('div', { class: 'cancel-policy' }, [el('h4', { text: 'キャンセルについて' }), ul2]));
        }
        if (d.note) {
          done.appendChild(el('p', { class: 'sum' }, ['お預かりしたご要望・ご質問', el('br'), d.note]));
          done.appendChild(el('p', { text: 'お店で確認して、必要なときはお電話でご連絡します。' }));
        }
        if (R.confirmNote) done.appendChild(el('p', { text: R.confirmNote }));
        done.appendChild(el('p', { class: 'more' }, [el('a', { class: 'btn', href: telHref, text: '電話する' })]));
        var again = el('button', { class: 'btn', type: 'button', text: '別の予約を入れる' });
        again.addEventListener('click', function () {
          done.hidden = true; form.hidden = false; form.reset(); clearBad(); errBox.hidden = true; setDateRange();
          fillPeople(); resetTime(); resetTs();
          $('reserve').scrollIntoView({ block: 'start' });
        });
        done.appendChild(el('p', { class: 'more' }, [again]));
        done.hidden = false;
        doneTitle.focus({ preventScroll: true }); // 読み上げ機能にも「できた」と伝わるように
        $('reserve').scrollIntoView({ block: 'start' });
      }

      var FAIL = {
        late: ['ネット予約は前日の23:59までです。当日のご予約は、お電話でお願いします。', true],
        far: [days + '日より先のご予約は、お電話でお願いします。', true],
        closed: ['その日は、お店がお休みです。別の日を選んでください。', false],
        url: ['ご要望・ご質問の欄に、URL（http…）は入れられません。', false],
        email: ['メールアドレスを、正しく入れてください（例：example@gmail.com）。', false],
        full: ['ちょうど、その時間が埋まりました。別の時間・お席をお選びください。', false],
        verify: ['「人間かどうかの確認」が通りませんでした。もう一度お試しください。うまくいかないときは、お電話でお願いします。', true],
        bad: ['入力の内容を確かめてください。うまくいかないときは、お電話でお願いします。', true]
      };

      // 日付・人数・お席を選んだ時点で、空いている時間を出す。お休みの日なら、先に知らせる
      fDate.addEventListener('change', function () {
        clearBad(); errBox.hidden = true;
        if (closed.indexOf(fDate.value) >= 0) showErr('その日は、お店がお休みです。別の日を選んでください。', null);
        loadSlots();
      });
      fPeople.addEventListener('change', loadSlots);
      fTime.addEventListener('change', updateHint);
      form.querySelectorAll('input[name="seat"]').forEach(function (r) {
        r.addEventListener('change', function () { fillPeople(); loadSlots(); });
      });

      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        if (sending) return;
        clearBad(); errBox.hidden = true;
        var d = {
          date: fDate.value, h: Number(fTime.value) || 0, people: fPeople.value, seat: checked('seat'), type: checked('type'),
          name: fName.value.trim(), tel: onlyDigits(fTel.value), email: fEmail.value.trim().toLowerCase(), note: fNote.value.trim(), website: $('rWebsite').value
        };
        var bad = check(d);
        if (bad) { showErr(bad[0], bad[1], bad[2]); return; }

        setSending(true);
        var ctrl = window.AbortController ? new AbortController() : null;
        var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);
        var payload = {
          date: d.date, h: d.h, people: d.people, seat: d.seat, type: d.type, name: d.name, tel: d.tel, email: d.email, note: d.note, website: d.website, cf: tsToken
        };
        // 「text/plain」で送ると、ブラウザの事前確認（CORS）が省けて、GASで受け取れる
        fetch(R.endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload), signal: ctrl ? ctrl.signal : undefined })
          .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
          .then(function (res) {
            clearTimeout(timer); setSending(false);
            if (res && res.ok) { showDone(d, res.no, res.mail); resetTs(); return; }
            resetTs(); // 確認の札は1回しか使えない
            var f = FAIL[res && res.reason];
            if (res && res.reason === 'full') loadSlots();
            if (f) showErr(f[0], res.reason === 'late' || res.reason === 'far' || res.reason === 'closed' ? fDate : (res.reason === 'full' ? fTime : (res.reason === 'url' ? fNote : (res.reason === 'email' ? fEmail : null))), f[1]);
            else showErr('うまく受け付けられませんでした。お手数ですが、お電話でご予約をお願いします。', null, true);
          })
          .catch(function (err) {
            clearTimeout(timer); setSending(false); resetTs();
            console.warn('予約を送れませんでした', err);
            // 送れたのか分からないときは、決めつけずに電話で確かめてもらう
            showErr('通信がうまくいきませんでした。予約が入ったかどうか分からないため、お手数ですが、お電話でご確認ください。', null, true);
          });
      });
    }

    // 写真
    var ph = $('photoList');
    (S.photos || []).forEach(function (p) { ph.appendChild(img(p.src, p.alt)); });

    // Instagramの最新投稿（Beholdのアドレスがあるときだけ。うまく取れないときは案内のボタンだけ出す）
    if (S.instaFeed && window.fetch) {
      var instaSec = $('insta');
      var loadInsta = function () {
        var KEY = 'yamurada-insta-v1';
        var cached = null;
        try { cached = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
        if (!cached || cached.url !== S.instaFeed || !Array.isArray(cached.posts)) cached = null;
        // 同じ人が何度も開いても、6時間は前に取った分を使う（無料の回数を節約）
        if (cached && Date.now() - cached.time < 6 * 3600 * 1000) { showInsta(cached.posts); return; }
        // 検索エンジンなどの機械には取りに行かない（回数を節約）
        if (/bot|crawl|spider|slurp|lighthouse/i.test(navigator.userAgent || '')) { if (cached) showInsta(cached.posts); return; }
        var ctrl = window.AbortController ? new AbortController() : null;
        var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);
        fetch(S.instaFeed, ctrl ? { signal: ctrl.signal } : {})
          .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
          .then(function (d) {
            clearTimeout(timer);
            var posts = (d && d.posts || []).slice(0, 6).map(function (p) {
              var sz = p.sizes || {};
              var pic = (sz.medium && sz.medium.mediaUrl) || (sz.small && sz.small.mediaUrl) || (p.mediaType === 'VIDEO' ? p.thumbnailUrl : p.mediaUrl);
              return { link: p.permalink, img: pic, date: p.timestamp, text: p.prunedCaption || p.caption || '', video: p.mediaType === 'VIDEO' };
            }).filter(function (p) { return p.img && /^https:\/\//.test(p.img) && /^https:\/\/(www\.)?instagram\.com\//.test(p.link || ''); });
            try { localStorage.setItem(KEY, JSON.stringify({ url: S.instaFeed, time: Date.now(), posts: posts })); } catch (e) {}
            showInsta(posts);
          })
          .catch(function (err) {
            clearTimeout(timer);
            console.warn('Instagramの投稿を取れませんでした', err);
            // 取れなかったとき（上限で止まったときなど）は、30日以内に取った分があればそれを出す
            if (cached && Date.now() - cached.time < 30 * 24 * 3600 * 1000) showInsta(cached.posts);
          });
      };
      var showInsta = function (posts) {
        if (!posts || !posts.length) return;
        var box = $('instaList');
        box.textContent = '';
        var thisYear = new Date().getFullYear();
        posts.forEach(function (p) {
          if (!p || !p.img || !p.link) return;
          var d = new Date(p.date);
          var when = isNaN(d) ? '' : (d.getFullYear() !== thisYear ? d.getFullYear() + '年' : '') + (d.getMonth() + 1) + '月' + d.getDate() + '日';
          var chars = Array.from(String(p.text || '').replace(/\s+/g, ' ').trim()); // 絵文字が半分にならないように1文字ずつ数える
          var short = chars.length > 40 ? chars.slice(0, 39).join('') + '…' : chars.join('');
          box.appendChild(el('a', { class: 'insta-post', href: p.link, target: '_blank', rel: 'noopener', 'aria-label': (when ? when + 'の投稿：' : '投稿：') + (short || 'Instagram') }, [
            el('img', { src: p.img, alt: '', loading: 'lazy', decoding: 'async', width: '400', height: '400' }),
            p.video ? el('span', { class: 'insta-play', 'aria-hidden': 'true', text: '▶' }) : null,
            el('span', { class: 'insta-cap' }, [when ? el('b', { text: when }) : null, short ? el('span', { text: short }) : null])
          ]));
        });
        box.hidden = false;
      };
      // ページの下の方まで来た人の分だけ取りに行く（無料の回数を節約）
      if ('IntersectionObserver' in window) {
        var instaIo = new IntersectionObserver(function (es) {
          if (es.some(function (e) { return e.isIntersecting; })) { instaIo.disconnect(); loadInsta(); }
        }, { rootMargin: '400px 0px' });
        instaIo.observe(instaSec);
      } else { loadInsta(); }
    }

    // 「お店について」・外観の写真（ないときは何も出さない。見本のあいだは「写真準備中」の枠）
    function spot(id, src, caption, label) {
      var f = $(id);
      var empty = function () { return el('div', { class: 'spot-empty', text: label + '｜（写真準備中）' }); };
      if (src) {
        var pic = img(src, label + (caption ? '（' + caption + '）' : ''));
        // ファイル名の書き間違いなどで写真が出ないときは、壊れたマークを見せない
        pic.onerror = function () {
          console.warn('写真が見つかりません：images/' + src + '（ファイル名の大文字・小文字も確かめてください）');
          if (S.photoPlaceholder) { f.textContent = ''; f.appendChild(empty()); } else { f.hidden = true; }
        };
        f.appendChild(pic);
        if (caption) f.appendChild(el('figcaption', { text: caption }));
      } else if (S.photoPlaceholder) {
        f.appendChild(empty());
      } else { return; }
      f.hidden = false;
    }
    if (S.aboutPhoto) spot('aboutPhoto', S.aboutPhoto, S.aboutCaption, '店内の写真'); // 空なら「写真準備中」の枠も出さない
    spot('outsidePhoto', S.outsidePhoto, S.outsideCaption, '外観・入口の写真');

    // お店について
    var ab = $('aboutText');
    (S.about || []).forEach(function (t) { ab.appendChild(el('p', { text: t })); });

    // Googleの口コミ（星の数・件数・よく言われていること）
    var R = S.reviews;
    if (R) {
      var rb = $('reviewBox');
      var rate = Number(R.rating);
      var full = isNaN(rate) ? 0 : Math.max(0, Math.min(5, Math.round(rate)));
      rb.appendChild(el('h2', { text: 'お客さまの声' }));
      rb.appendChild(el('p', { class: 'review-score' }, [
        el('span', { class: 'stars', 'aria-hidden': 'true', text: '★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(0, 5 - full) }),
        isNaN(rate) ? null : el('b', { text: rate.toFixed(1) }),
        el('small', { text: 'Googleの口コミ' + (R.count ? '｜' + R.count + '件' : '') + (R.asOf ? '｜（' + R.asOf + '時点）' : '') })
      ]));
      if (R.points && R.points.length) {
        rb.appendChild(el('p', { class: 'lead', text: '口コミに寄せられた声（要約）' }));
        rb.appendChild(el('ul', { class: 'review-points' }, R.points.map(function (t) { return el('li', { text: t }); })));
      }
      if (R.url) rb.appendChild(el('p', { class: 'more' }, [el('a', { class: 'btn', href: R.url, target: '_blank', rel: 'noopener', text: 'Googleで口コミを読む' })]));
    } else {
      $('reviews').remove();
    }

    // 今月のお休み
    var hl = $('holidayLine');
    if (S.holidayThisMonth) hl.appendChild(el('strong', { text: S.holidayThisMonth }));
    else hl.appendChild(el('span', null, ['お休みの日は｜', el('a', { href: S.instagram || '#', target: '_blank', rel: 'noopener', text: 'Instagram' }), 'で｜お知らせしています']));

    // 地図
    $('mapBox').appendChild(el('iframe', {
      title: plain(S.name) + 'の地図', loading: 'lazy', referrerpolicy: 'no-referrer-when-downgrade',
      src: 'https://maps.google.com/maps?q=' + encodeURIComponent(plain(S.address)) + '&z=16&output=embed'
    }));

    // スクロールで、ふわっと出す
    var items = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window && !reduce) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -10% 0px' });
      items.forEach(function (e) { io.observe(e); });
    } else {
      showAll();
    }

    // 目次の今いる場所に印をつける
    var navLinks = document.querySelectorAll('.nav a');
    if ('IntersectionObserver' in window) {
      var secIo = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          navLinks.forEach(function (a) { a.classList.toggle('is-here', a.getAttribute('href') === '#' + e.target.id); });
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      document.querySelectorAll('main section[id]').forEach(function (s) { secIo.observe(s); });
    }

    // Googleにお店の情報を伝える（構造化データ）。値は shop-data.js の google 欄から
    var g = S.google || {};
    var ld = {
      '@context': 'https://schema.org', '@type': 'Restaurant',
      name: plain(S.name), telephone: S.tel,
      address: { '@type': 'PostalAddress', addressCountry: 'JP', addressRegion: g.region, addressLocality: g.city, streetAddress: plain(g.street) },
      servesCuisine: g.cuisine,
      sameAs: [S.instagram]
    };
    if (g.openingHours) ld.openingHours = g.openingHours;
    if (g.url) ld.url = g.url;
    document.head.appendChild(el('script', { type: 'application/ld+json', text: JSON.stringify(ld) }));
  }
})();
