import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPost, CLOUDINARY, urlTransform, unggahCloudinary, fmtWaktu } from './api.js'

export default function Galeri({ sesi, onSesiBerakhir }) {
  const [file, setFile] = useState(null)
  const [judul, setJudul] = useState('')
  const [album, setAlbum] = useState('')
  const [editId, setEditId] = useState(null)
  const [formTampil, setFormTampil] = useState(false)
  const [status, setStatus] = useState(null)
  const [sibuk, setSibuk] = useState(false)
  const [data, setData] = useState(null)
  const [gagal, setGagal] = useState(false)

  const muat = useCallback(async () => {
    setData(null)
    setGagal(false)
    try {
      const j = await apiGet({ daftar: 'galeri' })
      if (!j.ok || !Array.isArray(j.data)) throw new Error()
      setData(j.data)
    } catch {
      setGagal(true)
      setData([])
    }
  }, [])

  useEffect(() => { muat() }, [muat])

  const albumAda = [...new Set((data || []).map(f => f.album).filter(Boolean))]

  async function unggah(ev) {
    ev.preventDefault()
    if (!editId && !file) { setStatus({ ok: false, teks: 'Pilih foto dulu.' }); return }
    setSibuk(true)
    setStatus(null)
    try {
      let j
      if (editId) {
        // foto baru dipilih saat edit → unggah dan ganti sekalian
        const urlBaru = file ? await unggahCloudinary(file, 1600, 'padang-jambu/galeri') : ''
        j = await apiPost({ aksi: 'galeri-edit', token: sesi.token, id: editId, judul, album, url: urlBaru })
      } else {
        const urlFoto = await unggahCloudinary(file, 1600, 'padang-jambu/galeri')
        j = await apiPost({ aksi: 'galeri', token: sesi.token, url: urlFoto, judul, album })
      }
      if (j.butuhLogin) { onSesiBerakhir(); return }
      if (!j.ok) { setStatus({ ok: false, teks: j.pesan || 'Gagal menyimpan.' }); return }
      setFile(null)
      setJudul('')
      setEditId(null)
      setFormTampil(false)
      ev.target.reset?.()
      setStatus({ ok: true, teks: editId ? 'Keterangan foto diperbarui. ✅' : 'Foto tayang di galeri website. ✅' })
      muat()
    } catch {
      setStatus({ ok: false, teks: 'Gagal mengunggah. Periksa koneksi internet.' })
    } finally {
      setSibuk(false)
    }
  }

  function mulaiEdit(f) {
    setEditId(f.id)
    setJudul(f.judul)
    setAlbum(f.album)
    setFile(null)
    setFormTampil(true)
    setStatus(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function mulaiTambah() {
    setEditId(null)
    setJudul('')
    setFile(null)
    setFormTampil(true)
    setStatus(null)
  }

  function batalEdit() {
    setEditId(null)
    setJudul('')
    setFile(null)
    setFormTampil(false)
    setStatus(null)
  }

  async function hapus(id) {
    if (!confirm('Hapus foto ini dari galeri website?')) return
    try {
      const j = await apiPost({ aksi: 'galeri-hapus', token: sesi.token, id })
      if (j.butuhLogin) { onSesiBerakhir(); return }
      muat()
    } catch {
      alert('Gagal menghapus. Periksa koneksi internet.')
    }
  }

  if (!CLOUDINARY.cloud || !CLOUDINARY.preset) {
    return (
      <div className="kartu">
        <h2>Galeri Foto</h2>
        <p className="keterangan-kartu">
          Galeri belum dikonfigurasi. Buat akun gratis di <b>cloudinary.com</b>,
          lalu di dashboard: Settings → Upload → Upload presets → Add upload
          preset → mode <b>Unsigned</b>. Isi <b>cloud name</b> dan <b>nama
          preset</b>-nya ke konstanta <code>CLOUDINARY</code> di{' '}
          <code>portal/src/api.js</code>, lalu build & push ulang.
        </p>
      </div>
    )
  }

  return (
    <div className="kartu">
      <div className="bar-atas">
        <h2>Galeri Foto</h2>
        {!formTampil && <button className="btn btn-kecil" onClick={mulaiTambah}>+ Unggah Foto</button>}
      </div>
      {status && !formTampil && <div className={'status ' + (status.ok ? 'ok' : 'gagal')}>{status.teks}</div>}
      {formTampil && (
      <>
      <p className="keterangan-kartu">
        Foto dikecilkan otomatis (maks. 1600px) sebelum diunggah ke Cloudinary.
        Jangan unggah foto close-up anak-anak tanpa izin orang tuanya.
      </p>
      <form onSubmit={unggah}>
        <div className="form-group">
          <label className="form-label" htmlFor="gFile">
            {editId ? 'Ganti foto (opsional — kosongkan untuk mempertahankan foto lama)' : 'Foto'}
          </label>
          <input id="gFile" type="file" accept="image/*" className="form-input"
            onChange={e => setFile(e.target.files[0] || null)} />
        </div>
        <div className="form-baris">
          <div className="form-group">
            <label className="form-label" htmlFor="gJudul">Keterangan foto</label>
            <input id="gJudul" className="form-input" maxLength={120}
              placeholder="mis. Gotong royong irigasi" value={judul} onChange={e => setJudul(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="gAlbum">Album / kegiatan</label>
            <input id="gAlbum" className="form-input" maxLength={60} list="daftarAlbum"
              placeholder="mis. Gotong Royong 2026" value={album} onChange={e => setAlbum(e.target.value)} />
            <datalist id="daftarAlbum">
              {albumAda.map(a => <option key={a} value={a} />)}
            </datalist>
          </div>
        </div>
        <button className="btn" type="submit" disabled={sibuk}>
          {sibuk ? 'Menyimpan…' : editId ? 'Simpan Perubahan ✏️' : 'Unggah ke Galeri 🖼'}
        </button>
        <button type="button" className="btn btn-polos" style={{ marginTop: '0.6rem' }} onClick={batalEdit}>
          Batal
        </button>
        {status && <div className={'status ' + (status.ok ? 'ok' : 'gagal')}>{status.teks}</div>}
      </form>
      </>
      )}

      {!formTampil && (
      <>
      <div className="sub-judul">Foto Tayang</div>
      {data === null && <div className="kosong">Memuat…</div>}
      {data !== null && gagal && <div className="kosong">Gagal memuat. Coba muat ulang.</div>}
      {data !== null && !gagal && data.length === 0 && (
        <div className="kosong">Belum ada foto di galeri.</div>
      )}
      <div className="galeri-grid">
        {(data || []).map(f => (
          <div className="galeri-item" key={f.id}>
            <img src={urlTransform(f.url, 'w_400,h_300,c_fill,q_auto,f_auto')} alt={f.judul} loading="lazy" />
            <div className="galeri-ket">
              <div><b>{f.judul || 'Tanpa keterangan'}</b></div>
              <div className="galeri-sub">{f.album && <span>{f.album} · </span>}{fmtWaktu(f.waktu)}</div>
            </div>
            <div className="baris-hapus" style={{ margin: '0 0.75rem 0.7rem' }}>
              <button className="btn-ubah" onClick={() => mulaiEdit(f)}>Edit</button>{' '}
              <button className="btn-hapus" onClick={() => hapus(f.id)}>Hapus</button>
            </div>
          </div>
        ))}
      </div>
      </>
      )}
    </div>
  )
}
