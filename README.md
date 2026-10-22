# SI Padang Jambu

Website & Sistem Informasi **Korong Padang Jambu**, Nagari Guguak Kuranji Hilir, Kecamatan Sungai Limau, Kabupaten Padang Pariaman, Sumatera Barat.

Situs statis satu halaman (`index.html`) tanpa build step dan tanpa server — bisa langsung di-hosting di GitHub Pages atau Cloudflare Pages.

## Struktur

```
index.html                     Seluruh situs: HTML + CSS + JS dalam satu file
admin.html                     Portal admin (login + daftar aspirasi masuk)
assets/logo.svg                Logo & favicon
tools/apps-script-aspirasi.gs  Backend Apps Script: form aspirasi + login admin
```

## Mengubah isi situs

Semua konten masih ditulis langsung di `index.html`:

- **Statistik penduduk** — objek `STATISTIK` di bagian `<script>` (cari `DATA STATISTIK`). Ubah angkanya, grafik dan tabel ikut berubah otomatis.
- **Pengumuman, keuangan, potensi** — edit langsung di markup masing-masing `<section>`.
- **Foto hero** — masih memakai gambar Unsplash (cari `images.unsplash.com`); ganti dengan foto asli korong.

## Form Aspirasi (Google Sheets)

Form kontak mengirim pesan ke spreadsheet privat lewat Apps Script:

1. Buat spreadsheet baru (privat) di Google Sheets.
2. Extensions → Apps Script, ganti isi `Code.gs` dengan `tools/apps-script-aspirasi.gs`.
3. Deploy → New deployment → **Web app** — Execute as: *Me*, Who has access: *Anyone*.
4. Salin URL `/exec`, tempel ke konstanta `ASPIRASI_URL` di `index.html` **dan** `admin.html`.

Selama `ASPIRASI_URL` kosong, form otomatis memakai fallback `mailto:`.

## Portal Admin (`admin.html`)

Halaman login untuk pengelola; setelah masuk, menampilkan daftar aspirasi yang masuk
tanpa perlu membuka spreadsheet.

- Akun disimpan di sheet **ADMIN** pada spreadsheet yang sama: kolom
  `Username | Password | Nama` (satu baris per pengelola).
- **Pakai password karangan** — jangan password asli akun lain; password tersimpan
  sebagai teks biasa di spreadsheet (yang tetap privat).
- Login menghasilkan token (berlaku 7 hari, tersimpan di browser); salah password
  5× mengunci username 10 menit.

## Rencana

- [ ] Pindahkan data statistik & pengumuman ke Google Sheets (pola yang sama dengan form aspirasi).
- [ ] Galeri foto korong (upload via portal admin).
- [ ] Custom domain (mis. `padangjambu.id` / subdomain `desa.id`).

## Pengelola

[Muhardiansyah](https://muhardiansyah15.github.io/) — website dikelola mandiri sebagai media informasi warga Korong Padang Jambu.
