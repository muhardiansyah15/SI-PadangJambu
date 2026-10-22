import { useCallback, useEffect, useState } from 'react'
import { apiGet, fmtWaktu } from './api.js'

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
            <b>{a.nama}</b>
            <span>{fmtWaktu(a.waktu)}</span>
          </div>
          <div className="aspirasi-pesan">{a.pesan}</div>
          {a.kontak && a.kontak !== '-' && <div className="aspirasi-kontak">📱 {a.kontak}</div>}
        </div>
      ))}
    </div>
  )
}
