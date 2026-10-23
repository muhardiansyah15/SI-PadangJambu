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

function lembar_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(["Waktu", "Nama", "Kontak", "Pesan"].concat(KOLOM_JEJAK));
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
    sh.appendRow(["Username", "Password", "Nama", "Peran", "Foto"].concat(KOLOM_JEJAK));
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
      // PropertiesService: tahan lama (CacheService bisa terhapus sewaktu-waktu)
      bersihkanTokenKadaluarsa_();
      PropertiesService.getScriptProperties().setProperty("tok_" + token,
        JSON.stringify({
          user: user,
          nama: String(rows[i][2] || user),
          peran: peran,
          exp: Date.now() + TOKEN_HARI * 86400000
        }));
      cache.remove("gagal_" + user);
      return { ok: true, token: token, nama: String(rows[i][2] || user), user: user,
        peran: peran, foto: String(rows[i][4] || "") };
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
  if (e && e.parameter && e.parameter.daftar === "user") {
    if (!adminDariToken_(e.parameter.token)) return json_({ ok: false, butuhLogin: true });
    if (!adminPemilik_(e.parameter.token)) return json_({ ok: false, pesan: "Khusus pemilik." });
    var rowsU = lembarUser_().getDataRange().getValues();
    var daftarU = [];
    for (var u = 1; u < rowsU.length; u++) {
      if (!rowsU[u][0]) continue;
      daftarU.push({
        user: String(rowsU[u][0]).trim().toLowerCase(),
        nama: String(rowsU[u][2] || rowsU[u][0]),
        peran: String(rowsU[u][3] || "").trim().toLowerCase() === "pemilik" ? "pemilik" : "admin",
        foto: String(rowsU[u][4] || "")
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
          .concat(jejak_(pemilikT.user)));
      } finally {
        lockU.releaseLock();
      }
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
      shUe.getRange(rUe, 3, 1, 2).setValues([[teks_(namaU || targetE), peranU]]);
      if (passU) shUe.getRange(rUe, 2).setValue(teks_(passU));
      tulisJejak_(shUe, rUe, 8, pemilikE.user);
      // peran berubah / password di-reset → cabut sesi target (kecuali akun sendiri)
      if (targetE !== pemilikE.user && (peranU !== peranLama || passU)) {
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
