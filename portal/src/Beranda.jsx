import { useEffect, useState } from 'react'
import { apiGet, fmtWaktu } from './api.js'

const fmtRp = n => 'Rp' + (Number(n) || 0).toLocaleString('id-ID')
const bulanKini = () => new Date().toISOString().slice(0, 7)
const fmtBulan = b => new Date(b + '-01T00:00:00')
  .toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

const LABEL_JENIS = {
  pengantar: 'Pengantar Umum', domisili: 'Ket. Domisili', usaha: 'Ket. Usaha',
  'tidak-mampu': 'Ket. Tidak Mampu', lainnya: 'Lainnya',
}

export default function Beranda({ sesi, onSesiBerakhir, onBuka }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    let batal = false
    async function muat() {
      const [a, s, p] = await Promise.all([
        apiGet({ daftar: 'aspirasi', token: sesi.token }).catch(() => null),
        apiGet({ daftar: 'surat', token: sesi.token }).catch(() => null),
        apiGet({ daftar: 'pamsimas', token: sesi.token }).catch(() => null),
      ])
      if (batal) return
      if ([a, s, p].some(x => x?.butuhLogin)) { onSesiBerakhir(); return }
      setData({
        aspirasi: a?.ok && Array.isArray(a.data) ? a.data : null,
        surat: s?.ok && Array.isArray(s.data) ? s.data : null,
        pam: p?.ok && Array.isArray(p.kas) ? { pelanggan: p.pelanggan || [], kas: p.kas } : null,
      })
    }
    muat()
    return () => { batal = true }
  }, [sesi.token, onSesiBerakhir])

  if (!data) {
    return <div className="kartu"><h2>🏠 Beranda</h2><div className="kosong">Memuat ringkasan…</div></div>
  }

  const bln = bulanKini()
  const aspBaru = (data.aspirasi || []).filter(x => x.status === 'baru')
  const surBaru = (data.surat || []).filter(x => x.status === 'baru')
  const saldo = data.pam
    ? data.pam.kas.reduce((t, k) => t + (k.jenis === 'keluar' ? -k.jumlah : k.jumlah), 0)
    : null
  const pembayar = data.pam
    ? new Set(data.pam.kas.filter(k => k.jenis === 'masuk' && k.pelanggan && k.bulan === bln)
        .map(k => k.pelanggan)).size
    : null
  const pelangganAktif = data.pam ? data.pam.pelanggan.filter(pl => pl.aktif).length : null

  return (
    <div className="kartu">
      <div className="bar-atas">
        <h2>🏠 Beranda</h2>
        <span className="keterangan-kartu" style={{ margin: 0 }}>
          Ringkasan {fmtBulan(bln)}
        </span>
      </div>

      <div className="ringkas-grid ringkas-4">
        <button className="ringkas-item ringkas-klik" onClick={() => onBuka('aspirasi')}>
          <div className="ringkas-nilai">{data.aspirasi ? aspBaru.length : '—'}</div>
          <div className="ringkas-label">Aspirasi baru</div>
        </button>
        <button className="ringkas-item ringkas-klik" onClick={() => onBuka('surat')}>
          <div className="ringkas-nilai">{data.surat ? surBaru.length : '—'}</div>
          <div className="ringkas-label">Permohonan surat baru</div>
        </button>
        {data.pam && (
          <>
            <button className="ringkas-item ringkas-klik" onClick={() => onBuka('pamsimas')}>
              <div className="ringkas-nilai">{fmtRp(saldo)}</div>
              <div className="ringkas-label">Saldo kas Pamsimas</div>
            </button>
            <button className="ringkas-item ringkas-klik" onClick={() => onBuka('pamsimas')}>
              <div className="ringkas-nilai">{pembayar} / {pelangganAktif}</div>
              <div className="ringkas-label">Pelanggan sudah bayar</div>
            </button>
          </>
        )}
      </div>

      {data.surat && surBaru.length > 0 && (
        <>
          <div className="sub-judul">📄 Surat menunggu diproses</div>
          {surBaru.slice(0, 5).map(s => (
            <div className="aspirasi-item" key={s.id}>
              <div className="aspirasi-meta">
                <b><span className="peng-tag-mini">{LABEL_JENIS[s.jenis] || s.jenis}</span>{s.nama}</b>
                <span>{fmtWaktu(s.waktu)}</span>
              </div>
              {s.keperluan && <div className="aspirasi-pesan">{s.keperluan}</div>}
            </div>
          ))}
        </>
      )}

      {data.aspirasi && aspBaru.length > 0 && (
        <>
          <div className="sub-judul">💬 Aspirasi belum ditindaklanjuti</div>
          {aspBaru.slice(0, 5).map((a, i) => (
            <div className="aspirasi-item" key={i}>
              <div className="aspirasi-meta">
                <b>{a.nama}</b>
                <span>{fmtWaktu(a.waktu)}</span>
              </div>
              <div className="aspirasi-pesan">{a.pesan}</div>
            </div>
          ))}
        </>
      )}

      {data.surat && data.aspirasi && surBaru.length === 0 && aspBaru.length === 0 && (
        <div className="kosong">Tidak ada pekerjaan menunggu — semua sudah tertangani. 👍</div>
      )}
    </div>
  )
}
