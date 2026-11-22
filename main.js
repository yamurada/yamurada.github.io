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
      if (S.course.contact) cb.appendChild(el('p', { class: 'lead' }, [S.course.contact, el('br'), el('a', { href: telHref, text: S.tel || '' })]));
    } else {
      $('course').remove();
      var navCourse = document.querySelector('.nav a[href="#course"]');
      if (navCourse) navCourse.remove();
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
