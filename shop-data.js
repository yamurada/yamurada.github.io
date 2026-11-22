/* =========================================================
   YAMURADA お店の情報（ここだけ直せばページに反映されます）
   ・文字は " " の中だけを書きかえる。文字の中で " は使わず「」を使う
   ・行の終わりの , （カンマ）は消さない。
     リストの「最後の行」にはカンマがない。行を足すときは、前の行の終わりにカンマを足す
   ・値段は数字だけ（例：1100）。カンマや「円」は付けない
   ・写真のファイル名は、大文字・小文字まで images/ の中と同じに書く
   ・営業時間や行き方を変えたら、index.html の上の方（title・description）も直す
   ・書き間違えると、ページの一番上に赤い帯で知らせが出ます
   ・｜（たて線）は「スマホで改行してよい場所」のしるし。画面には出ません。
     しるしの間は、なるべく途中で切れずに次の行へまとめて送られます
   ========================================================= */
window.SHOP = {
  name: "多国籍酒場YAMURADA",
  nameEn: "YAMURADA",
  catch: "東南アジアの料理とお酒を、｜小山で朝4時まで。",
  tel: "050-8888-4547",
  address: "栃木県小山市｜城東2丁目21-2",
  access: "小山駅から徒歩12分",
  hours: "18:00〜翌4:00",
  holiday: "不定休",
  holidayThisMonth: "",
  seats: "カウンター6席・｜テーブル15席｜（おひとり様から｜団体様まで）",
  parking: "店の前に2台＋｜徒歩1分の場所に3台",
  payment: "現金、｜クレジットカード、｜PayPay・楽天ペイ・｜d払い・au PAY、｜交通系ICカード、｜電子マネー",
  instagram: "https://www.instagram.com/yamurada2026/",
  instaFeed: "https://feeds.behold.so/Q5s7wA0wCA5APKJ1cxuC",

  about: [
    "2026年2月、｜小山にオープンした｜多国籍酒場です。",
    "タイ・ベトナム・｜フィリピンなど、｜東南アジアの料理を｜1軒で。｜現地の調味料や｜ハーブにこだわって｜作っています。",
    "市場で仕入れた鮮魚を｜アジアの味つけで出す、｜限定メニューも。｜朝4時まで｜開いているので、｜仕事帰りや｜二次会にもどうぞ。"
  ],

  reviews: null,

  picks: [
    { name: "ガパオライス", desc: "豚肉とホーリーバジルの炒めごはん。目玉焼きのせ", country: "タイ", img: "gapao.jpg" },
    { name: "ビーフフォー", desc: "牛肉とハーブをのせた、米粉の麺", country: "ベトナム", img: "pho.jpg" },
    { name: "ガイヤーン", desc: "タイのグリルチキン", country: "タイ", img: "gaiyang.jpg" },
    { name: "エビの生春巻き", desc: "エビを巻いた生春巻き。ベトナムでは「ゴイクン」", country: "ベトナム", img: "harumaki.jpg" }
  ],

  menuProvisional: false,
  menuNote: "",
  menu: [
    { category: "ごはん", items: [
      { name: "グリーンカレー", price: 1050 },
      { name: "ガパオライス", price: 1100 }
    ]},
    { category: "麺", items: [
      { name: "パッタイ", price: 1200 },
      { name: "ビーフフォー", price: 1200 },
      { name: "ブンボーフエ", price: 1300, note: "ベトナム・フエの辛い麺" }
    ]},
    { category: "おつまみ・一品", items: [
      { name: "ガイヤーン", price: 800 },
      { name: "エビの生春巻き", price: 750 }
    ]},
    { category: "デザート", items: [
      { name: "紫山芋（ウベ）の｜アイス", price: 450 },
      { name: "バニラアイス", price: 400 }
    ]},
    { category: "ドリンク", items: [
      { name: "生ビール｜（ハートランド）", price: 750 },
      { name: "シンハー／｜チャーン（瓶）", price: 800 },
      { name: "カクテル", price: [650, 750] },
      { name: "グラスワイン", price: 600 },
      { name: "ソフトドリンク", price: 450 }
    ]}
  ],
  taxNote: "すべて税込です。",
  chargeNote: "お酒を飲むお客様が｜いる席は、｜お酒を飲まない方も含めて、｜お一人様チャージ300円を｜いただきます。",

  course: {
    name: "宴会コース",
    price: 3000,
    desc: "全6品・税込",
    items: ["ゴイガー", "生春巻き", "スイートチリポテト", "ガイヤーン", "ポークアドボ", "パッタイ"],
    contact: "ご予約は｜お電話でお願いします。"
  },

  heroPhotos: ["inside_table.jpg", "sawara.jpg", "curry.jpg"],

  aboutPhoto: "",
  aboutCaption: "",
  outsidePhoto: "outside_front.jpg",
  outsideCaption: "この入口が目印です",
  photoPlaceholder: false,
  photos: [
    { src: "sawara.jpg", alt: "サワラの料理" },
    { src: "curry.jpg", alt: "カレー" },
    { src: "carpaccio.jpg", alt: "アジアン風カルパッチョ" },
    { src: "gelato.jpg", alt: "紫山芋のアイス" },
    { src: "noodle.jpg", alt: "麺料理" }
  ],

  google: {
    region: "栃木県",
    city: "小山市",
    street: "城東2丁目21-2",
    cuisine: ["タイ料理", "ベトナム料理", "フィリピン料理", "インドネシア料理"],
    openingHours: "",
    url: "https://yamurada.github.io/"
  }
};
