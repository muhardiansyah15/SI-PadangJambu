import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPost, fmtWaktu } from './api.js'

const fmtRp = n => 'Rp' + (Number(n) || 0).toLocaleString('id-ID')
const bulanKini = () => new Date().toISOString().slice(0, 7)
const fmtBulan = b => {
  if (!/^\d{4}-\d{2}$/.test(b)) return b
  return new Date(b + '-01T00:00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

export default function Pamsimas({ sesi, onSesiBerakhir }) {
  const [pelanggan, setPelanggan] = useState(null)
  const [kas, setKas] = useState([])
  const [gagal, setGagal] = useState(false)
  const [sub, setSub] = useState('rekap')
  const [bulan, setBulan] = useState(bulanKini())
  const [sibuk, setSibuk] = useState(false)
  const [status, setStatus] = useState(null)
  // form iuran
  const [fPelanggan, setFPelanggan] = useState('')
  const [fJumlah, setFJumlah] = useState('')
  const [formIuran, setFormIuran] = useState(false)
  // form pengeluaran
  const [fUraian, setFUraian] = useState('')
  const [fKeluar, setFKeluar] = useState('')
  const [formKeluar, setFormKeluar] = useState(false)
  // form saldo awal
  const [fSaldo, setFSaldo] = useState('')
  const [formSaldo, setFormSaldo] = useState(false)
  // form pelanggan
  const [fNamaP, setFNamaP] = useState('')
  const [fRw, setFRw] = useState('')
  const [formPelanggan, setFormPelanggan] = useState(false)

  const muat = useCallback(async () => {
    setPelanggan(null)
    setGagal(false)
    try {
      const j = await apiGet({ daftar: 'pamsimas', token: sesi.token })
      if (j.butuhLogin) { onSesiBerakhir(); return }
      if (!j.ok || !Array.isArray(j.pelanggan)) throw new Error()
      setPelanggan(j.pelanggan)
      setKas(j.kas || [])
    } catch {
      setGagal(true)
      setPelanggan([])
    }
  }, [sesi.token, onSesiBerakhir])

  useEffect(() => { muat() }, [muat])

  async function kirim(payload, sesudah) {
    setSibuk(true)
    setStatus(null)
    try {
      const j = await apiPost({ token: sesi.token, ...payload })
      if (j.butuhLogin) { onSesiBerakhir(); return }
      if (!j.ok) { setStatus({ ok: false, teks: j.pesan || 'Gagal menyimpan.' }); return }
      sesudah?.()
      muat()
    } catch {
      setStatus({ ok: false, teks: 'Gagal terhubung. Periksa koneksi internet.' })
    } finally {
      setSibuk(false)
    }
  }

  const aktif = (pelanggan || []).filter(pl => pl.aktif)
  const namaPelanggan = id => (pelanggan || []).find(pl => pl.id === id)?.nama || '(terhapus)'
  const masukBulan = kas.filter(k => k.jenis === 'masuk' && k.bulan === bulan)
  const sudahBayar = new Set(masukBulan.map(k => k.pelanggan))
  const totalMasukBulan = masukBulan.reduce((a, k) => a + k.jumlah, 0)
  const saldo = kas.reduce((a, k) => a + (k.jenis === 'keluar' ? -k.jumlah : k.jumlah), 0)
  const adaSaldoAwal = kas.some(k => k.jenis === 'saldo')

  return (
    <div className="kartu">
      <div className="bar-atas">
        <h2>💧 Pamsimas — Kas KPSPAMS</h2>
        <button className="btn btn-kecil btn-polos" onClick={muat}>Muat Ulang ↻</button>
      </div>

      <div className="ringkas-grid">
        <div className="ringkas-item">
          <div className="ringkas-nilai">{fmtRp(saldo)}</div>
          <div className="ringkas-label">Saldo kas</div>
        </div>
        <div className="ringkas-item">
          <div className="ringkas-nilai">{fmtRp(totalMasukBulan)}</div>
          <div className="ringkas-label">Iuran {fmtBulan(bulan)}</div>
        </div>
        <div className="ringkas-item">
          <div className="ringkas-nilai">{sudahBayar.size} / {aktif.length}</div>
          <div className="ringkas-label">Pelanggan sudah bayar</div>
        </div>
      </div>

      <div className="saring-status">
        {[['rekap', 'Rekap Iuran'], ['kas', 'Buku Kas'], ['pelanggan', 'Pelanggan']].map(([id, label]) => (
          <button key={id} className={'menu-item saring' + (sub === id ? ' aktif' : '')}
            onClick={() => { setSub(id); setStatus(null) }}>
            {label}
          </button>
        ))}
      </div>

      {status && <div className={'status ' + (status.ok ? 'ok' : 'gagal')}>{status.teks}</div>}
      {pelanggan === null && <div className="kosong">Memuat…</div>}
      {pelanggan !== null && gagal && <div className="kosong">Gagal memuat. Coba muat ulang.</div>}

      {pelanggan !== null && !gagal && sub === 'rekap' && (
        <>
          <div className="bar-atas">
            <input type="month" className="form-input pilih-status" value={bulan}
              onChange={e => setBulan(e.target.value || bulanKini())} />
            {!formIuran && (
              <button className="btn btn-kecil" onClick={() => { setFormIuran(true); setStatus(null) }}>
                + Catat Iuran
              </button>
            )}
          </div>
          {formIuran && (
            <form onSubmit={ev => {
              ev.preventDefault()
              kirim({ aksi: 'pam-iuran', pelanggan: fPelanggan, bulan, jumlah: fJumlah }, () => {
                setFPelanggan(''); setFJumlah(''); setFormIuran(false)
                setStatus({ ok: true, teks: 'Iuran tercatat. ✅' })
              })
            }}>
              <div className="form-baris">
                <div className="form-group">
                  <label className="form-label">Pelanggan</label>
                  <select className="form-input" required value={fPelanggan}
                    onChange={e => setFPelanggan(e.target.value)}>
                    <option value="">— pilih pelanggan —</option>
                    {aktif.map(pl => (
                      <option key={pl.id} value={pl.id} disabled={sudahBayar.has(pl.id)}>
                        {pl.nama}{pl.rw ? ` (${pl.rw})` : ''}{sudahBayar.has(pl.id) ? ' — sudah bayar' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Jumlah (Rp) — bulan {fmtBulan(bulan)}</label>
                  <input type="number" min="1" className="form-input" required
                    value={fJumlah} onChange={e => setFJumlah(e.target.value)} />
                </div>
              </div>
              <button className="btn" type="submit" disabled={sibuk}>
                {sibuk ? 'Menyimpan…' : 'Simpan Iuran 💧'}
              </button>
              <button type="button" className="btn btn-polos" style={{ marginTop: '0.6rem' }}
                onClick={() => setFormIuran(false)}>Batal</button>
            </form>
          )}
          {!formIuran && aktif.length === 0 && (
            <div className="kosong">Belum ada pelanggan. Tambahkan dulu di tab Pelanggan.</div>
          )}
          {!formIuran && aktif.map(pl => {
            const bayar = masukBulan.find(k => k.pelanggan === pl.id)
            return (
              <div className="aspirasi-item" key={pl.id}>
                <div className="aspirasi-meta">
                  <b>
                    <span className={'status-tag ' + (bayar ? 'selesai' : 'baru')}>
                      {bayar ? 'Lunas' : 'Belum'}
                    </span>
                    {pl.nama}{pl.rw ? ` · ${pl.rw}` : ''}
                  </b>
                  <span>{bayar ? fmtRp(bayar.jumlah) : '—'}</span>
                </div>
              </div>
            )
          })}
        </>
      )}

      {pelanggan !== null && !gagal && sub === 'kas' && (
        <>
          {!formKeluar && !formSaldo && (
            <div className="bar-atas">
              <div className="sub-judul" style={{ margin: 0 }}>Riwayat Kas</div>
              <div className="aksi">
                {!adaSaldoAwal && (
                  <button className="btn btn-kecil btn-polos" onClick={() => { setFormSaldo(true); setStatus(null) }}>
                    + Saldo Awal
                  </button>
                )}
                <button className="btn btn-kecil" onClick={() => { setFormKeluar(true); setStatus(null) }}>
                  + Catat Pengeluaran
                </button>
              </div>
            </div>
          )}
          {formSaldo && (
            <form onSubmit={ev => {
              ev.preventDefault()
              kirim({ aksi: 'pam-saldo', jumlah: fSaldo }, () => {
                setFSaldo(''); setFormSaldo(false)
                setStatus({ ok: true, teks: 'Saldo awal tercatat. ✅' })
              })
            }}>
              <div className="form-group">
                <label className="form-label">
                  Saldo awal pembukuan (Rp) — total kas yang dipindahkan dari buku lama
                </label>
                <input type="number" min="1" className="form-input" required
                  value={fSaldo} onChange={e => setFSaldo(e.target.value)} />
              </div>
              <button className="btn" type="submit" disabled={sibuk}>
                {sibuk ? 'Menyimpan…' : 'Catat Saldo Awal 💰'}
              </button>
              <button type="button" className="btn btn-polos" style={{ marginTop: '0.6rem' }}
                onClick={() => setFormSaldo(false)}>Batal</button>
            </form>
          )}
          {formKeluar && (
            <form onSubmit={ev => {
              ev.preventDefault()
              kirim({ aksi: 'pam-keluar', uraian: fUraian, jumlah: fKeluar }, () => {
                setFUraian(''); setFKeluar(''); setFormKeluar(false)
                setStatus({ ok: true, teks: 'Pengeluaran tercatat. ✅' })
              })
            }}>
              <div className="form-group">
                <label className="form-label">Uraian pengeluaran</label>
                <input className="form-input" required maxLength={200}
                  placeholder="mis. Tagihan listrik pompa air Oktober"
                  value={fUraian} onChange={e => setFUraian(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Jumlah (Rp)</label>
                <input type="number" min="1" className="form-input" required
                  value={fKeluar} onChange={e => setFKeluar(e.target.value)} />
              </div>
              <button className="btn" type="submit" disabled={sibuk}>
                {sibuk ? 'Menyimpan…' : 'Simpan Pengeluaran 🧾'}
              </button>
              <button type="button" className="btn btn-polos" style={{ marginTop: '0.6rem' }}
                onClick={() => setFormKeluar(false)}>Batal</button>
            </form>
          )}
          {!formKeluar && !formSaldo && kas.length === 0 && <div className="kosong">Buku kas masih kosong.</div>}
          {!formKeluar && !formSaldo && kas.map(k => (
            <div className="aspirasi-item" key={k.id}>
              <div className="aspirasi-meta">
                <b>
                  <span className={'status-tag ' + (k.jenis === 'keluar' ? 'baru' : k.jenis === 'saldo' ? 'diproses' : 'selesai')}>
                    {k.jenis === 'keluar' ? 'Keluar' : k.jenis === 'saldo' ? 'Saldo Awal' : 'Masuk'}
                  </span>
                  {k.jenis === 'masuk'
                    ? `Iuran ${namaPelanggan(k.pelanggan)} — ${fmtBulan(k.bulan)}`
                    : k.uraian}
                </b>
                <span>{(k.jenis === 'keluar' ? '−' : '+') + fmtRp(k.jumlah)}</span>
              </div>
              <div className="aspirasi-kontak">{fmtWaktu(k.waktu)}</div>
              <div className="baris-hapus">
                <button className="btn-hapus"
                  onClick={() => confirm('Hapus catatan kas ini?') && kirim({ aksi: 'pam-hapus', id: k.id })}>
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {pelanggan !== null && !gagal && sub === 'pelanggan' && (
        <>
          {!formPelanggan && (
            <div className="bar-atas">
              <div className="sub-judul" style={{ margin: 0 }}>Daftar Pelanggan</div>
              <button className="btn btn-kecil" onClick={() => { setFormPelanggan(true); setStatus(null) }}>
                + Tambah Pelanggan
              </button>
            </div>
          )}
          {formPelanggan && (
            <form onSubmit={ev => {
              ev.preventDefault()
              kirim({ aksi: 'pam-pelanggan', nama: fNamaP, rw: fRw }, () => {
                setFNamaP(''); setFRw(''); setFormPelanggan(false)
                setStatus({ ok: true, teks: 'Pelanggan ditambahkan. ✅' })
              })
            }}>
              <div className="form-baris">
                <div className="form-group">
                  <label className="form-label">Nama kepala keluarga</label>
                  <input className="form-input" required maxLength={80}
                    value={fNamaP} onChange={e => setFNamaP(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">RW / wilayah (opsional)</label>
                  <input className="form-input" maxLength={20}
                    value={fRw} onChange={e => setFRw(e.target.value)} />
                </div>
              </div>
              <button className="btn" type="submit" disabled={sibuk}>
                {sibuk ? 'Menyimpan…' : 'Tambah Pelanggan 👥'}
              </button>
              <button type="button" className="btn btn-polos" style={{ marginTop: '0.6rem' }}
                onClick={() => setFormPelanggan(false)}>Batal</button>
            </form>
          )}
          {!formPelanggan && (pelanggan || []).map(pl => (
            <div className="aspirasi-item" key={pl.id}>
              <div className="aspirasi-meta">
                <b>
                  <span className={'status-tag ' + (pl.aktif ? 'selesai' : 'diproses')}>
                    {pl.aktif ? 'Aktif' : 'Nonaktif'}
                  </span>
                  {pl.nama}{pl.rw ? ` · ${pl.rw}` : ''}
                </b>
              </div>
              <div className="baris-hapus">
                <button className="btn btn-kecil btn-polos"
                  onClick={() => kirim({ aksi: 'pam-pelanggan-edit', id: pl.id, nama: pl.nama, rw: pl.rw, aktif: !pl.aktif })}>
                  {pl.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                </button>{' '}
                <button className="btn-hapus"
                  onClick={() => confirm(`Hapus pelanggan "${pl.nama}"?`) && kirim({ aksi: 'pam-pelanggan-hapus', id: pl.id })}>
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
