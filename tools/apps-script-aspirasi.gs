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
var SHEET_STRUKTUR = "STRUKTUR";
var SHEET_GALERI = "GALERI";
var TOKEN_HARI = 7; // token login berlaku 7 hari
var KATEGORI_SAH = ["penting", "kegiatan", "layanan"];
var SHEET_SURAT = "SURAT";
var STATUS_SAH = ["baru", "diproses", "selesai"];
var JENIS_SURAT_SAH = ["pengantar", "domisili", "usaha", "tidak-mampu", "lainnya"];
var SHEET_KONFIG = "KONFIG";
var KUNCI_KONFIG_SAH = ["cloudinary_cloud", "cloudinary_preset", "drive_folder", "pamsimas_publik"];
var SHEET_PAM_PELANGGAN = "PAMSIMAS_PELANGGAN";
var SHEET_PAM_KAS = "PAMSIMAS_KAS";
/**
 * Hak akses ala ir.model.access Odoo: sheet AKSES berisi satu baris per
 * (Username, Model) dengan flag Read/Write/Create/Unlink ("Y" = boleh).
 * Peran "pemilik" (Super User) melewati semua pemeriksaan.
 * Tanpa baris = tanpa akses (semantik Odoo).
 */
var SHEET_AKSES = "AKSES";
var MODEL_SAH = ["pamsimas"];

function lembarAkses_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_AKSES) || ss.insertSheet(SHEET_AKSES);
  if (sh.getLastRow() === 0) {
    sh.appendRow(["ID", "Username", "Model", "Read", "Write", "Create", "Unlink"].concat(KOLOM_JEJAK));
  }
  return sh;
}

/** Peta akses semua user: {username: {model: {r,w,c,u}}} */
function petaAkses_() {
  var rows = lembarAkses_().getDataRange().getValues();
  var peta = {};
  for (var i = 1; i < rows.length; i++) {
    var u = String(rows[i][1] || "").trim().toLowerCase();
    var m = String(rows[i][2] || "").trim().toLowerCase();
    if (!u || MODEL_SAH.indexOf(m) < 0) continue;
    if (!peta[u]) peta[u] = {};
    peta[u][m] = {
      r: String(rows[i][3]).trim() !== "",
      w: String(rows[i][4]).trim() !== "",
      c: String(rows[i][5]).trim() !== "",
      u: String(rows[i][6]).trim() !== ""
    };
  }
  return peta;
}

function bacaAksesUser_(user) {
  return petaAkses_()[String(user || "").toLowerCase()] || {};
}

/** Upsert baris AKSES seorang user untuk semua model yang dikirim portal. */
function simpanAksesUser_(user, akses, aktor) {
  var sh = lembarAkses_();
  var rows = sh.getDataRange().getValues();
  MODEL_SAH.forEach(function (model) {
    var a = (akses && akses[model]) || {};
    var vals = [a.r ? "Y" : "", a.w ? "Y" : "", a.c ? "Y" : "", a.u ? "Y" : ""];
    var r = 0;
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][1]).trim().toLowerCase() === user && String(rows[i][2]) === model) {
        r = i + 1;
        break;
      }
    }
    if (r) {
      sh.getRange(r, 4, 1, 4).setValues([vals]);
      tulisJejak_(sh, r, 10, aktor);
    } else {
      sh.appendRow([Utilities.getUuid(), user, model].concat(vals).concat(jejak_(aktor)));
    }
  });
}

/** Ringkas akses jadi string untuk perbandingan (deteksi perubahan). */
function ringkasAkses_(a) {
  return MODEL_SAH.map(function (m) {
    var x = (a && a[m]) || {};
    return (x.r ? "r" : "") + (x.w ? "w" : "") + (x.c ? "c" : "") + (x.u ? "u" : "");
  }).join("|");
}

function punyaAkses_(akun, model, op) {
  if (!akun) return false;
  if (akun.peran === "pemilik") return true;
  var a = akun.akses && akun.akses[model];
  return !!(a && a[op]);
}

function lembar_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    // Status di ujung (setelah jejak) agar posisi kolom lama tidak bergeser
    sh.appendRow(["Waktu", "Nama", "Kontak", "Pesan"].concat(KOLOM_JEJAK).concat(["Status"]));
  }
  return sh;
}

/** Konfigurasi sistem (kunci-nilai), diedit pemilik lewat portal. */
function lembarKonfig_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_KONFIG) || ss.insertSheet(SHEET_KONFIG);
  if (sh.getLastRow() === 0) {
    sh.appendRow(["Kunci", "Nilai"].concat(KOLOM_JEJAK));
  }
  return sh;
}

function bacaKonfig_() {
  var rows = lembarKonfig_().getDataRange().getValues();
  var k = {};
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0]) k[String(rows[i][0])] = String(rows[i][1] || "");
  }
  return k;
}

/* ---------- Pamsimas: iuran air & buku kas KPSPAMS ---------- */

function lembarPamPelanggan_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_PAM_PELANGGAN) || ss.insertSheet(SHEET_PAM_PELANGGAN);
  if (sh.getLastRow() === 0) {
    sh.appendRow(["ID", "Nama", "RW", "Aktif"].concat(KOLOM_JEJAK));
  }
  return sh;
}

/** Buku kas tunggal: jenis "masuk" (iuran) dan "keluar" (pengeluaran). */
function lembarPamKas_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_PAM_KAS) || ss.insertSheet(SHEET_PAM_KAS);
  if (sh.getLastRow() === 0) {
    sh.appendRow(["ID", "Waktu", "Jenis", "Pelanggan ID", "Bulan", "Uraian", "Jumlah"].concat(KOLOM_JEJAK));
  }
  return sh;
}

/**
 * Agregat kas Pamsimas untuk website (transparansi) — TIDAK pernah memuat
 * nama pelanggan atau status bayar per orang. Hanya keluar bila pemilik
 * mengaktifkan kunci konfigurasi pamsimas_publik = "ya". Cache 10 menit.
 */
function hitungPamPublik_() {
  var cache = CacheService.getScriptCache();
  var simpanan = cache.get("pam_publik");
  if (simpanan) return JSON.parse(simpanan);

  var hasil = { aktif: bacaKonfig_().pamsimas_publik === "ya" };
  if (hasil.aktif) {
    var rowsPel = lembarPamPelanggan_().getDataRange().getValues();
    var pelangganAktif = 0;
    for (var a = 1; a < rowsPel.length; a++) {
      if (rowsPel[a][1] && String(rowsPel[a][3] || "").trim() !== "") pelangganAktif++;
    }
    var rowsKas = lembarPamKas_().getDataRange().getValues();
    var saldo = 0;
    var perBulan = {};
    var pengeluaran = [];
    for (var i = rowsKas.length - 1; i >= 1; i--) {
      if (!rowsKas[i][0]) continue;
      var jenis = String(rowsKas[i][2]);
      var jumlah = Number(rowsKas[i][6]) || 0;
      saldo += jenis === "keluar" ? -jumlah : jumlah;
      var bln = "";
      if (jenis === "masuk") {
        bln = String(rowsKas[i][4] || "");
      } else if (jenis === "keluar" && rowsKas[i][1]) {
        var w = new Date(rowsKas[i][1]);
        bln = w.getFullYear() + "-" + ("0" + (w.getMonth() + 1)).slice(-2);
        if (pengeluaran.length < 8) {
          pengeluaran.push({
            waktu: w.toISOString(),
            uraian: String(rowsKas[i][5] || ""),
            jumlah: jumlah
          });
        }
      }
      if (/^\d{4}-\d{2}$/.test(bln)) {
        if (!perBulan[bln]) perBulan[bln] = { masuk: 0, pembayar: 0, keluar: 0 };
        if (jenis === "masuk") { perBulan[bln].masuk += jumlah; perBulan[bln].pembayar++; }
        else perBulan[bln].keluar += jumlah;
      }
    }
    var kunci = [];
    for (var b in perBulan) kunci.push(b);
    kunci.sort().reverse();
    var bulanan = [];
    for (var k = 0; k < kunci.length && k < 6; k++) {
      bulanan.push({ bulan: kunci[k], masuk: perBulan[kunci[k]].masuk,
        pembayar: perBulan[kunci[k]].pembayar, keluar: perBulan[kunci[k]].keluar });
    }
    hasil.saldo = saldo;
    hasil.pelangganAktif = pelangganAktif;
    hasil.bulanan = bulanan;
    hasil.pengeluaran = pengeluaran;
  }
  cache.put("pam_publik", JSON.stringify(hasil), 600);
  return hasil;
}

function jumlahSah_(v) {
  var n = Math.round(Number(v));
  return isFinite(n) && n > 0 && n <= 100000000 ? n : 0;
}

/** Permohonan surat pengantar/keterangan dari warga. */
function lembarSurat_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_SURAT) || ss.insertSheet(SHEET_SURAT);
  if (sh.getLastRow() === 0) {
    sh.appendRow(["ID", "Waktu", "Nama", "Kontak", "Jenis", "Keperluan", "Status"].concat(KOLOM_JEJAK));
  }
  return sh;
}

/**
 * Kolom Peran: "pemilik" boleh mengelola pengguna lewat portal;
 * selain itu (atau kosong) = "admin" biasa. Isi "pemilik" MANUAL di
 * spreadsheet untuk akun Anda sendiri — itulah akar hak aksesnya.
 */
function lembarUser_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_USER) || ss.insertSheet(SHEET_USER);
  if (sh.getLastRow() === 0) {
    sh.appendRow(["Username", "Password", "Nama", "Peran", "Foto"].concat(KOLOM_JEJAK).concat(["ID"]));
  }
  return sh;
}

/** URL foto hanya diterima dari Cloudinary. */
function urlFotoSah_(u) {
  u = String(u || "").trim().slice(0, 500);
  return /^https:\/\/res\.cloudinary\.com\//.test(u) ? u : "";
}

function lembarPengumuman_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_PENGUMUMAN) || ss.insertSheet(SHEET_PENGUMUMAN);
  if (sh.getLastRow() === 0) {
    sh.appendRow(["ID", "Waktu Terbit", "Judul", "Kategori", "Isi", "Tanggal Acara", "Jam", "Tempat"].concat(KOLOM_JEJAK));
  }
  return sh;
}

/** Foto disimpan di Cloudinary; sheet ini hanya mencatat URL + keterangan. */
function lembarGaleri_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_GALERI) || ss.insertSheet(SHEET_GALERI);
  if (sh.getLastRow() === 0) {
    sh.appendRow(["ID", "Waktu", "URL", "Judul", "Album"].concat(KOLOM_JEJAK));
  }
  return sh;
}

function lembarStruktur_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_STRUKTUR) || ss.insertSheet(SHEET_STRUKTUR);
  if (sh.getLastRow() === 0) {
    sh.appendRow(["ID", "Nama", "Jabatan", "ID Atasan", "Foto"].concat(KOLOM_JEJAK));
  }
  return sh;
}

var KOLOM_JEJAK = ["create_uid", "create_date", "write_uid", "write_date"];

/**
 * Jejak audit ala Odoo, ditaruh di ujung tiap baris data:
 * create uid/date = siapa & kapan dibuat; write uid/date = terakhir diubah.
 * Aksi tanpa login (form publik) dicatat sebagai "publik".
 */
function jejak_(user) {
  var kini = new Date();
  var u = String(user || "publik");
  return [u, kini, u, kini];
}

/** Perbarui Write UID + Write Date pada satu baris (kolomWrite = kolom Write UID). */
function tulisJejak_(sh, baris, kolomWrite, user) {
  sh.getRange(baris, kolomWrite, 1, 2).setValues([[String(user || "publik"), new Date()]]);
}

/** Cari nomor baris (1-based) berdasarkan ID di kolom pertama; 0 = tidak ketemu. */
function barisDariId_(rows, id) {
  for (var i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0]) === String(id)) return i + 1;
  }
  return 0;
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
      var peran = String(rows[i][3] || "").trim().toLowerCase() === "pemilik" ? "pemilik" : "admin";
      var akses = bacaAksesUser_(user);
      // PropertiesService: tahan lama (CacheService bisa terhapus sewaktu-waktu)
      bersihkanTokenKadaluarsa_();
      PropertiesService.getScriptProperties().setProperty("tok_" + token,
        JSON.stringify({
          user: user,
          nama: String(rows[i][2] || user),
          peran: peran,
          akses: akses,
          exp: Date.now() + TOKEN_HARI * 86400000
        }));
      cache.remove("gagal_" + user);
      return { ok: true, token: token, nama: String(rows[i][2] || user), user: user,
        peran: peran, akses: akses, foto: String(rows[i][4] || "") };
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

/** Token sah DAN berperan pemilik — gerbang semua aksi kelola pengguna. */
function adminPemilik_(token) {
  var a = adminDariToken_(token);
  return a && a.peran === "pemilik" ? a : null;
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
 * GET ?daftar=struktur: struktur pemerintahan korong (publik).
 * GET ?daftar=galeri: foto galeri (publik, maks. 100 terbaru).
 * GET ?daftar=aspirasi&token=…: daftar aspirasi (hanya admin login,
 *   maks. 500 terbaru).
 * GET ?daftar=user&token=…: daftar pengguna TANPA password (hanya pemilik).
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
  if (e && e.parameter && e.parameter.daftar === "galeri") {
    var rowsG = lembarGaleri_().getDataRange().getValues();
    var galeri = [];
    for (var g = rowsG.length - 1; g >= 1 && galeri.length < 100; g--) {
      if (!rowsG[g][2]) continue;
      galeri.push({
        id: String(rowsG[g][0]),
        waktu: rowsG[g][1] ? new Date(rowsG[g][1]).toISOString() : "",
        url: String(rowsG[g][2]),
        judul: String(rowsG[g][3] || ""),
        album: String(rowsG[g][4] || "")
      });
    }
    return json_({ ok: true, data: galeri });
  }
  if (e && e.parameter && e.parameter.daftar === "struktur") {
    var rowsS = lembarStruktur_().getDataRange().getValues();
    var struktur = [];
    for (var s = 1; s < rowsS.length && struktur.length < 100; s++) {
      if (!rowsS[s][1]) continue;
      struktur.push({
        id: String(rowsS[s][0]),
        nama: String(rowsS[s][1]),
        jabatan: String(rowsS[s][2] || ""),
        induk: String(rowsS[s][3] || ""),
        foto: String(rowsS[s][4] || "")
      });
    }
    return json_({ ok: true, data: struktur });
  }
  if (e && e.parameter && e.parameter.daftar === "pamsimas-publik") {
    var hp = hitungPamPublik_();
    hp.ok = true;
    return json_(hp);
  }
  if (e && e.parameter && e.parameter.daftar === "pamsimas") {
    var akunPm = adminDariToken_(e.parameter.token);
    if (!akunPm) return json_({ ok: false, butuhLogin: true });
    if (!punyaAkses_(akunPm, "pamsimas", "r")) {
      return json_({ ok: false, pesan: "Anda tidak punya akses baca Pamsimas." });
    }
    var rowsPl = lembarPamPelanggan_().getDataRange().getValues();
    var pelanggan = [];
    for (var pl = 1; pl < rowsPl.length; pl++) {
      if (!rowsPl[pl][1]) continue;
      pelanggan.push({
        id: String(rowsPl[pl][0]),
        nama: String(rowsPl[pl][1]),
        rw: String(rowsPl[pl][2] || ""),
        aktif: String(rowsPl[pl][3] || "").trim() !== ""
      });
    }
    var rowsKs = lembarPamKas_().getDataRange().getValues();
    var kas = [];
    for (var ks = rowsKs.length - 1; ks >= 1 && kas.length < 500; ks--) {
      if (!rowsKs[ks][0]) continue;
      kas.push({
        id: String(rowsKs[ks][0]),
        waktu: rowsKs[ks][1] ? new Date(rowsKs[ks][1]).toISOString() : "",
        jenis: String(rowsKs[ks][2]) === "keluar" ? "keluar"
          : String(rowsKs[ks][2]) === "saldo" ? "saldo" : "masuk",
        pelanggan: String(rowsKs[ks][3] || ""),
        bulan: String(rowsKs[ks][4] || ""),
        uraian: String(rowsKs[ks][5] || ""),
        jumlah: Number(rowsKs[ks][6]) || 0
      });
    }
    return json_({ ok: true, pelanggan: pelanggan, kas: kas });
  }
  if (e && e.parameter && e.parameter.daftar === "konfig") {
    if (!adminDariToken_(e.parameter.token)) return json_({ ok: false, butuhLogin: true });
    return json_({
      ok: true,
      konfig: bacaKonfig_(),
      spreadsheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl()
    });
  }
  if (e && e.parameter && e.parameter.daftar === "surat") {
    if (!adminDariToken_(e.parameter.token)) return json_({ ok: false, butuhLogin: true });
    var rowsSu = lembarSurat_().getDataRange().getValues();
    var surat = [];
    for (var su = rowsSu.length - 1; su >= 1 && surat.length < 200; su--) {
      if (!rowsSu[su][2]) continue;
      surat.push({
        id: String(rowsSu[su][0]),
        waktu: rowsSu[su][1] ? new Date(rowsSu[su][1]).toISOString() : "",
        nama: String(rowsSu[su][2]),
        kontak: String(rowsSu[su][3] || ""),
        jenis: String(rowsSu[su][4] || "lainnya"),
        keperluan: String(rowsSu[su][5] || ""),
        status: STATUS_SAH.indexOf(rowsSu[su][6]) >= 0 ? rowsSu[su][6] : "baru"
      });
    }
    return json_({ ok: true, data: surat });
  }
  if (e && e.parameter && e.parameter.daftar === "user") {
    if (!adminDariToken_(e.parameter.token)) return json_({ ok: false, butuhLogin: true });
    if (!adminPemilik_(e.parameter.token)) return json_({ ok: false, pesan: "Khusus pemilik." });
    var rowsU = lembarUser_().getDataRange().getValues();
    var semuaAkses = petaAkses_();
    var daftarU = [];
    for (var u = 1; u < rowsU.length; u++) {
      if (!rowsU[u][0]) continue;
      var unameU = String(rowsU[u][0]).trim().toLowerCase();
      var idU = String(rowsU[u][9] || "");
      daftarU.push({
        id: /^[0-9a-f-]{36}$/.test(idU) ? idU : "",
        user: unameU,
        nama: String(rowsU[u][2] || rowsU[u][0]),
        peran: String(rowsU[u][3] || "").trim().toLowerCase() === "pemilik" ? "pemilik" : "admin",
        foto: String(rowsU[u][4] || ""),
        akses: semuaAkses[unameU] || {}
      });
    }
    return json_({ ok: true, data: daftarU });
  }
  if (e && e.parameter && e.parameter.daftar === "aspirasi") {
    var admin = adminDariToken_(e.parameter.token);
    if (!admin) return json_({ ok: false, butuhLogin: true });
    var rows = lembar_().getDataRange().getValues();
    var data = [];
    for (var i = rows.length - 1; i >= 1 && data.length < 500; i--) {
      if (!rows[i][3]) continue;
      data.push({
        baris: i + 1,
        waktu: rows[i][0] ? new Date(rows[i][0]).toISOString() : "",
        nama: String(rows[i][1] || ""),
        kontak: String(rows[i][2] || ""),
        pesan: String(rows[i][3] || ""),
        status: STATUS_SAH.indexOf(rows[i][8]) >= 0 ? rows[i][8] : "baru"
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
 * POST {aksi:"struktur", token, nama, jabatan, induk}: tambah pengurus
 *   (wajib login; induk = ID atasan, kosong = puncak).
 * POST {aksi:"struktur-hapus", token, id}: hapus pengurus (wajib login;
 *   ditolak bila masih punya bawahan).
 * POST {aksi:"galeri", token, url, judul, album}: catat foto Cloudinary
 *   (wajib login; URL harus res.cloudinary.com).
 * POST {aksi:"galeri-hapus", token, id}: hapus catatan foto (wajib login;
 *   file di Cloudinary tidak ikut terhapus).
 * POST {aksi:"user-tambah", token, user, pass, nama, peran}: buat akun
 *   (hanya pemilik).
 * POST {aksi:"user-hapus", token, user}: hapus akun + semua tokennya
 *   (hanya pemilik; tidak bisa menghapus akun sendiri).
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
      var akunPg = adminDariToken_(p.token);
      if (!akunPg) return json_({ ok: false, butuhLogin: true });
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
          teks_(judul), kategori, teks_(isi), "'" + tgl, "'" + jam, teks_(tempat)]
          .concat(jejak_(akunPg.user)));
      } finally {
        lockP.releaseLock();
      }
      return json_({ ok: true });
    }

    // Warga mengajukan permohonan surat (publik)
    if (p.aksi === "surat") {
      var namaW = String(p.nama || "").trim().slice(0, 80);
      var kontakW = String(p.kontak || "").trim().slice(0, 80);
      var jenisW = JENIS_SURAT_SAH.indexOf(p.jenis) >= 0 ? p.jenis : "lainnya";
      var keperluanW = String(p.keperluan || "").trim().slice(0, 300);
      if (!namaW || !kontakW) {
        return json_({ ok: false, pesan: "Nama dan kontak (WhatsApp) wajib diisi." });
      }
      var cacheW = CacheService.getScriptCache();
      if (cacheW.get("rem_surat")) {
        return json_({ ok: false, pesan: "Terlalu cepat. Coba lagi sebentar lagi." });
      }
      cacheW.put("rem_surat", "1", 30);
      var lockW = LockService.getScriptLock();
      lockW.waitLock(5000);
      try {
        lembarSurat_().appendRow([Utilities.getUuid(), new Date(),
          teks_(namaW), teks_(kontakW), jenisW, teks_(keperluanW), "baru"]
          .concat(jejak_("publik")));
      } finally {
        lockW.releaseLock();
      }
      return json_({ ok: true });
    }

    if (p.aksi === "surat-status") {
      var akunSs = adminDariToken_(p.token);
      if (!akunSs) return json_({ ok: false, butuhLogin: true });
      var statusSs = STATUS_SAH.indexOf(p.status) >= 0 ? p.status : "baru";
      var shSu = lembarSurat_();
      var rSu = barisDariId_(shSu.getDataRange().getValues(), p.id);
      if (!rSu) return json_({ ok: false, pesan: "Permohonan tidak ditemukan." });
      shSu.getRange(rSu, 7).setValue(statusSs);
      tulisJejak_(shSu, rSu, 10, akunSs.user);
      return json_({ ok: true });
    }

    if (p.aksi === "surat-hapus") {
      if (!adminDariToken_(p.token)) return json_({ ok: false, butuhLogin: true });
      var shSh = lembarSurat_();
      var rSh = barisDariId_(shSh.getDataRange().getValues(), p.id);
      if (rSh) { shSh.deleteRow(rSh); ok = true; }
      return json_({ ok: ok });
    }

    if (p.aksi === "aspirasi-status") {
      var akunAs = adminDariToken_(p.token);
      if (!akunAs) return json_({ ok: false, butuhLogin: true });
      var barisSt = parseInt(p.baris, 10) || 0;
      var statusSt = STATUS_SAH.indexOf(p.status) >= 0 ? p.status : "baru";
      var shSt = lembar_();
      var rowsSt = shSt.getDataRange().getValues();
      if (barisSt >= 2 && barisSt <= rowsSt.length &&
          String(rowsSt[barisSt - 1][3]) === String(p.pesan || "")) {
        shSt.getRange(barisSt, 9).setValue(statusSt);
        tulisJejak_(shSt, barisSt, 7, akunAs.user);
        return json_({ ok: true });
      }
      return json_({ ok: false, pesan: "Data sudah berubah. Muat ulang lalu coba lagi." });
    }

    if (p.aksi === "aspirasi-hapus") {
      if (!adminDariToken_(p.token)) return json_({ ok: false, butuhLogin: true });
      var barisA = parseInt(p.baris, 10) || 0;
      var shA = lembar_();
      var rowsA = shA.getDataRange().getValues();
      // cocokkan isi pesan dulu — kalau baris bergeser, tolak daripada salah hapus
      if (barisA >= 2 && barisA <= rowsA.length &&
          String(rowsA[barisA - 1][3]) === String(p.pesan || "")) {
        shA.deleteRow(barisA);
        ok = true;
      } else {
        return json_({ ok: false, pesan: "Data sudah berubah. Muat ulang lalu coba lagi." });
      }
      return json_({ ok: ok });
    }

    if (p.aksi === "pengumuman-edit") {
      var akunPe = adminDariToken_(p.token);
      if (!akunPe) return json_({ ok: false, butuhLogin: true });
      var judulE = String(p.judul || "").trim().slice(0, 120);
      var kategoriE = KATEGORI_SAH.indexOf(p.kategori) >= 0 ? p.kategori : "kegiatan";
      var isiE = String(p.isi || "").trim().slice(0, 1000);
      var tglE = /^\d{4}-\d{2}-\d{2}$/.test(p.tgl) ? p.tgl : "";
      var jamE = /^\d{2}:\d{2}$/.test(p.jam) ? p.jam : "";
      var tempatE = String(p.tempat || "").trim().slice(0, 100);
      if (!judulE || !isiE) return json_({ ok: false, pesan: "Judul dan isi wajib diisi." });
      var shPe = lembarPengumuman_();
      var rPe = barisDariId_(shPe.getDataRange().getValues(), p.id);
      if (!rPe) return json_({ ok: false, pesan: "Pengumuman tidak ditemukan." });
      shPe.getRange(rPe, 3, 1, 6).setValues([[teks_(judulE), kategoriE, teks_(isiE),
        "'" + tglE, "'" + jamE, teks_(tempatE)]]);
      tulisJejak_(shPe, rPe, 11, akunPe.user);
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

    if (p.aksi === "struktur") {
      var akunSt = adminDariToken_(p.token);
      if (!akunSt) return json_({ ok: false, butuhLogin: true });
      var namaS = String(p.nama || "").trim().slice(0, 80);
      var jabatan = String(p.jabatan || "").trim().slice(0, 80);
      var induk = String(p.induk || "").trim().slice(0, 64);
      if (!namaS || !jabatan) return json_({ ok: false, pesan: "Nama dan jabatan wajib diisi." });
      var fotoS = urlFotoSah_(p.foto);
      var shS = lembarStruktur_();
      var rowsS = shS.getDataRange().getValues();
      // induk harus ID yang ada (atau kosong = puncak)
      if (induk) {
        var ada = false;
        for (var a = 1; a < rowsS.length; a++) {
          if (String(rowsS[a][0]) === induk) { ada = true; break; }
        }
        if (!ada) induk = "";
      }
      if (rowsS.length > 100) return json_({ ok: false, pesan: "Struktur sudah terlalu besar." });
      var lockS = LockService.getScriptLock();
      lockS.waitLock(5000);
      try {
        shS.appendRow([Utilities.getUuid(), teks_(namaS), teks_(jabatan), induk, fotoS]
          .concat(jejak_(akunSt.user)));
      } finally {
        lockS.releaseLock();
      }
      return json_({ ok: true });
    }

    if (p.aksi === "struktur-edit") {
      var akunSe = adminDariToken_(p.token);
      if (!akunSe) return json_({ ok: false, butuhLogin: true });
      var idE = String(p.id || "");
      var namaE2 = String(p.nama || "").trim().slice(0, 80);
      var jabatanE = String(p.jabatan || "").trim().slice(0, 80);
      var indukE = String(p.induk || "").trim().slice(0, 64);
      if (!namaE2 || !jabatanE) return json_({ ok: false, pesan: "Nama dan jabatan wajib diisi." });
      var shSe = lembarStruktur_();
      var rowsSe = shSe.getDataRange().getValues();
      var rSe = barisDariId_(rowsSe, idE);
      if (!rSe) return json_({ ok: false, pesan: "Pengurus tidak ditemukan." });
      if (indukE === idE) indukE = "";
      if (indukE) {
        // peta id -> induk untuk cek siklus (atasan baru tak boleh bawahannya sendiri)
        var petaInduk = {};
        var adaE = false;
        for (var ie = 1; ie < rowsSe.length; ie++) {
          petaInduk[String(rowsSe[ie][0])] = String(rowsSe[ie][3] || "");
          if (String(rowsSe[ie][0]) === indukE) adaE = true;
        }
        if (!adaE) indukE = "";
        var jalan = indukE, langkah = 0;
        while (jalan && langkah++ < 100) {
          if (jalan === idE) {
            return json_({ ok: false, pesan: "Atasan tidak boleh diambil dari bawahannya sendiri." });
          }
          jalan = petaInduk[jalan] || "";
        }
      }
      var fotoE = urlFotoSah_(p.foto);
      shSe.getRange(rSe, 2, 1, 4).setValues([[teks_(namaE2), teks_(jabatanE), indukE, fotoE]]);
      tulisJejak_(shSe, rSe, 8, akunSe.user);
      return json_({ ok: true });
    }

    if (p.aksi === "struktur-hapus") {
      if (!adminDariToken_(p.token)) return json_({ ok: false, butuhLogin: true });
      var idS = String(p.id || "");
      if (idS) {
        var shH = lembarStruktur_();
        var rowsH = shH.getDataRange().getValues();
        for (var b = 1; b < rowsH.length; b++) {
          if (String(rowsH[b][3]) === idS && rowsH[b][1]) {
            return json_({ ok: false, pesan: "Masih punya bawahan. Hapus atau pindahkan bawahannya dulu." });
          }
        }
        for (var c = rowsH.length - 1; c >= 1; c--) {
          if (String(rowsH[c][0]) === idS) {
            shH.deleteRow(c + 1);
            ok = true;
            break;
          }
        }
      }
      return json_({ ok: ok });
    }

    if (p.aksi === "galeri") {
      var akunGl = adminDariToken_(p.token);
      if (!akunGl) return json_({ ok: false, butuhLogin: true });
      var urlFoto = String(p.url || "").trim().slice(0, 500);
      if (!/^https:\/\/res\.cloudinary\.com\//.test(urlFoto)) {
        return json_({ ok: false, pesan: "URL foto tidak dikenal (harus Cloudinary)." });
      }
      var judulF = String(p.judul || "").trim().slice(0, 120);
      var albumF = String(p.album || "").trim().slice(0, 60);
      var lockG = LockService.getScriptLock();
      lockG.waitLock(5000);
      try {
        lembarGaleri_().appendRow([Utilities.getUuid(), new Date(),
          urlFoto, teks_(judulF), teks_(albumF)].concat(jejak_(akunGl.user)));
      } finally {
        lockG.releaseLock();
      }
      return json_({ ok: true });
    }

    if (p.aksi === "galeri-edit") {
      var akunGe = adminDariToken_(p.token);
      if (!akunGe) return json_({ ok: false, butuhLogin: true });
      var shGe = lembarGaleri_();
      var rGe = barisDariId_(shGe.getDataRange().getValues(), p.id);
      if (!rGe) return json_({ ok: false, pesan: "Foto tidak ditemukan." });
      shGe.getRange(rGe, 4, 1, 2).setValues([[
        teks_(String(p.judul || "").trim().slice(0, 120)),
        teks_(String(p.album || "").trim().slice(0, 60))]]);
      tulisJejak_(shGe, rGe, 8, akunGe.user);
      return json_({ ok: true });
    }

    if (p.aksi === "galeri-hapus") {
      if (!adminDariToken_(p.token)) return json_({ ok: false, butuhLogin: true });
      var idG = String(p.id || "");
      if (idG) {
        var shG = lembarGaleri_();
        var rowsGh = shG.getDataRange().getValues();
        for (var gh = rowsGh.length - 1; gh >= 1; gh--) {
          if (String(rowsGh[gh][0]) === idG) {
            shG.deleteRow(gh + 1);
            ok = true;
            break;
          }
        }
      }
      return json_({ ok: ok });
    }

    // Tiap admin boleh mengganti foto profil AKUNNYA SENDIRI
    if (p.aksi === "profil-foto") {
      var akun = adminDariToken_(p.token);
      if (!akun) return json_({ ok: false, butuhLogin: true });
      var fotoP = urlFotoSah_(p.url);
      if (!fotoP) return json_({ ok: false, pesan: "URL foto tidak dikenal (harus Cloudinary)." });
      var shP = lembarUser_();
      var rowsP2 = shP.getDataRange().getValues();
      for (var fp = 1; fp < rowsP2.length; fp++) {
        if (String(rowsP2[fp][0]).trim().toLowerCase() === akun.user) {
          shP.getRange(fp + 1, 5).setValue(fotoP);
          // perbarui jejak write uid/date (kolom 8-9)
          shP.getRange(fp + 1, 8, 1, 2).setValues([[akun.user, new Date()]]);
          ok = true;
          break;
        }
      }
      return json_({ ok: ok });
    }

    /* ---------- Pamsimas (wajib login) ---------- */

    if (p.aksi === "pam-pelanggan") {
      var akunPl = adminDariToken_(p.token);
      if (!akunPl) return json_({ ok: false, butuhLogin: true });
      if (!punyaAkses_(akunPl, "pamsimas", "c")) return json_({ ok: false, pesan: "Anda tidak punya akses tambah (create) Pamsimas." });
      var namaPl = String(p.nama || "").trim().slice(0, 80);
      var rwPl = String(p.rw || "").trim().slice(0, 20);
      if (!namaPl) return json_({ ok: false, pesan: "Nama pelanggan wajib diisi." });
      var lockPl = LockService.getScriptLock();
      lockPl.waitLock(5000);
      try {
        lembarPamPelanggan_().appendRow([Utilities.getUuid(), teks_(namaPl), teks_(rwPl), "Y"]
          .concat(jejak_(akunPl.user)));
      } finally {
        lockPl.releaseLock();
      }
      return json_({ ok: true });
    }

    if (p.aksi === "pam-pelanggan-edit") {
      var akunPle = adminDariToken_(p.token);
      if (!akunPle) return json_({ ok: false, butuhLogin: true });
      if (!punyaAkses_(akunPle, "pamsimas", "w")) return json_({ ok: false, pesan: "Anda tidak punya akses ubah (write) Pamsimas." });
      var shPle = lembarPamPelanggan_();
      var rPle = barisDariId_(shPle.getDataRange().getValues(), p.id);
      if (!rPle) return json_({ ok: false, pesan: "Pelanggan tidak ditemukan." });
      var namaPle = String(p.nama || "").trim().slice(0, 80);
      if (!namaPle) return json_({ ok: false, pesan: "Nama pelanggan wajib diisi." });
      shPle.getRange(rPle, 2, 1, 3).setValues([[teks_(namaPle),
        teks_(String(p.rw || "").trim().slice(0, 20)), p.aktif ? "Y" : ""]]);
      tulisJejak_(shPle, rPle, 7, akunPle.user);
      return json_({ ok: true });
    }

    if (p.aksi === "pam-pelanggan-hapus") {
      var akunPlh = adminDariToken_(p.token);
      if (!akunPlh) return json_({ ok: false, butuhLogin: true });
      if (!punyaAkses_(akunPlh, "pamsimas", "u")) return json_({ ok: false, pesan: "Anda tidak punya akses hapus (unlink) Pamsimas." });
      var idPlh = String(p.id || "");
      var rowsKasH = lembarPamKas_().getDataRange().getValues();
      for (var kh = 1; kh < rowsKasH.length; kh++) {
        if (String(rowsKasH[kh][3]) === idPlh) {
          return json_({ ok: false, pesan: "Sudah punya catatan iuran — nonaktifkan saja, jangan dihapus." });
        }
      }
      var shPlh = lembarPamPelanggan_();
      var rPlh = barisDariId_(shPlh.getDataRange().getValues(), idPlh);
      if (rPlh) { shPlh.deleteRow(rPlh); ok = true; }
      return json_({ ok: ok });
    }

    if (p.aksi === "pam-iuran") {
      var akunIu = adminDariToken_(p.token);
      if (!akunIu) return json_({ ok: false, butuhLogin: true });
      if (!punyaAkses_(akunIu, "pamsimas", "c")) return json_({ ok: false, pesan: "Anda tidak punya akses tambah (create) Pamsimas." });
      var idIu = String(p.pelanggan || "");
      var bulanIu = /^\d{4}-\d{2}$/.test(p.bulan) ? p.bulan : "";
      var jumlahIu = jumlahSah_(p.jumlah);
      if (!idIu || !bulanIu || !jumlahIu) {
        return json_({ ok: false, pesan: "Pelanggan, bulan, dan jumlah wajib diisi dengan benar." });
      }
      var rowsIu = lembarPamKas_().getDataRange().getValues();
      for (var iu = 1; iu < rowsIu.length; iu++) {
        if (String(rowsIu[iu][2]) === "masuk" && String(rowsIu[iu][3]) === idIu &&
            String(rowsIu[iu][4]) === bulanIu) {
          return json_({ ok: false, pesan: "Iuran bulan itu sudah tercatat untuk pelanggan ini." });
        }
      }
      var lockIu = LockService.getScriptLock();
      lockIu.waitLock(5000);
      try {
        lembarPamKas_().appendRow([Utilities.getUuid(), new Date(), "masuk",
          idIu, "'" + bulanIu, teks_(String(p.keterangan || "").trim().slice(0, 200)),
          jumlahIu].concat(jejak_(akunIu.user)));
      } finally {
        lockIu.releaseLock();
      }
      return json_({ ok: true });
    }

    if (p.aksi === "pam-keluar") {
      var akunKe = adminDariToken_(p.token);
      if (!akunKe) return json_({ ok: false, butuhLogin: true });
      if (!punyaAkses_(akunKe, "pamsimas", "c")) return json_({ ok: false, pesan: "Anda tidak punya akses tambah (create) Pamsimas." });
      var uraianKe = String(p.uraian || "").trim().slice(0, 200);
      var jumlahKe = jumlahSah_(p.jumlah);
      if (!uraianKe || !jumlahKe) {
        return json_({ ok: false, pesan: "Uraian dan jumlah wajib diisi dengan benar." });
      }
      var lockKe = LockService.getScriptLock();
      lockKe.waitLock(5000);
      try {
        lembarPamKas_().appendRow([Utilities.getUuid(), new Date(), "keluar",
          "", "", teks_(uraianKe), jumlahKe].concat(jejak_(akunKe.user)));
      } finally {
        lockKe.releaseLock();
      }
      return json_({ ok: true });
    }

    // Saldo awal pembukuan — hanya boleh satu entri; hapus dulu untuk mengganti
    if (p.aksi === "pam-saldo") {
      var akunSa = adminDariToken_(p.token);
      if (!akunSa) return json_({ ok: false, butuhLogin: true });
      if (!punyaAkses_(akunSa, "pamsimas", "c")) return json_({ ok: false, pesan: "Anda tidak punya akses tambah (create) Pamsimas." });
      var jumlahSa = jumlahSah_(p.jumlah);
      if (!jumlahSa) return json_({ ok: false, pesan: "Jumlah saldo awal tidak valid." });
      var rowsSa = lembarPamKas_().getDataRange().getValues();
      for (var sa = 1; sa < rowsSa.length; sa++) {
        if (String(rowsSa[sa][2]) === "saldo") {
          return json_({ ok: false, pesan: "Saldo awal sudah tercatat — hapus entri lamanya dulu untuk mengganti." });
        }
      }
      var lockSa = LockService.getScriptLock();
      lockSa.waitLock(5000);
      try {
        lembarPamKas_().appendRow([Utilities.getUuid(), new Date(), "saldo",
          "", "", "Saldo awal pembukuan (pindahan dari buku)", jumlahSa]
          .concat(jejak_(akunSa.user)));
      } finally {
        lockSa.releaseLock();
      }
      return json_({ ok: true });
    }

    // Edit catatan kas — butuh hak akses pamsimas_edit (atau pemilik)
    if (p.aksi === "pam-kas-edit") {
      var akunKd = adminDariToken_(p.token);
      if (!akunKd) return json_({ ok: false, butuhLogin: true });
      if (!punyaAkses_(akunKd, "pamsimas", "w")) {
        return json_({ ok: false, pesan: "Anda tidak punya akses ubah (write) Pamsimas. Minta Super User mengaturnya di menu Pengguna." });
      }
      var shKd = lembarPamKas_();
      var rowsKd = shKd.getDataRange().getValues();
      var rKd = barisDariId_(rowsKd, p.id);
      if (!rKd) return json_({ ok: false, pesan: "Catatan tidak ditemukan." });
      var jenisKd = String(rowsKd[rKd - 1][2]);
      var jumlahKd = jumlahSah_(p.jumlah);
      if (!jumlahKd) return json_({ ok: false, pesan: "Jumlah tidak valid." });
      var ketKd = String(p.keterangan || "").trim().slice(0, 200);
      if (jenisKd === "masuk") {
        var idPelKd = String(p.pelanggan || "") || String(rowsKd[rKd - 1][3]);
        var blnKd = /^\d{4}-\d{2}$/.test(p.bulan) ? p.bulan : String(rowsKd[rKd - 1][4]);
        for (var dk = 1; dk < rowsKd.length; dk++) {
          if (dk !== rKd - 1 && String(rowsKd[dk][2]) === "masuk" &&
              String(rowsKd[dk][3]) === idPelKd && String(rowsKd[dk][4]) === blnKd) {
            return json_({ ok: false, pesan: "Iuran bulan itu sudah tercatat untuk pelanggan ini." });
          }
        }
        shKd.getRange(rKd, 4, 1, 4).setValues([[idPelKd, "'" + blnKd, teks_(ketKd), jumlahKd]]);
      } else if (jenisKd === "keluar") {
        if (!ketKd) return json_({ ok: false, pesan: "Uraian pengeluaran wajib diisi." });
        shKd.getRange(rKd, 6, 1, 2).setValues([[teks_(ketKd), jumlahKd]]);
      } else {
        shKd.getRange(rKd, 7).setValue(jumlahKd);
      }
      tulisJejak_(shKd, rKd, 10, akunKd.user);
      return json_({ ok: true });
    }

    if (p.aksi === "pam-hapus") {
      var akunPh = adminDariToken_(p.token);
      if (!akunPh) return json_({ ok: false, butuhLogin: true });
      if (!punyaAkses_(akunPh, "pamsimas", "u")) {
        return json_({ ok: false, pesan: "Anda tidak punya akses hapus (unlink) Pamsimas. Minta Super User mengaturnya di menu Pengguna." });
      }
      var shKh = lembarPamKas_();
      var rKh = barisDariId_(shKh.getDataRange().getValues(), p.id);
      if (rKh) { shKh.deleteRow(rKh); ok = true; }
      return json_({ ok: ok });
    }

    // Simpan konfigurasi (hanya pemilik); kunci dibatasi whitelist
    if (p.aksi === "konfig-set") {
      if (!adminDariToken_(p.token)) return json_({ ok: false, butuhLogin: true });
      var pemilikK = adminPemilik_(p.token);
      if (!pemilikK) return json_({ ok: false, pesan: "Hanya pemilik yang boleh mengubah konfigurasi." });
      var kunciK = String(p.kunci || "");
      if (KUNCI_KONFIG_SAH.indexOf(kunciK) < 0) return json_({ ok: false, pesan: "Kunci konfigurasi tidak dikenal." });
      var nilaiK = String(p.nilai || "").trim().slice(0, 300);
      if (kunciK === "drive_folder" && nilaiK &&
          !/^https:\/\/drive\.google\.com\//.test(nilaiK)) {
        return json_({ ok: false, pesan: "Isi dengan tautan folder Google Drive (drive.google.com)." });
      }
      if (kunciK === "pamsimas_publik" && nilaiK && nilaiK !== "ya" && nilaiK !== "tidak") {
        return json_({ ok: false, pesan: "Nilai harus 'ya' atau 'tidak'." });
      }
      if ((kunciK === "cloudinary_cloud" || kunciK === "cloudinary_preset") &&
          nilaiK && !/^[A-Za-z0-9._-]+$/.test(nilaiK)) {
        return json_({ ok: false, pesan: "Nilai Cloudinary hanya huruf/angka/titik/strip." });
      }
      var shK = lembarKonfig_();
      var rowsK2 = shK.getDataRange().getValues();
      var rK = 0;
      for (var ik = 1; ik < rowsK2.length; ik++) {
        if (String(rowsK2[ik][0]) === kunciK) { rK = ik + 1; break; }
      }
      if (rK) {
        shK.getRange(rK, 2).setValue(teks_(nilaiK));
        tulisJejak_(shK, rK, 5, pemilikK.user);
      } else {
        shK.appendRow([kunciK, teks_(nilaiK)].concat(jejak_(pemilikK.user)));
      }
      return json_({ ok: true });
    }

    if (p.aksi === "user-tambah") {
      if (!adminDariToken_(p.token)) return json_({ ok: false, butuhLogin: true });
      var pemilikT = adminPemilik_(p.token);
      if (!pemilikT) return json_({ ok: false, pesan: "Hanya pemilik yang boleh mengelola pengguna." });
      var userBaru = String(p.user || "").trim().toLowerCase().slice(0, 40).replace(/[^a-z0-9._-]/g, "");
      var passBaru = String(p.pass || "").slice(0, 80);
      var namaBaru = String(p.nama || "").trim().slice(0, 80);
      var peranBaru = p.peran === "pemilik" ? "pemilik" : "admin";
      if (!userBaru) return json_({ ok: false, pesan: "Username wajib diisi (huruf/angka/titik/strip)." });
      if (passBaru.length < 8) return json_({ ok: false, pesan: "Password minimal 8 karakter." });
      var shU = lembarUser_();
      var adaU = shU.getDataRange().getValues();
      for (var d = 1; d < adaU.length; d++) {
        if (String(adaU[d][0]).trim().toLowerCase() === userBaru) {
          return json_({ ok: false, pesan: "Username sudah dipakai." });
        }
      }
      var lockU = LockService.getScriptLock();
      lockU.waitLock(5000);
      try {
        shU.appendRow([userBaru, teks_(passBaru), teks_(namaBaru || userBaru), peranBaru, ""]
          .concat(jejak_(pemilikT.user)).concat([Utilities.getUuid()]));
      } finally {
        lockU.releaseLock();
      }
      simpanAksesUser_(userBaru, p.akses, pemilikT.user);
      return json_({ ok: true });
    }

    if (p.aksi === "user-edit") {
      if (!adminDariToken_(p.token)) return json_({ ok: false, butuhLogin: true });
      var pemilikE = adminPemilik_(p.token);
      if (!pemilikE) return json_({ ok: false, pesan: "Hanya pemilik yang boleh mengelola pengguna." });
      var targetE = String(p.user || "").trim().toLowerCase();
      var namaU = String(p.nama || "").trim().slice(0, 80);
      var peranU = p.peran === "pemilik" ? "pemilik" : "admin";
      var passU = String(p.pass || "");
      if (targetE === pemilikE.user && peranU !== "pemilik") {
        return json_({ ok: false, pesan: "Tidak bisa menurunkan peran akun sendiri." });
      }
      if (passU && passU.length < 8) return json_({ ok: false, pesan: "Password minimal 8 karakter." });
      var shUe = lembarUser_();
      var rowsUe = shUe.getDataRange().getValues();
      var rUe = 0, peranLama = "";
      for (var ue = 1; ue < rowsUe.length; ue++) {
        if (String(rowsUe[ue][0]).trim().toLowerCase() === targetE) {
          rUe = ue + 1;
          peranLama = String(rowsUe[ue][3] || "").trim().toLowerCase() === "pemilik" ? "pemilik" : "admin";
          break;
        }
      }
      if (!rUe) return json_({ ok: false, pesan: "Pengguna tidak ditemukan." });
      var aksesLamaR = ringkasAkses_(bacaAksesUser_(targetE));
      shUe.getRange(rUe, 3, 1, 2).setValues([[teks_(namaU || targetE), peranU]]);
      if (passU) shUe.getRange(rUe, 2).setValue(teks_(passU));
      // pastikan record punya ID (kolom 10); isi bila kosong/bukan uuid
      if (!/^[0-9a-f-]{36}$/.test(String(rowsUe[rUe - 1][9] || ""))) {
        shUe.getRange(rUe, 10).setValue(Utilities.getUuid());
      }
      tulisJejak_(shUe, rUe, 8, pemilikE.user);
      simpanAksesUser_(targetE, p.akses, pemilikE.user);
      var aksesBaruR = ringkasAkses_(bacaAksesUser_(targetE));
      // peran/akses berubah / password di-reset → cabut sesi target (kecuali akun sendiri)
      if (targetE !== pemilikE.user && (peranU !== peranLama || passU || aksesBaruR !== aksesLamaR)) {
        var propsUe = PropertiesService.getScriptProperties();
        var semuaUe = propsUe.getProperties();
        for (var kUe in semuaUe) {
          if (kUe.indexOf("tok_") !== 0) continue;
          try {
            if (JSON.parse(semuaUe[kUe]).user === targetE) propsUe.deleteProperty(kUe);
          } catch (err) {}
        }
      }
      return json_({ ok: true });
    }

    if (p.aksi === "user-hapus") {
      var pemilikH = adminPemilik_(p.token);
      if (!adminDariToken_(p.token)) return json_({ ok: false, butuhLogin: true });
      if (!pemilikH) return json_({ ok: false, pesan: "Hanya pemilik yang boleh mengelola pengguna." });
      var target = String(p.user || "").trim().toLowerCase();
      if (!target) return json_({ ok: false });
      if (target === pemilikH.user) return json_({ ok: false, pesan: "Tidak bisa menghapus akun sendiri." });
      var shHu = lembarUser_();
      var rowsHu = shHu.getDataRange().getValues();
      for (var h = rowsHu.length - 1; h >= 1; h--) {
        if (String(rowsHu[h][0]).trim().toLowerCase() === target) {
          shHu.deleteRow(h + 1);
          ok = true;
          break;
        }
      }
      if (ok) {
        // hapus juga baris AKSES milik akun itu
        var shAkH = lembarAkses_();
        var rowsAkH = shAkH.getDataRange().getValues();
        for (var akh = rowsAkH.length - 1; akh >= 1; akh--) {
          if (String(rowsAkH[akh][1]).trim().toLowerCase() === target) shAkH.deleteRow(akh + 1);
        }
        // cabut semua sesi aktif milik akun yang dihapus
        var propsHu = PropertiesService.getScriptProperties();
        var semuaHu = propsHu.getProperties();
        for (var kHu in semuaHu) {
          if (kHu.indexOf("tok_") !== 0) continue;
          try {
            if (JSON.parse(semuaHu[kHu]).user === target) propsHu.deleteProperty(kHu);
          } catch (err) {}
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
        lembar_().appendRow([new Date(), teks_(nama || "-"), teks_(kontak || "-"), teks_(pesan)]
          .concat(jejak_("publik")));
      } finally {
        lock.releaseLock();
      }
      ok = true;
    }
  } catch (err) {}
  return json_({ ok: ok });
}
