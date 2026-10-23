/**
 * Backup mingguan spreadsheet SI Padang Jambu.
 *
 * SENGAJA dibuat sebagai project Apps Script TERPISAH (standalone),
 * supaya skrip utama (apps-script-aspirasi.gs) tetap @OnlyCurrentDoc —
 * hanya skrip kecil ini yang memegang izin Drive.
 *
 * Cara pasang (sekali saja):
 * 1. Buka https://script.google.com > New project, tempel isi file ini.
 * 2. Isi SPREADSHEET_ID di bawah (dari URL spreadsheet:
 *    docs.google.com/spreadsheets/d/<ID_INI>/edit).
 * 3. Jalankan fungsi backupMingguan sekali dari editor (tombol Run)
 *    untuk otorisasi dan menguji — cek Drive: muncul folder
 *    "Backup SI Padang Jambu" berisi salinan pertama.
 * 4. Kiri: Triggers (ikon jam) > Add Trigger >
 *    backupMingguan | Time-driven | Week timer | pilih hari & jam
 *    (mis. Senin 03.00–04.00).
 *
 * Salinan diberi nama bertanggal; yang lebih tua dari JAGA_HARI
 * dihapus otomatis supaya Drive tidak penuh.
 */
var SPREADSHEET_ID = "ISI_ID_SPREADSHEET_DI_SINI";
var NAMA_FOLDER = "Backup SI Padang Jambu";
var JAGA_HARI = 90; // simpan backup 3 bulan terakhir

function backupMingguan() {
  var sumber = DriveApp.getFileById(SPREADSHEET_ID);

  // cari / buat folder backup
  var folder;
  var cari = DriveApp.getFoldersByName(NAMA_FOLDER);
  folder = cari.hasNext() ? cari.next() : DriveApp.createFolder(NAMA_FOLDER);

  // salin dengan nama bertanggal
  var tgl = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");
  sumber.makeCopy(sumber.getName() + " — backup " + tgl, folder);

  // bersihkan salinan yang lebih tua dari JAGA_HARI
  var batas = Date.now() - JAGA_HARI * 86400000;
  var isi = folder.getFiles();
  while (isi.hasNext()) {
    var f = isi.next();
    if (f.getDateCreated().getTime() < batas) f.setTrashed(true);
  }
}
