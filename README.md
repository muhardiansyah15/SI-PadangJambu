# SI Padang Jambu

Website & Sistem Informasi **Korong Padang Jambu**, Nagari Guguak Kuranji Hilir, Kecamatan Sungai Limau, Kabupaten Padang Pariaman, Sumatera Barat.

Situs statis satu halaman (`index.html`) tanpa build step dan tanpa server — bisa langsung di-hosting di GitHub Pages atau Cloudflare Pages.

## Struktur

```
index.html                     Situs utama: HTML + CSS + JS dalam satu file
portal/                        Portal admin — aplikasi React + Vite
assets/logo.svg                Logo & favicon
tools/apps-script-aspirasi.gs  Backend Apps Script: aspirasi, pengumuman, login admin
.github/workflows/deploy.yml   Build portal + deploy ke GitHub Pages tiap push
```

## Pengembangan portal

```bash
cd portal
npm install
npm run dev     # server pengembangan di localhost
npm run build   # hasil produksi di portal/dist
```

Deploy otomatis lewat GitHub Actions (lihat `deploy.yml`): tiap push ke `main`,
portal di-build lalu seluruh situs ditayangkan — portal di `/portal/`.
**Prasyarat satu kali:** Settings → Pages → Source: ubah ke **GitHub Actions**.
Endpoint bisa dioverride saat build lewat env `VITE_ASPIRASI_URL` (opsional).

## Alur staging → production

- Branch **`main`** = staging: tiap push tayang di GitHub Pages
  (`muhardiansyah15.github.io/SI-PadangJambu`) untuk diuji.
- Branch **`production`** = produksi: Netlify (`padangjambu.netlify.app`)
  hanya membangun branch ini — push ke `main` tidak memakai jatah build Netlify.
- Rilis ke produksi setelah staging oke:

  ```bash
  git push origin main:production
  ```

Setelan Netlify (satu kali): Site configuration → Build & deploy → Branches →
Production branch: `production`; Branch deploys: hanya production; Deploy
Previews: Off.

## Mengubah isi situs

Semua konten masih ditulis langsung di `index.html`:

- **Statistik penduduk** — dimuat otomatis dari sheet `PENDUDUK` (lihat di bawah).
  Objek `STATISTIK` di bagian `<script>` (cari `DATA STATISTIK`) adalah angka
  fallback yang tampil selama `ASPIRASI_URL` kosong atau server gagal dihubungi.
- **Pengumuman** — dikelola lewat portal admin (`admin.html` → Kelola Pengumuman),
  tersimpan di sheet `PENGUMUMAN`. Markup statis di section Pengumuman adalah
  fallback selama belum ada pengumuman dari portal.
- **Keuangan, potensi** — edit langsung di markup masing-masing `<section>`.
- **Foto hero** — masih memakai gambar Unsplash (cari `images.unsplash.com`); ganti dengan foto asli korong.

## Form Aspirasi (Google Sheets)

Form kontak mengirim pesan ke spreadsheet privat lewat Apps Script:

1. Buat spreadsheet baru (privat) di Google Sheets.
2. Extensions → Apps Script, ganti isi `Code.gs` dengan `tools/apps-script-aspirasi.gs`.
3. Deploy → New deployment → **Web app** — Execute as: *Me*, Who has access: *Anyone*.
4. Salin URL `/exec`, tempel ke konstanta `ASPIRASI_URL` di `index.html` **dan** `admin.html`.

Selama `ASPIRASI_URL` kosong, form otomatis memakai fallback `mailto:`.

## Portal Admin (`portal/`)

Aplikasi React untuk pengelola; setelah login, menampilkan daftar aspirasi masuk
dan form kelola pengumuman tanpa perlu membuka spreadsheet.

- Akun disimpan di sheet **ADMIN** pada spreadsheet yang sama: kolom
  `Username | Password | Nama | Peran` (satu baris per pengelola).
- **Peran** mengatur hak akses: `pemilik` bisa membuka menu **Pengguna**
  (buat/hapus akun dari portal); kosong atau `admin` = kelola konten saja.
  Bootstrap satu kali: tulis `pemilik` manual di kolom Peran untuk akun Anda
  sendiri di spreadsheet — hak ini berakar di spreadsheet, bukan di portal,
  dan diverifikasi server pada tiap permintaan.
- **Pakai password karangan** — jangan password asli akun lain; password tersimpan
  sebagai teks biasa di spreadsheet (yang tetap privat).
- Login menghasilkan token (berlaku 7 hari, tersimpan di browser); salah password
  5× mengunci username 10 menit.

## Galeri Foto (Cloudinary)

Foto galeri disimpan di Cloudinary (gratis, CDN + kompresi otomatis); sheet
`GALERI` hanya mencatat URL + keterangan + album. Setup satu kali:

1. Buat akun gratis di [cloudinary.com](https://cloudinary.com).
2. Dashboard → Settings → Upload → **Upload presets** → Add upload preset →
   Signing mode: **Unsigned** (catat nama preset-nya).
3. Isi **cloud name** dan **nama preset** ke konstanta `CLOUDINARY` di
   `portal/src/api.js` (atau env `VITE_CLOUDINARY_CLOUD` / `VITE_CLOUDINARY_PRESET`),
   lalu push.

Portal mengecilkan foto ke maks. 1600px sebelum unggah. Menghapus foto dari
portal hanya menghapus catatannya; file di Cloudinary dihapus manual dari
dashboard bila perlu. Jangan unggah foto close-up anak tanpa izin orang tua.

## Backup Otomatis

Pasang `tools/apps-script-backup.gs` sebagai project Apps Script **terpisah**
(standalone di script.google.com, bukan di dalam spreadsheet) — petunjuk
lengkap ada di komentar file itu. Trigger mingguan menyalin spreadsheet ke
folder "Backup SI Padang Jambu" di Drive dan menghapus salinan > 90 hari.
Dibuat terpisah agar skrip utama tetap `@OnlyCurrentDoc`.

## Keamanan Password

Password admin disimpan ter-hash (`sha256$salt$hash`) sejak versi ini.
Akun lama berpassword teks biasa tetap bisa login dan otomatis ter-upgrade
menjadi hash saat login pertama yang berhasil — tidak perlu migrasi manual.

## Data Penduduk (sheet `PENDUDUK`)

Data penduduk **tidak diinput lewat portal web** — perangkat korong mengisinya
langsung di Google Sheets (yang dilindungi login Google + 2FA). Website hanya
menerima **agregat** (jumlah per RW, kelompok umur, pekerjaan, pendidikan) lewat
`GET ?daftar=statistik`; data per orang tidak pernah melewati endpoint publik.

Kolom sheet `PENDUDUK` — sengaja minim sesuai asas minimalisasi UU PDP
(No. 27/2022), **tanpa NIK dan tanpa tanggal lahir lengkap**:

| Nama | RW | JK (L/P) | Tahun Lahir | Pekerjaan | Pendidikan | Kepala Keluarga (Y) |
|------|----|----------|-------------|-----------|------------|---------------------|

- Kolom *Kepala Keluarga* diisi `Y` hanya pada baris kepala keluarga (dasar hitungan KK).
- Agregat di-cache 10 menit — perubahan data muncul di situs maks. 10 menit kemudian.
- Statistik baru menggantikan angka fallback bila sheet berisi minimal 1 penduduk.
- Catatan tata kelola: pengendali data sebaiknya pemerintahan korong/nagari —
  mintakan penugasan tertulis dari wali korong/wali nagari untuk pendataan ini.

## Rencana

- [ ] Pindahkan data statistik & pengumuman ke Google Sheets (pola yang sama dengan form aspirasi).
- [ ] Galeri foto korong (upload via portal admin).
- [ ] Custom domain (mis. `padangjambu.id` / subdomain `desa.id`).

## Pengelola

[Muhardiansyah](https://muhardiansyah15.github.io/) — website dikelola mandiri sebagai media informasi warga Korong Padang Jambu.
