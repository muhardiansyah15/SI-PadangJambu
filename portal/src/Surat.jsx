import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPost, fmtWaktu, linkWA } from './api.js'

const LABEL_JENIS = {
  pengantar: 'Pengantar Umum',
  domisili: 'Ket. Domisili',
  usaha: 'Ket. Usaha',
  'tidak-mampu': 'Ket. Tidak Mampu',
  lainnya: 'Lainnya',
}
const LABEL_STATUS = { baru: 'Baru', diproses: 'Diproses', selesai: 'Selesai' }

export default function Surat({ sesi, onSesiBerakhir }) {
  const [data, setData] = useState(null)
  const [gagal, setGagal] = useState(false)
  const [saring, setSaring] = useState('semua')

  const muat = useCallback(async () => {
    setData(null)
    setGagal(false)
    try {
      const j = await apiGet({ daftar: 'surat', token: sesi.token })
      if (j.butuhLogin) { onSesiBerakhir(); return }
      if (!j.ok || !Array.isArray(j.data)) throw new Error()
      setData(j.data)
    } catch {
      setGagal(true)
      setData([])
    }
  }, [sesi.token, onSesiBerakhir])

  useEffect(() => { muat() }, [muat])

  async function ubahStatus(id, status) {
    try {
      const j = await apiPost({ aksi: 'surat-status', token: sesi.token, id, status })
      if (j.butuhLogin) { onSesiBerakhir(); return }
      if (!j.ok && j.pesan) alert(j.pesan)
      muat()
    } catch {
      alert('Gagal menyimpan status. Periksa koneksi internet.')
    }
  }

  async function hapus(id) {
    if (!confirm('Hapus permohonan surat ini?')) return
    try {
      const j = await apiPost({ aksi: 'surat-hapus', token: sesi.token, id })
      if (j.butuhLogin) { onSesiBerakhir(); return }
      muat()
    } catch {
      alert('Gagal menghapus. Periksa koneksi internet.')
    }
  }

  const tampil = (data || []).filter(s => saring === 'semua' || s.status === saring)
  const jumlah = st => (data || []).filter(s => s.status === st).length

  return (
    <div className="kartu">
      <div className="bar-atas">
        <h2>Permohonan Surat</h2>
        <button className="btn btn-kecil btn-polos" onClick={muat}>Muat Ulang ↻</button>
      </div>
      <p className="keterangan-kartu">
        Permohonan masuk dari form Layanan di website. Hubungi pemohon lewat
        kontaknya, lalu perbarui statusnya di sini.
      </p>

      <div className="saring-status">
        {['semua', 'baru', 'diproses', 'selesai'].map(st => (
          <button key={st}
            className={'menu-item saring' + (saring === st ? ' aktif' : '')}
            onClick={() => setSaring(st)}>
            {st === 'semua' ? `Semua (${(data || []).length})` : `${LABEL_STATUS[st]} (${jumlah(st)})`}
          </button>
        ))}
      </div>

      {data === null && <div className="kosong">Memuat…</div>}
      {data !== null && gagal && <div className="kosong">Gagal memuat. Coba muat ulang.</div>}
      {data !== null && !gagal && tampil.length === 0 && (
        <div className="kosong">Tidak ada permohonan{saring !== 'semua' ? ` berstatus ${LABEL_STATUS[saring]}` : ''}.</div>
      )}
      {data !== null && tampil.map(s => (
        <div className="aspirasi-item" key={s.id}>
          <div className="aspirasi-meta">
            <b>
              <span className={'status-tag ' + s.status}>{LABEL_STATUS[s.status]}</span>
              <span className="peng-tag-mini">{LABEL_JENIS[s.jenis] || s.jenis}</span>
              {s.nama}
            </b>
            <span>{fmtWaktu(s.waktu)}</span>
          </div>
          {s.keperluan && <div className="aspirasi-pesan">{s.keperluan}</div>}
          <div className="aspirasi-kontak">📱 {s.kontak}</div>
          <div className="baris-hapus baris-status">
            {linkWA(s.kontak, '') && (
              <a className="btn-ubah" target="_blank" rel="noopener noreferrer"
                href={linkWA(s.kontak,
                  `Assalamualaikum ${s.nama}, kami dari Korong Padang Jambu. ` +
                  `Permohonan ${LABEL_JENIS[s.jenis] || s.jenis} Anda ` +
                  (s.status === 'selesai'
                    ? 'sudah SELESAI dan siap diambil. Terima kasih.'
                    : `saat ini berstatus: ${LABEL_STATUS[s.status]}.`))}>
                💬 Balas WA
              </a>
            )}
            <select className="form-input pilih-status" value={s.status}
              onChange={e => ubahStatus(s.id, e.target.value)}>
              <option value="baru">Baru</option>
              <option value="diproses">Diproses</option>
              <option value="selesai">Selesai</option>
            </select>
            <button className="btn-hapus" onClick={() => hapus(s.id)}>Hapus</button>
          </div>
        </div>
      ))}
    </div>
  )
}
