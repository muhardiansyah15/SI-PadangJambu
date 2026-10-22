import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPost, fmtTgl, fmtWaktu } from './api.js'

const LABEL_KAT = { penting: 'Penting', kegiatan: 'Kegiatan', layanan: 'Layanan' }
const FORM_KOSONG = { judul: '', kategori: 'kegiatan', isi: '', tgl: '', jam: '', tempat: '' }

function metaAcara(pg) {
  const bagian = []
  if (pg.tgl) bagian.push('🗓 ' + fmtTgl(pg.tgl))
  if (pg.jam) bagian.push('🕘 ' + pg.jam.replace(':', '.') + ' WIB')
  if (pg.tempat) bagian.push('📍 ' + pg.tempat)
  return bagian.join(' · ')
}

export default function Pengumuman({ sesi, onSesiBerakhir }) {
  const [form, setForm] = useState(FORM_KOSONG)
  const [status, setStatus] = useState(null) // {ok, teks}
  const [sibuk, setSibuk] = useState(false)
  const [data, setData] = useState(null)
  const [gagal, setGagal] = useState(false)

  const ubah = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const muat = useCallback(async () => {
    setData(null)
    setGagal(false)
    try {
      const j = await apiGet({ daftar: 'pengumuman' })
      // data bukan array = backend versi lama / jawaban tak terduga → tampilkan "gagal"
      if (!j.ok || !Array.isArray(j.data)) throw new Error()
      setData(j.data)
    } catch {
      setGagal(true)
      setData([])
    }
  }, [])

  useEffect(() => { muat() }, [muat])

  async function terbitkan(ev) {
    ev.preventDefault()
    setSibuk(true)
    setStatus(null)
    try {
      const j = await apiPost({ aksi: 'pengumuman', token: sesi.token, ...form })
      if (j.butuhLogin) { onSesiBerakhir(); return }
      if (!j.ok) {
        setStatus({ ok: false, teks: j.pesan || 'Gagal menerbitkan.' })
        return
      }
      setForm(FORM_KOSONG)
      setStatus({ ok: true, teks: 'Pengumuman tayang di website. ✅' })
      muat()
    } catch {
      setStatus({ ok: false, teks: 'Gagal terhubung. Periksa koneksi internet.' })
    } finally {
      setSibuk(false)
    }
  }

  async function hapus(id) {
    if (!confirm('Hapus pengumuman ini dari website?')) return
    try {
      const j = await apiPost({ aksi: 'pengumuman-hapus', token: sesi.token, id })
      if (j.butuhLogin) { onSesiBerakhir(); return }
      muat()
    } catch {
      alert('Gagal menghapus. Periksa koneksi internet.')
    }
  }

  return (
    <div className="kartu">
      <h2>Kelola Pengumuman</h2>
      <form onSubmit={terbitkan}>
        <div className="form-group">
          <label className="form-label" htmlFor="pJudul">Judul</label>
          <input id="pJudul" name="judul" className="form-input" maxLength={120} required
            value={form.judul} onChange={ubah} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="pKategori">Kategori</label>
          <select id="pKategori" name="kategori" className="form-input" value={form.kategori} onChange={ubah}>
            <option value="kegiatan">Kegiatan</option>
            <option value="penting">Penting</option>
            <option value="layanan">Layanan</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="pIsi">Isi pengumuman</label>
          <textarea id="pIsi" name="isi" className="form-input" maxLength={1000} required
            value={form.isi} onChange={ubah} />
        </div>
        <div className="form-baris">
          <div className="form-group">
            <label className="form-label" htmlFor="pTgl">Tanggal acara (opsional)</label>
            <input id="pTgl" name="tgl" type="date" className="form-input" value={form.tgl} onChange={ubah} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="pJam">Jam (opsional)</label>
            <input id="pJam" name="jam" type="time" className="form-input" value={form.jam} onChange={ubah} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="pTempat">Tempat (opsional)</label>
          <input id="pTempat" name="tempat" className="form-input" maxLength={100}
            placeholder="mis. Balai Korong" value={form.tempat} onChange={ubah} />
        </div>
        <button className="btn" type="submit" disabled={sibuk}>
          {sibuk ? 'Menerbitkan…' : 'Terbitkan ke Website 📢'}
        </button>
        {status && <div className={'status ' + (status.ok ? 'ok' : 'gagal')}>{status.teks}</div>}
      </form>

      <div className="sub-judul">Pengumuman Tayang</div>
      {data === null && <div className="kosong">Memuat…</div>}
      {data !== null && gagal && <div className="kosong">Gagal memuat. Coba muat ulang.</div>}
      {data !== null && !gagal && data.length === 0 && (
        <div className="kosong">Belum ada pengumuman. Website menampilkan contoh bawaan.</div>
      )}
      {data !== null && data.map(pg => (
        <div className="aspirasi-item" key={pg.id}>
          <div className="aspirasi-meta">
            <b>
              <span className={'peng-tag-mini ' + pg.kategori}>{LABEL_KAT[pg.kategori] || pg.kategori}</span>
              {pg.judul}
            </b>
            <span>{fmtWaktu(pg.waktu)}</span>
          </div>
          <div className="aspirasi-pesan">{pg.isi}</div>
          {metaAcara(pg) && <div className="aspirasi-kontak">{metaAcara(pg)}</div>}
          <div className="baris-hapus">
            <button className="btn-hapus" onClick={() => hapus(pg.id)}>Hapus</button>
          </div>
        </div>
      ))}
    </div>
  )
}
