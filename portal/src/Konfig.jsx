import { useCallback, useEffect, useState } from 'react'
import {
  apiGet, apiPost, terapkanKonfig, simpanLokal,
  ASPIRASI_URL, URL_BAWAAN, CLOUDINARY,
} from './api.js'

export default function Konfig({ sesi, onSesiBerakhir }) {
  const [cloud, setCloud] = useState(CLOUDINARY.cloud)
  const [preset, setPreset] = useState(CLOUDINARY.preset)
  const [drive, setDrive] = useState('')
  const [pamPublik, setPamPublik] = useState('tidak')
  const [pddkPortal, setPddkPortal] = useState('tidak')
  const [spreadsheetUrl, setSpreadsheetUrl] = useState('')
  const [apiUrl, setApiUrl] = useState(ASPIRASI_URL)
  const [status, setStatus] = useState(null)
  const [sibuk, setSibuk] = useState(false)

  const muat = useCallback(async () => {
    try {
      const j = await apiGet({ daftar: 'konfig', token: sesi.token })
      if (j.butuhLogin) { onSesiBerakhir(); return }
      if (!j.ok) return
      terapkanKonfig(j.konfig)
      if (j.konfig.cloudinary_cloud) setCloud(j.konfig.cloudinary_cloud)
      if (j.konfig.cloudinary_preset) setPreset(j.konfig.cloudinary_preset)
      setDrive(j.konfig.drive_folder || '')
      setPamPublik(j.konfig.pamsimas_publik === 'ya' ? 'ya' : 'tidak')
      setPddkPortal(j.konfig.penduduk_portal === 'ya' ? 'ya' : 'tidak')
      setSpreadsheetUrl(j.spreadsheetUrl || '')
    } catch { /* biarkan nilai bawaan */ }
  }, [sesi.token, onSesiBerakhir])

  useEffect(() => { muat() }, [muat])

  async function simpan(pasangan) {
    setSibuk(true)
    setStatus(null)
    try {
      for (const [kunci, nilai] of pasangan) {
        const j = await apiPost({ aksi: 'konfig-set', token: sesi.token, kunci, nilai })
        if (j.butuhLogin) { onSesiBerakhir(); return }
        if (!j.ok) { setStatus({ ok: false, teks: j.pesan || 'Gagal menyimpan.' }); return }
      }
      terapkanKonfig({ cloudinary_cloud: cloud, cloudinary_preset: preset })
      setStatus({ ok: true, teks: 'Konfigurasi tersimpan. ✅' })
    } catch {
      setStatus({ ok: false, teks: 'Gagal terhubung. Periksa koneksi internet.' })
    } finally {
      setSibuk(false)
    }
  }

  function simpanApiUrl() {
    const bersih = apiUrl.trim()
    if (bersih && !/^https:\/\/script\.google\.com\//.test(bersih)) {
      setStatus({ ok: false, teks: 'URL harus dari script.google.com.' })
      return
    }
    simpanLokal('pj_api_url', bersih === URL_BAWAAN ? '' : bersih)
    location.reload()
  }

  return (
    <div className="kartu">
      <h2>Konfigurasi</h2>
      <p className="keterangan-kartu">
        Pengaturan koneksi sistem. Cloudinary dan Drive tersimpan di sheet
        <b> KONFIG</b> (berlaku untuk semua admin); alamat Apps Script tersimpan
        per perangkat.
      </p>

      <div className="sub-judul">☁️ Cloudinary (penyimpanan foto)</div>
      <div className="form-baris">
        <div className="form-group">
          <label className="form-label" htmlFor="kCloud">Cloud name</label>
          <input id="kCloud" className="form-input" maxLength={60}
            value={cloud} onChange={e => setCloud(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="kPreset">Upload preset (Unsigned)</label>
          <input id="kPreset" className="form-input" maxLength={60}
            value={preset} onChange={e => setPreset(e.target.value)} />
        </div>
      </div>
      <button className="btn btn-kecil" disabled={sibuk}
        onClick={() => simpan([['cloudinary_cloud', cloud], ['cloudinary_preset', preset]])}>
        Simpan Cloudinary
      </button>

      <div className="sub-judul">📁 Google Drive (dokumen)</div>
      <div className="form-group">
        <label className="form-label" htmlFor="kDrive">Tautan folder Drive dokumen korong</label>
        <input id="kDrive" className="form-input" maxLength={300}
          placeholder="https://drive.google.com/drive/folders/…"
          value={drive} onChange={e => setDrive(e.target.value)} />
      </div>
      <div className="baris-status" style={{ justifyContent: 'flex-start' }}>
        <button className="btn btn-kecil" disabled={sibuk}
          onClick={() => simpan([['drive_folder', drive]])}>
          Simpan Drive
        </button>
        {drive && (
          <a className="btn btn-kecil btn-polos" href={drive} target="_blank" rel="noopener noreferrer">
            Buka Folder ↗
          </a>
        )}
      </div>

      <div className="sub-judul">💧 Transparansi Pamsimas</div>
      <div className="form-group">
        <label className="form-label" htmlFor="kPam">
          Tampilkan rekap kas Pamsimas (agregat saja) di website — aktifkan setelah disepakati KPSPAMS
        </label>
        <select id="kPam" className="form-input" value={pamPublik} onChange={e => setPamPublik(e.target.value)}>
          <option value="tidak">Tidak — sembunyikan dari website</option>
          <option value="ya">Ya — tampilkan section Keuangan Pamsimas</option>
        </select>
      </div>
      <button className="btn btn-kecil" disabled={sibuk}
        onClick={() => simpan([['pamsimas_publik', pamPublik]])}>
        Simpan Transparansi
      </button>

      <div className="sub-judul">🪪 Input Penduduk dari Portal</div>
      <div className="form-group">
        <label className="form-label" htmlFor="kPddk">
          Buka menu input penduduk (write-only) di portal — aktifkan setelah ada
          SK/penugasan tertulis dari wali korong (tata kelola UU PDP). Melihat/mengubah
          data per orang tetap hanya lewat spreadsheet.
        </label>
        <select id="kPddk" className="form-input" value={pddkPortal} onChange={e => setPddkPortal(e.target.value)}>
          <option value="tidak">Tidak — input hanya langsung di spreadsheet</option>
          <option value="ya">Ya — buka menu Penduduk untuk yang punya hak create</option>
        </select>
      </div>
      <button className="btn btn-kecil" disabled={sibuk}
        onClick={() => simpan([['penduduk_portal', pddkPortal]])}>
        Simpan Input Penduduk
      </button>

      <div className="sub-judul">📊 Spreadsheet & Apps Script</div>
      <div className="baris-status" style={{ justifyContent: 'flex-start', marginBottom: '0.9rem' }}>
        {spreadsheetUrl
          ? <a className="btn btn-kecil btn-polos" href={spreadsheetUrl} target="_blank" rel="noopener noreferrer">
              Buka Spreadsheet Data ↗
            </a>
          : <span className="keterangan-kartu">Memuat tautan spreadsheet…</span>}
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="kApi">
          Alamat endpoint Apps Script (override per perangkat — kosongkan lalu simpan untuk kembali ke bawaan)
        </label>
        <input id="kApi" className="form-input" maxLength={300}
          value={apiUrl} onChange={e => setApiUrl(e.target.value)} />
      </div>
      <button className="btn btn-kecil" onClick={simpanApiUrl}>
        Simpan Endpoint & Muat Ulang
      </button>

      {status && <div className={'status ' + (status.ok ? 'ok' : 'gagal')}>{status.teks}</div>}
    </div>
  )
}
