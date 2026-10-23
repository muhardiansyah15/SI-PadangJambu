import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPost, fmtWaktu } from './api.js'

const fmtRp = n => 'Rp' + (Number(n) || 0).toLocaleString('id-ID')
const bulanKini = () => new Date().toISOString().slice(0, 7)
const fmtBulan = b => /^\d{4}-\d{2}$/.test(b)
  ? new Date(b + '-01T00:00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  : (b || '—')
const bulanDariWaktu = iso => (iso || '').slice(0, 7)

export default function Pamsimas({ sesi, onSesiBerakhir }) {
  const su = sesi.peran === 'pemilik'
  const az = (sesi.akses && sesi.akses.pamsimas) || {}
  const bolehC = su || !!az.c
  const bolehW = su || !!az.w
  const bolehU = su || !!az.u
  const adaAksi = bolehW || bolehU

  const [pelanggan, setPelanggan] = useState(null)
  const [kas, setKas] = useState([])
  const [gagal, setGagal] = useState(false)
  const [sub, setSub] = useState('rekap')
  const [bulan, setBulan] = useState(bulanKini())
  const [sibuk, setSibuk] = useState(false)
  const [status, setStatus] = useState(null)
  // filter buku kas
  const [fltPelanggan, setFltPelanggan] = useState('semua')
  const [fltBulan, setFltBulan] = useState('')
  // form iuran
  const [fIuran, setFIuran] = useState({ pelanggan: '', jumlah: '', keterangan: '' })
  const [formIuran, setFormIuran] = useState(false)
  // form pengeluaran
  const [fKeluar, setFKeluar] = useState({ uraian: '', jumlah: '' })
  const [formKeluar, setFormKeluar] = useState(false)
  // form saldo awal
  const [fSaldo, setFSaldo] = useState('')
  const [formSaldo, setFormSaldo] = useState(false)
  // form edit kas
  const [editKas, setEditKas] = useState(null) // baris kas yang diedit
  const [fEdit, setFEdit] = useState({ pelanggan: '', bulan: '', jumlah: '', keterangan: '' })
  // form pelanggan (tambah / edit)
  const [fPel, setFPel] = useState({ nama: '', rw: '' })
  const [formPel, setFormPel] = useState(false)
  const [editPel, setEditPel] = useState(null)

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

  const kasTersaring = kas.filter(k => {
    if (fltPelanggan !== 'semua' && !(k.jenis === 'masuk' && k.pelanggan === fltPelanggan)) return false
    if (fltBulan) {
      const b = k.jenis === 'masuk' ? k.bulan : bulanDariWaktu(k.waktu)
      if (b !== fltBulan) return false
    }
    return true
  })

  function mulaiEditKas(k) {
    setEditKas(k)
    setFEdit({
      pelanggan: k.pelanggan || '',
      bulan: /^\d{4}-\d{2}$/.test(k.bulan) ? k.bulan : bulanKini(),
      jumlah: String(k.jumlah),
      keterangan: k.uraian || '',
    })
    setStatus(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const formAktif = formIuran || formKeluar || formSaldo || !!editKas

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
            onClick={() => { setSub(id); setStatus(null); setEditKas(null) }}>
            {label}
          </button>
        ))}
      </div>

      {status && <div className={'status ' + (status.ok ? 'ok' : 'gagal')}>{status.teks}</div>}
      {pelanggan === null && <div className="kosong">Memuat…</div>}
      {pelanggan !== null && gagal && <div className="kosong">Gagal memuat. Coba muat ulang.</div>}

      {/* ===== FORM EDIT KAS ===== */}
      {editKas && (
        <form onSubmit={ev => {
          ev.preventDefault()
          kirim({ aksi: 'pam-kas-edit', id: editKas.id, ...fEdit }, () => {
            setEditKas(null)
            setStatus({ ok: true, teks: 'Catatan diperbarui. ✅' })
          })
        }}>
          <div className="sub-judul">
            Edit {editKas.jenis === 'masuk' ? 'Iuran' : editKas.jenis === 'keluar' ? 'Pengeluaran' : 'Saldo Awal'}
          </div>
          {editKas.jenis === 'masuk' && (
            <div className="form-baris">
              <div className="form-group">
                <label className="form-label">Pelanggan</label>
                <select className="form-input" value={fEdit.pelanggan}
                  onChange={e => setFEdit(f => ({ ...f, pelanggan: e.target.value }))}>
                  {(pelanggan || []).map(pl => (
                    <option key={pl.id} value={pl.id}>{pl.nama}{pl.rw ? ` (${pl.rw})` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Bulan</label>
                <input type="month" className="form-input" value={fEdit.bulan}
                  onChange={e => setFEdit(f => ({ ...f, bulan: e.target.value }))} />
              </div>
            </div>
          )}
          <div className="form-baris">
            <div className="form-group">
              <label className="form-label">Jumlah (Rp)</label>
              <input type="number" min="1" className="form-input" required value={fEdit.jumlah}
                onChange={e => setFEdit(f => ({ ...f, jumlah: e.target.value }))} />
            </div>
            {editKas.jenis !== 'saldo' && (
              <div className="form-group">
                <label className="form-label">{editKas.jenis === 'keluar' ? 'Uraian' : 'Keterangan (opsional)'}</label>
                <input className="form-input" maxLength={200} required={editKas.jenis === 'keluar'}
                  value={fEdit.keterangan}
                  onChange={e => setFEdit(f => ({ ...f, keterangan: e.target.value }))} />
              </div>
            )}
          </div>
          <button className="btn" type="submit" disabled={sibuk}>
            {sibuk ? 'Menyimpan…' : 'Simpan Perubahan ✏️'}
          </button>
          <button type="button" className="btn btn-polos" style={{ marginTop: '0.6rem' }}
            onClick={() => setEditKas(null)}>Batal</button>
        </form>
      )}

      {/* ===== REKAP IURAN ===== */}
      {pelanggan !== null && !gagal && sub === 'rekap' && !editKas && (
        <>
          <div className="bar-atas">
            <input type="month" className="form-input pilih-status" value={bulan}
              onChange={e => setBulan(e.target.value || bulanKini())} />
            {!formIuran && bolehC && (
              <button className="btn btn-kecil" onClick={() => { setFormIuran(true); setStatus(null) }}>
                + Catat Iuran
              </button>
            )}
          </div>
          {formIuran && (
            <form onSubmit={ev => {
              ev.preventDefault()
              kirim({ aksi: 'pam-iuran', bulan, ...fIuran }, () => {
                setFIuran({ pelanggan: '', jumlah: '', keterangan: '' })
                setFormIuran(false)
                setStatus({ ok: true, teks: 'Iuran tercatat. ✅' })
              })
            }}>
              <div className="form-baris">
                <div className="form-group">
                  <label className="form-label">Pelanggan</label>
                  <select className="form-input" required value={fIuran.pelanggan}
                    onChange={e => setFIuran(f => ({ ...f, pelanggan: e.target.value }))}>
                    <option value="">— pilih pelanggan —</option>
                    {aktif.map(pl => (
                      <option key={pl.id} value={pl.id} disabled={sudahBayar.has(pl.id)}>
                        {pl.nama}{pl.rw ? ` (${pl.rw})` : ''}{sudahBayar.has(pl.id) ? ' — sudah bayar' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Jumlah (Rp) — {fmtBulan(bulan)}</label>
                  <input type="number" min="1" className="form-input" required value={fIuran.jumlah}
                    onChange={e => setFIuran(f => ({ ...f, jumlah: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Keterangan (opsional)</label>
                <input className="form-input" maxLength={200} placeholder="mis. dibayar lewat transfer"
                  value={fIuran.keterangan}
                  onChange={e => setFIuran(f => ({ ...f, keterangan: e.target.value }))} />
              </div>
              <button className="btn" type="submit" disabled={sibuk}>
                {sibuk ? 'Menyimpan…' : 'Simpan Iuran 💧'}
              </button>
              <button type="button" className="btn btn-polos" style={{ marginTop: '0.6rem' }}
                onClick={() => setFormIuran(false)}>Batal</button>
            </form>
          )}
          {!formIuran && (
            <div className="tabel-gulir">
              <table className="tabel-kas">
                <thead><tr><th>Pelanggan</th><th>RW</th><th>Status</th><th>Jumlah</th><th>Keterangan</th></tr></thead>
                <tbody>
                  {aktif.length === 0 && <tr><td colSpan="5" className="kosong">Belum ada pelanggan.</td></tr>}
                  {aktif.map(pl => {
                    const bayar = masukBulan.find(k => k.pelanggan === pl.id)
                    return (
                      <tr key={pl.id}>
                        <td>{pl.nama}</td>
                        <td>{pl.rw || '—'}</td>
                        <td><span className={'status-tag ' + (bayar ? 'selesai' : 'baru')}>{bayar ? 'Lunas' : 'Belum'}</span></td>
                        <td>{bayar ? fmtRp(bayar.jumlah) : '—'}</td>
                        <td>{bayar?.uraian || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ===== BUKU KAS ===== */}
      {pelanggan !== null && !gagal && sub === 'kas' && !editKas && (
        <>
          {!formKeluar && !formSaldo && (
            <div className="bar-atas">
              <div className="aksi">
                <select className="form-input pilih-status" value={fltPelanggan}
                  onChange={e => setFltPelanggan(e.target.value)}>
                  <option value="semua">Semua pelanggan</option>
                  {(pelanggan || []).map(pl => <option key={pl.id} value={pl.id}>{pl.nama}</option>)}
                </select>
                <input type="month" className="form-input pilih-status" value={fltBulan}
                  onChange={e => setFltBulan(e.target.value)} title="Saring bulan (kosongkan = semua)" />
              </div>
              <div className="aksi">
                {!adaSaldoAwal && bolehC && (
                  <button className="btn btn-kecil btn-polos" onClick={() => { setFormSaldo(true); setStatus(null) }}>
                    + Saldo Awal
                  </button>
                )}
                {bolehC && (
                  <button className="btn btn-kecil" onClick={() => { setFormKeluar(true); setStatus(null) }}>
                    + Catat Pengeluaran
                  </button>
                )}
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
                <label className="form-label">Saldo awal pembukuan (Rp) — pindahan dari buku lama</label>
                <input type="number" min="1" className="form-input" required
                  value={fSaldo} onChange={e => setFSaldo(e.target.value)} />
              </div>
              <button className="btn" type="submit" disabled={sibuk}>{sibuk ? 'Menyimpan…' : 'Catat Saldo Awal 💰'}</button>
              <button type="button" className="btn btn-polos" style={{ marginTop: '0.6rem' }}
                onClick={() => setFormSaldo(false)}>Batal</button>
            </form>
          )}
          {formKeluar && (
            <form onSubmit={ev => {
              ev.preventDefault()
              kirim({ aksi: 'pam-keluar', ...fKeluar }, () => {
                setFKeluar({ uraian: '', jumlah: '' }); setFormKeluar(false)
                setStatus({ ok: true, teks: 'Pengeluaran tercatat. ✅' })
              })
            }}>
              <div className="form-baris">
                <div className="form-group">
                  <label className="form-label">Uraian pengeluaran</label>
                  <input className="form-input" required maxLength={200}
                    placeholder="mis. Tagihan listrik pompa air Oktober"
                    value={fKeluar.uraian} onChange={e => setFKeluar(f => ({ ...f, uraian: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Jumlah (Rp)</label>
                  <input type="number" min="1" className="form-input" required
                    value={fKeluar.jumlah} onChange={e => setFKeluar(f => ({ ...f, jumlah: e.target.value }))} />
                </div>
              </div>
              <button className="btn" type="submit" disabled={sibuk}>{sibuk ? 'Menyimpan…' : 'Simpan Pengeluaran 🧾'}</button>
              <button type="button" className="btn btn-polos" style={{ marginTop: '0.6rem' }}
                onClick={() => setFormKeluar(false)}>Batal</button>
            </form>
          )}
          {!formKeluar && !formSaldo && (
            <div className="tabel-gulir">
              <table className="tabel-kas">
                <thead><tr><th>Tanggal</th><th>Jenis</th><th>Uraian</th><th>Bulan Iuran</th><th>Jumlah</th>{adaAksi && <th>Aksi</th>}</tr></thead>
                <tbody>
                  {kasTersaring.length === 0 && (
                    <tr><td colSpan={adaAksi ? 6 : 5} className="kosong">Tidak ada catatan sesuai filter.</td></tr>
                  )}
                  {kasTersaring.map(k => (
                    <tr key={k.id}>
                      <td>{fmtWaktu(k.waktu)}</td>
                      <td>
                        <span className={'status-tag ' + (k.jenis === 'keluar' ? 'baru' : k.jenis === 'saldo' ? 'diproses' : 'selesai')}>
                          {k.jenis === 'keluar' ? 'Keluar' : k.jenis === 'saldo' ? 'Saldo Awal' : 'Masuk'}
                        </span>
                      </td>
                      <td>
                        {k.jenis === 'masuk'
                          ? <>Iuran {namaPelanggan(k.pelanggan)}{k.uraian ? <span className="ket-kecil"> — {k.uraian}</span> : ''}</>
                          : k.uraian}
                      </td>
                      <td>{k.jenis === 'masuk' ? fmtBulan(k.bulan) : '—'}</td>
                      <td className={k.jenis === 'keluar' ? 'rp-keluar' : 'rp-masuk'}>
                        {(k.jenis === 'keluar' ? '−' : '+') + fmtRp(k.jumlah)}
                      </td>
                      {adaAksi && (
                        <td className="sel-aksi">
                          {bolehW && <><button className="btn btn-kecil btn-polos" onClick={() => mulaiEditKas(k)}>Edit</button>{' '}</>}
                          {bolehU && (
                            <button className="btn-hapus"
                              onClick={() => confirm('Hapus catatan kas ini?') && kirim({ aksi: 'pam-hapus', id: k.id })}>
                              Hapus
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ===== PELANGGAN ===== */}
      {pelanggan !== null && !gagal && sub === 'pelanggan' && !editKas && (
        <>
          {!formPel && (
            <div className="bar-atas">
              <div className="sub-judul" style={{ margin: 0 }}>Daftar Pelanggan</div>
              {bolehC && (
                <button className="btn btn-kecil" onClick={() => { setFormPel(true); setStatus(null) }}>
                  + Tambah Pelanggan
                </button>
              )}
            </div>
          )}
          {formPel && (
            <form onSubmit={ev => {
              ev.preventDefault()
              const payload = editPel
                ? { aksi: 'pam-pelanggan-edit', id: editPel.id, aktif: editPel.aktif, ...fPel }
                : { aksi: 'pam-pelanggan', ...fPel }
              kirim(payload, () => {
                setFPel({ nama: '', rw: '' }); setFormPel(false); setEditPel(null)
                setStatus({ ok: true, teks: editPel ? 'Pelanggan diperbarui. ✅' : 'Pelanggan ditambahkan. ✅' })
              })
            }}>
              <div className="form-baris">
                <div className="form-group">
                  <label className="form-label">Nama kepala keluarga</label>
                  <input className="form-input" required maxLength={80}
                    value={fPel.nama} onChange={e => setFPel(f => ({ ...f, nama: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">RW / wilayah (opsional)</label>
                  <input className="form-input" maxLength={20}
                    value={fPel.rw} onChange={e => setFPel(f => ({ ...f, rw: e.target.value }))} />
                </div>
              </div>
              <button className="btn" type="submit" disabled={sibuk}>
                {sibuk ? 'Menyimpan…' : editPel ? 'Simpan Perubahan ✏️' : 'Tambah Pelanggan 👥'}
              </button>
              <button type="button" className="btn btn-polos" style={{ marginTop: '0.6rem' }}
                onClick={() => { setFormPel(false); setEditPel(null) }}>Batal</button>
            </form>
          )}
          {!formPel && (
            <div className="tabel-gulir">
              <table className="tabel-kas">
                <thead><tr><th>Nama</th><th>RW</th><th>Status</th>{adaAksi && <th>Aksi</th>}</tr></thead>
                <tbody>
                  {(pelanggan || []).length === 0 && <tr><td colSpan={adaAksi ? 4 : 3} className="kosong">Belum ada pelanggan.</td></tr>}
                  {(pelanggan || []).map(pl => (
                    <tr key={pl.id}>
                      <td>{pl.nama}</td>
                      <td>{pl.rw || '—'}</td>
                      <td><span className={'status-tag ' + (pl.aktif ? 'selesai' : 'diproses')}>{pl.aktif ? 'Aktif' : 'Nonaktif'}</span></td>
                      {adaAksi && (
                        <td className="sel-aksi">
                          {bolehW && <><button className="btn btn-kecil btn-polos"
                            onClick={() => {
                              setEditPel(pl)
                              setFPel({ nama: pl.nama, rw: pl.rw })
                              setFormPel(true)
                              setStatus(null)
                            }}>
                            Edit ✏️
                          </button>{' '}
                          <button className="btn btn-kecil btn-polos"
                            onClick={() => kirim({ aksi: 'pam-pelanggan-edit', id: pl.id, nama: pl.nama, rw: pl.rw, aktif: !pl.aktif })}>
                            {pl.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>{' '}</>}
                          {bolehU && (
                            <button className="btn-hapus"
                              onClick={() => confirm(`Hapus pelanggan "${pl.nama}"?`) && kirim({ aksi: 'pam-pelanggan-hapus', id: pl.id })}>
                              Hapus
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
