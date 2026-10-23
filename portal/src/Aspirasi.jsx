import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPost, fmtWaktu } from './api.js'

export default function Aspirasi({ sesi, onSesiBerakhir }) {
  const [data, setData] = useState(null) // null = memuat, [] = kosong
  const [gagal, setGagal] = useState(false)

  const muat = useCallback(async () => {
    setData(null)
    setGagal(false)
    try {
      const j = await apiGet({ daftar: 'aspirasi', token: sesi.token })
      if (j.butuhLogin) { onSesiBerakhir(); return }
      // data bukan array = backend versi lama / jawaban tak terduga → tampilkan "gagal"
      if (!j.ok || !Array.isArray(j.data)) throw new Error()
      setData(j.data)
    } catch {
      setGagal(true)
      setData([])
    }
  }, [sesi.token, onSesiBerakhir])

  useEffect(() => { muat() }, [muat])

  async function ubahStatus(a, status) {
    try {
      const j = await apiPost({ aksi: 'aspirasi-status', token: sesi.token, baris: a.baris, pesan: a.pesan, status })
      if (j.butuhLogin) { onSesiBerakhir(); return }
      if (!j.ok && j.pesan) alert(j.pesan)
      muat()
    } catch {
      alert('Gagal menyimpan status. Periksa koneksi internet.')
    }
  }

  async function hapus(a) {
    if (!confirm(`Hapus aspirasi dari "${a.nama}"? Tindakan ini tidak bisa dibatalkan.`)) return
    try {
      const j = await apiPost({ aksi: 'aspirasi-hapus', token: sesi.token, baris: a.baris, pesan: a.pesan })
      if (j.butuhLogin) { onSesiBerakhir(); return }
      if (!j.ok && j.pesan) { alert(j.pesan) }
      muat()
    } catch {
      alert('Gagal menghapus. Periksa koneksi internet.')
    }
  }

  return (
    <div className="kartu">
      <div className="bar-atas">
        <h2>Aspirasi Masuk</h2>
        <button className="btn btn-kecil btn-polos" onClick={muat}>Muat Ulang ↻</button>
      </div>

      {data === null && <div className="kosong">Memuat…</div>}
      {data !== null && gagal && <div className="kosong">Gagal memuat. Coba muat ulang.</div>}
      {data !== null && !gagal && data.length === 0 && (
        <div className="kosong">Belum ada aspirasi yang masuk.</div>
      )}
      {data !== null && data.map((a, i) => (
        <div className="aspirasi-item" key={i}>
          <div className="aspirasi-meta">
            <b>
              <span className={'status-tag ' + a.status}>
                {a.status === 'baru' ? 'Baru' : a.status === 'diproses' ? 'Diproses' : 'Selesai'}
              </span>
              {a.nama}
            </b>
            <span>{fmtWaktu(a.waktu)}</span>
          </div>
          <div className="aspirasi-pesan">{a.pesan}</div>
          {a.kontak && a.kontak !== '-' && <div className="aspirasi-kontak">📱 {a.kontak}</div>}
          <div className="baris-hapus baris-status">
            <select className="form-input pilih-status" value={a.status}
              onChange={e => ubahStatus(a, e.target.value)}>
              <option value="baru">Baru</option>
              <option value="diproses">Diproses</option>
              <option value="selesai">Selesai</option>
            </select>
            <button className="btn-hapus" onClick={() => hapus(a)}>Hapus</button>
          </div>
        </div>
      ))}
    </div>
  )
}
