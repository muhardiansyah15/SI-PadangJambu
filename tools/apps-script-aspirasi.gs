/**
 * Form Kontak & Aspirasi — Korong Padang Jambu
 *
 * Pasang di: spreadsheet ASPIRASI (privat) > Extensions > Apps Script (ganti isi Code.gs)
 * Deploy: Deploy > New deployment > Web app
 *   - Execute as: Me
 *   - Who has access: Anyone
 * Spreadsheet TETAP PRIVAT — hanya URL /exec skrip ini yang publik.
 * Salin URL /exec ke konstanta ASPIRASI_URL di index.html.
 *
 * @OnlyCurrentDoc  — izin skrip dibatasi HANYA ke spreadsheet ini,
 * bukan seluruh Drive/akun. Google menegakkan batas ini saat otorisasi.
 */
var SHEET_NAME = "ASPIRASI";

function lembar_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(["Waktu", "Nama", "Kontak", "Pesan"]);
  }
  return sh;
}

/** Cegah formula injection: teks berawalan = + - @ disimpan sebagai teks biasa. */
function teks_(v) {
  v = String(v);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** GET: cek hidup saja — isi aspirasi TIDAK pernah keluar lewat endpoint publik. */
function doGet() {
  return json_({ ok: true });
}

/**
 * POST {nama, kontak, pesan}: simpan aspirasi warga (publik).
 * Rem sederhana: maks. 1 kiriman per 30 detik untuk seluruh situs
 * (cukup untuk korong kecil, menahan spam beruntun dari skrip).
 */
function doPost(e) {
  var ok = false;
  try {
    var p = JSON.parse(e.postData.contents || "{}");
    var nama = String(p.nama || "").trim().slice(0, 80);
    var kontak = String(p.kontak || "").trim().slice(0, 80);
    var pesan = String(p.pesan || "").trim().slice(0, 1000);

    if (pesan) {
      var cache = CacheService.getScriptCache();
      if (cache.get("rem_aspirasi")) {
        return json_({ ok: false, pesan: "Terlalu cepat. Coba lagi sebentar lagi." });
      }
      cache.put("rem_aspirasi", "1", 30);

      // LockService: appendRow aman saat ada kiriman bersamaan
      var lock = LockService.getScriptLock();
      lock.waitLock(5000);
      try {
        lembar_().appendRow([new Date(), teks_(nama || "-"), teks_(kontak || "-"), teks_(pesan)]);
      } finally {
        lock.releaseLock();
      }
      ok = true;
    }
  } catch (err) {}
  return json_({ ok: ok });
}
