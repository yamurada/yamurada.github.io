/* =========================================================
   予約カレンダーの設定（ここだけ直します）
   ・liffId：LINE Developers の「LINEログイン」チャネル → LIFF タブ → 作った LIFF の「LIFF ID」（例：2001234567-AbCdEfGh）
     ※これは鍵ではなく、ページの番号です。人に見えても、予約は見られません（見るには、オーナーのLINEでのログインが必要）
   ・endpoint：GASの「ウェブアプリのURL」（https://script.google.com/macros/s/…/exec）。予約欄と同じものを入れる
     ※ここに入れても、HPの予約欄は動き出しません（予約欄は shop-data.js の設定だけで動きます）
   ・どちらかが空のあいだは、ページは「設定前です」と出すだけです
   ========================================================= */
window.CAL_CONFIG = {
  liffId: "2012751802-LjTLBUDF",
  endpoint: "https://script.google.com/macros/s/AKfycbxlJONFVUBcL75T4tgRXtobTzNpLwdM2U_p41d5VwPpCQHJjqolAZiK5c0tn3M_3jpaOA/exec"
};
