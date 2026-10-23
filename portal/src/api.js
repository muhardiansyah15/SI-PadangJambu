// Endpoint Apps Script (tools/apps-script-aspirasi.gs).
// Bisa dioverride lewat env VITE_ASPIRASI_URL (Netlify/CI) tanpa mengubah kode.
export const ASPIRASI_URL =
  import.meta.env.VITE_ASPIRASI_URL ||
  'https://script.google.com/macros/s/AKfycbyFgEX7Sf9nDCuHhH1i8h2_jbyXMt6zWb2clZ6hoe7IqtP8bFKkk99mZnsp3pAK8A7t/exec'

// Cloudinary (galeri foto): isi cloud name + unsigned upload preset dari
// dashboard Cloudinary (Settings > Upload > Upload presets, mode Unsigned).
// Bisa juga lewat env VITE_CLOUDINARY_CLOUD / VITE_CLOUDINARY_PRESET.
export const CLOUDINARY = {
  cloud: import.meta.env.VITE_CLOUDINARY_CLOUD || 'aifdjyjs',
  preset: import.meta.env.VITE_CLOUDINARY_PRESET || 'SI-padangjambu',
}

/** Sisipkan transformasi ke URL Cloudinary (thumbnail/tampilan besar). */
export function urlTransform(url, trans) {
  return url.replace('/upload/', '/upload/' + trans + '/')
}

/** Kecilkan foto di browser (JPEG 85%) sebelum diunggah. */
export function kecilkan(file, maxDim = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const skala = Math.min(1, maxDim / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * skala)
      canvas.height = Math.round(img.height * skala)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error())), 'image/jpeg', 0.85)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Kecilkan lalu unggah ke Cloudinary; mengembalikan secure_url.
 * `folder` memecah aset per jenis konten (galeri/struktur/profil) —
 * agar berfungsi, field Asset folder pada upload preset harus KOSONG.
 */
export async function unggahCloudinary(file, maxDim = 1600, folder = 'padang-jambu/lainnya') {
  const blob = await kecilkan(file, maxDim)
  const fd = new FormData()
  fd.append('file', blob, 'foto.jpg')
  fd.append('upload_preset', CLOUDINARY.preset)
  fd.append('folder', folder)
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY.cloud}/image/upload`, {
    method: 'POST', body: fd,
  })
  const j = await res.json()
  if (!j.secure_url) throw new Error(j.error?.message || 'Upload ke Cloudinary gagal.')
  return j.secure_url
}

export async function apiGet(params) {
  const res = await fetch(ASPIRASI_URL + '?' + new URLSearchParams(params))
  return res.json()
}

export async function apiPost(body) {
  const res = await fetch(ASPIRASI_URL, { method: 'POST', body: JSON.stringify(body) })
  return res.json()
}

const KUNCI_TOKEN = 'pj_admin'

export function bacaSesi() {
  try {
    const s = JSON.parse(localStorage.getItem(KUNCI_TOKEN))
    return s && s.token ? s : null
  } catch {
    return null
  }
}

export function simpanSesi(sesi) {
  try {
    if (sesi) localStorage.setItem(KUNCI_TOKEN, JSON.stringify(sesi))
    else localStorage.removeItem(KUNCI_TOKEN)
  } catch {
    /* penyimpanan browser tidak tersedia — sesi hanya bertahan selama tab terbuka */
  }
}

export const fmtWaktu = iso =>
  iso ? new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : ''

export const fmtTgl = tgl =>
  tgl
    ? new Date(tgl + 'T00:00:00').toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : ''
