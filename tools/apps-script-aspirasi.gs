/**
 * Form Kontak & Aspirasi + Portal Admin — Korong Padang Jambu
 *
 * Pasang di: spreadsheet ASPIRASI (privat) > Extensions > Apps Script (ganti isi Code.gs)
 * Deploy: Deploy > New deployment > Web app
 *   - Execute as: Me
 *   - Who has access: Anyone
 * Spreadsheet TETAP PRIVAT — hanya URL /exec skrip ini yang publik.
 * Salin URL /exec ke konstanta ASPIRASI_URL di index.html dan admin.html.
 *
 * Akun admin: isi sheet "ADMIN" (Username | Password | Nama).
 * Gunakan password karangan — JANGAN password asli akun lain.
 * Login diverifikasi di server ini; admin.html tak pernah menyimpan password.
 *
 * @OnlyCurrentDoc  — izin skrip dibatasi HANYA ke spreadsheet ini,
 * bukan seluruh Drive/akun. Google menegakkan batas ini saat otorisasi.
 */
var SHEET_NAME = "ASPIRASI";
var SHEET_USER = "ADMIN";
var SHEET_PENDUDUK = "PENDUDUK";
var SHEET_PENGUMUMAN = "PENGUMUMAN";
var TOKEN_HARI = 7; // token login berlaku 7 hari
var KATEGORI_SAH = ["penting", "kegiatan", "layanan"];

function lembar_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(["Waktu", "Nama", "Kontak", "Pesan"]);
  }
  return sh;
}

function lembarUser_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_USER) || ss.insertSheet(SHEET_USER);
  if (sh.getLastRow() === 0) {
    sh.appendRow(["Username", "Password", "Nama"]);
  }
  return sh;
}

function lembarPengumuman_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_PENGUMUMAN) || ss.insertSheet(SHEET_PENGUMUMAN);
  if (sh.getLastRow() === 0) {
    sh.appendRow(["ID", "Waktu Terbit", "Judul", "Kategori", "Isi", "Tanggal Acara", "Jam", "Tempat"]);
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

/**
 * Sheet PENDUDUK: diisi perangkat korong LANGSUNG di Google Sheets (privat),
 * bukan lewat portal. Sengaja minim data — tanpa NIK, tanpa tanggal lahir
 * lengkap (asas minimalisasi UU PDP). Yang keluar ke publik HANYA agregat.
 */
function lembarPenduduk_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_PENDUDUK) || ss.insertSheet(SHEET_PENDUDUK);
  if (sh.getLastRow() === 0) {
    sh.appendRow(["Nama", "RW", "JK (L/P)", "Tahun Lahir", "Pekerjaan", "Pendidikan", "Kepala Keluarga (Y)"]);
  }
  return sh;
}

function kelompokUmur_(umur) {
  if (umur <= 14) return "0–14 tahun";
  if (umur <= 24) return "15–24 tahun";
  if (umur <= 44) return "25–44 tahun";
  if (umur <= 59) return "45–59 tahun";
  return "60 tahun ke atas";
}

/** Ambil 5 kelompok terbesar, sisanya digabung jadi "Lainnya". */
function kelompokkan_(peta) {
  var pasang = [];
  for (var k in peta) if (k !== "Lainnya") pasang.push([k, peta[k]]);
  pasang.sort(function (a, b) { return b[1] - a[1]; });
  var hasil = pasang.slice(0, 5);
  var sisa = peta["Lainnya"] || 0;
  for (var i = 5; i < pasang.length; i++) sisa += pasang[i][1];
  if (sisa > 0) hasil.push(["Lainnya", sisa]);
  return hasil;
}

/**
 * Hitung statistik agregat dari sheet PENDUDUK.
 * Bentuknya SAMA dengan objek STATISTIK di index.html.
 * Di-cache 10 menit supaya tidak membaca ulang sheet tiap kunjungan;
 * artinya perubahan data baru terlihat di situs maks. 10 menit kemudian.
 */
function hitungStatistik_() {
  var cache = CacheService.getScriptCache();
  var simpanan = cache.get("stat_agregat");
  if (simpanan) return JSON.parse(simpanan);

  var rows = lembarPenduduk_().getDataRange().getValues();
  var tahunKini = new Date().getFullYear();
  var laki = 0, perempuan = 0, kk = 0;
  var umur = { "0–14 tahun": 0, "15–24 tahun": 0, "25–44 tahun": 0, "45–59 tahun": 0, "60 tahun ke atas": 0 };
  var pekerjaan = {}, pendidikan = {}, wilayah = {};

  for (var i = 1; i < rows.length; i++) {
    if (!String(rows[i][0]).trim()) continue;
    var jk = String(rows[i][2]).trim().toUpperCase().charAt(0);
    if (jk === "L") laki++; else perempuan++;
    var adalahKK = String(rows[i][6]).trim() !== "";
    if (adalahKK) kk++;

    var tahun = parseInt(rows[i][3], 10);
    if (!isNaN(tahun) && tahun > 1900) umur[kelompokUmur_(tahunKini - tahun)]++;

    var kerja = String(rows[i][4]).trim() || "Lainnya";
    pekerjaan[kerja] = (pekerjaan[kerja] || 0) + 1;
    var didik = String(rows[i][5]).trim() || "Lainnya";
    pendidikan[didik] = (pendidikan[didik] || 0) + 1;

    var rw = String(rows[i][1]).trim();
    if (rw) {
      if (!wilayah[rw]) wilayah[rw] = { kk: 0, jiwa: 0 };
      wilayah[rw].jiwa++;
      if (adalahKK) wilayah[rw].kk++;
    }
  }

  var umurList = [];
  for (var u in umur) umurList.push([u, umur[u]]);
  var wilayahList = [];
  for (var w in wilayah) wilayahList.push([w, wilayah[w].kk, wilayah[w].jiwa]);
  wilayahList.sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });

  var hasil = {
    tahun: tahunKini,
    penduduk: { laki: laki, perempuan: perempuan, kk: kk },
    umur: umurList,
    pekerjaan: kelompokkan_(pekerjaan),
    pendidikan: kelompokkan_(pendidikan),
    wilayah: wilayahList
  };
  cache.put("stat_agregat", JSON.stringify(hasil), 600);
  return hasil;
}

/* ---------- Login & token (pola sama dengan skrip RSVP) ---------- */

function login_(user, pass) {
  user = String(user || "").trim().toLowerCase().slice(0, 40);
  pass = String(pass || "").slice(0, 80);
  if (!user || !pass) return { ok: false, pesan: "Isi username dan password." };

  // rem brute force: 5x gagal = kunci 10 menit per username
  var cache = CacheService.getScriptCache();
  var gagal = parseInt(cache.get("gagal_" + user), 10) || 0;
  if (gagal >= 5) return { ok: false, pesan: "Terlalu banyak percobaan. Coba lagi 10 menit." };

  var rows = lembarUser_().getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toLowerCase() === user &&
        String(rows[i][1]) === pass && pass !== "") {
      var token = Utilities.getUuid();
      // PropertiesService: tahan lama (CacheService bisa terhapus sewaktu-waktu)
      bersihkanTokenKadaluarsa_();
      PropertiesService.getScriptProperties().setProperty("tok_" + token,
        JSON.stringify({
          user: user,
          nama: String(rows[i][2] || user),
          exp: Date.now() + TOKEN_HARI * 86400000
        }));
      cache.remove("gagal_" + user);
      return { ok: true, token: token, nama: String(rows[i][2] || user), user: user };
    }
  }
  cache.put("gagal_" + user, String(gagal + 1), 600);
  return { ok: false, pesan: "Username atau password salah." };
}

function adminDariToken_(token) {
  if (!token) return null;
  var kunci = "tok_" + String(token).slice(0, 64);
  var props = PropertiesService.getScriptProperties();
  var isi = props.getProperty(kunci);
  if (!isi) return null;
  try {
    var data = JSON.parse(isi);
    if (!data.exp || data.exp < Date.now()) {
      props.deleteProperty(kunci);
      return null;
    }
    return data;
  } catch (err) { return null; }
}

function bersihkanTokenKadaluarsa_() {
  var props = PropertiesService.getScriptProperties();
  var semua = props.getProperties();
  for (var k in semua) {
    if (k.indexOf("tok_") !== 0) continue;
    try {
      var d = JSON.parse(semua[k]);
      if (!d.exp || d.exp < Date.now()) props.deleteProperty(k);
    } catch (err) { props.deleteProperty(k); }
  }
}

/* ---------- Endpoint ---------- */

/**
 * GET: cek hidup saja — isi aspirasi TIDAK pernah keluar tanpa login.
 * GET ?daftar=statistik: agregat kependudukan (publik — hanya angka,
 *   tidak pernah data per orang).
 * GET ?daftar=pengumuman: daftar pengumuman (publik, maks. 50 terbaru).
 * GET ?daftar=aspirasi&token=…: daftar aspirasi (hanya admin login,
 *   maks. 500 terbaru).
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.daftar === "statistik") {
    return json_({ ok: true, data: hitungStatistik_() });
  }
  if (e && e.parameter && e.parameter.daftar === "pengumuman") {
    var rowsP = lembarPengumuman_().getDataRange().getValues();
    var peng = [];
    for (var j = rowsP.length - 1; j >= 1 && peng.length < 50; j--) {
      if (!rowsP[j][2]) continue;
      peng.push({
        id: String(rowsP[j][0]),
        waktu: rowsP[j][1] ? new Date(rowsP[j][1]).toISOString() : "",
        judul: String(rowsP[j][2]),
        kategori: String(rowsP[j][3] || "kegiatan"),
        isi: String(rowsP[j][4] || ""),
        tgl: String(rowsP[j][5] || ""),
        jam: String(rowsP[j][6] || ""),
        tempat: String(rowsP[j][7] || "")
      });
    }
    return json_({ ok: true, data: peng });
  }
  if (e && e.parameter && e.parameter.daftar === "aspirasi") {
    var admin = adminDariToken_(e.parameter.token);
    if (!admin) return json_({ ok: false, butuhLogin: true });
    var rows = lembar_().getDataRange().getValues();
    var data = [];
    for (var i = rows.length - 1; i >= 1 && data.length < 500; i--) {
      if (!rows[i][3]) continue;
      data.push({
        waktu: rows[i][0] ? new Date(rows[i][0]).toISOString() : "",
        nama: String(rows[i][1] || ""),
        kontak: String(rows[i][2] || ""),
        pesan: String(rows[i][3] || "")
      });
    }
    return json_({ ok: true, nama: admin.nama, data: data });
  }
  return json_({ ok: true });
}

/**
 * POST {aksi:"login", user, pass}: masuk, balasannya {ok, token, nama}.
 * POST {aksi:"pengumuman", token, judul, kategori, isi, ket}: tambah
 *   pengumuman (wajib login).
 * POST {aksi:"pengumuman-hapus", token, id}: hapus pengumuman (wajib login).
 * POST {nama, kontak, pesan}: simpan aspirasi warga (publik).
 * Rem sederhana: maks. 1 kiriman per 30 detik untuk seluruh situs
 * (cukup untuk korong kecil, menahan spam beruntun dari skrip).
 */
function doPost(e) {
  var ok = false;
  try {
    var p = JSON.parse(e.postData.contents || "{}");

    if (p.aksi === "login") {
      return json_(login_(p.user, p.pass));
    }

    if (p.aksi === "pengumuman") {
      if (!adminDariToken_(p.token)) return json_({ ok: false, butuhLogin: true });
      var judul = String(p.judul || "").trim().slice(0, 120);
      var kategori = KATEGORI_SAH.indexOf(p.kategori) >= 0 ? p.kategori : "kegiatan";
      var isi = String(p.isi || "").trim().slice(0, 1000);
      // tgl "YYYY-MM-DD", jam "HH:MM" — disimpan sebagai teks apa adanya
      var tgl = /^\d{4}-\d{2}-\d{2}$/.test(p.tgl) ? p.tgl : "";
      var jam = /^\d{2}:\d{2}$/.test(p.jam) ? p.jam : "";
      var tempat = String(p.tempat || "").trim().slice(0, 100);
      if (!judul || !isi) return json_({ ok: false, pesan: "Judul dan isi wajib diisi." });
      var lockP = LockService.getScriptLock();
      lockP.waitLock(5000);
      try {
        lembarPengumuman_().appendRow([Utilities.getUuid(), new Date(),
          teks_(judul), kategori, teks_(isi), "'" + tgl, "'" + jam, teks_(tempat)]);
      } finally {
        lockP.releaseLock();
      }
      return json_({ ok: true });
    }

    if (p.aksi === "pengumuman-hapus") {
      if (!adminDariToken_(p.token)) return json_({ ok: false, butuhLogin: true });
      var id = String(p.id || "");
      if (id) {
        var sh = lembarPengumuman_();
        var rows = sh.getDataRange().getValues();
        for (var i = rows.length - 1; i >= 1; i--) {
          if (String(rows[i][0]) === id) {
            sh.deleteRow(i + 1);
            ok = true;
            break;
          }
        }
      }
      return json_({ ok: ok });
    }

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
