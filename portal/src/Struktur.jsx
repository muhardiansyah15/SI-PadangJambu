import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet, apiPost, unggahCloudinary, urlTransform } from './api.js'

const FORM_KOSONG = { nama: '', jabatan: '', induk: '', urut: '10' }

/** Saudara sekandung diurutkan nomor urut dulu, lalu nama — hierarki tetap utama. */
const urutkan = list => [...list].sort((a, b) =>
  ((a.urut || 0) - (b.urut || 0)) || String(a.nama).localeCompare(String(b.nama)))

function Cabang({ item, semua, onHapus, onEdit }) {
  const anak = urutkan(semua.filter(s => s.induk === item.id))
  return (
    <div>
      <div className="str-item">
        <div className="str-kiri">
          {item.foto
            ? <img className="str-foto" src={urlTransform(item.foto, 'w_80,h_80,c_fill,q_auto,f_auto')} alt="" />
            : <div className="str-foto str-foto-kosong">👤</div>}
          <div>
            <div className="str-jabatan">{item.jabatan} <span className="ket-kecil">#{item.urut || 0}</span></div>
            <div className="str-nama">{item.nama}</div>
          </div>
        </div>
        <div>
          <button className="btn btn-kecil btn-polos" onClick={() => onEdit(item)}>Edit ✏️</button>{' '}
          <button className="btn-hapus" onClick={() => onHapus(item.id)}>Hapus</button>
        </div>
      </div>
      {anak.length > 0 && (
        <div className="str-anak">
          {anak.map(a => <Cabang key={a.id} item={a} semua={semua} onHapus={onHapus} onEdit={onEdit} />)}
        </div>
      )}
    </div>
  )
}

export default function Struktur({ sesi, onSesiBerakhir }) {
  const [form, setForm] = useState(FORM_KOSONG)
  const [status, setStatus] = useState(null)
  const [sibuk, setSibuk] = useState(false)
  const [data, setData] = useState(null)
  const [gagal, setGagal] = useState(false)
  const [file, setFile] = useState(null)
  const [editId, setEditId] = useState(null)
  const [editFoto, setEditFoto] = useState('') // foto lama saat mode edit
  const [formTampil, setFormTampil] = useState(false)
  const fileRef = useRef(null)

  const ubah = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const muat = useCallback(async () => {
    setData(null)
    setGagal(false)
    try {
      const j = await apiGet({ daftar: 'struktur' })
      if (!j.ok || !Array.isArray(j.data)) throw new Error()
      setData(j.data)
    } catch {
      setGagal(true)
      setData([])
    }
  }, [])

  useEffect(() => { muat() }, [muat])

  async function tambah(ev) {
    ev.preventDefault()
    setSibuk(true)
    setStatus(null)
    try {
      let foto = editId ? editFoto : ''
      if (file) foto = await unggahCloudinary(file, 800, 'padang-jambu/struktur')
      const j = editId
        ? await apiPost({ aksi: 'struktur-edit', token: sesi.token, id: editId, ...form, foto })
        : await apiPost({ aksi: 'struktur', token: sesi.token, ...form, foto })
      if (j.butuhLogin) { onSesiBerakhir(); return }
      if (!j.ok) {
        setStatus({ ok: false, teks: j.pesan || 'Gagal menyimpan.' })
        return
      }
      const tadiEdit = editId
      batalEdit()
      setStatus({ ok: true, teks: tadiEdit ? 'Perubahan tersimpan. ✅' : 'Pengurus tersimpan. ✅' })
      muat()
    } catch {
      setStatus({ ok: false, teks: 'Gagal terhubung. Periksa koneksi internet.' })
    } finally {
      setSibuk(false)
    }
  }

  function mulaiEdit(item) {
    setEditId(item.id)
    setEditFoto(item.foto || '')
    setForm({ nama: item.nama, jabatan: item.jabatan, induk: item.induk || '', urut: String(item.urut || 10) })
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
    setFormTampil(true)
    setStatus(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function mulaiTambah() {
    setEditId(null)
    setEditFoto('')
    setForm(FORM_KOSONG)
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
    setFormTampil(true)
    setStatus(null)
  }

  function batalEdit() {
    setEditId(null)
    setEditFoto('')
    setForm(FORM_KOSONG)
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
    setFormTampil(false)
  }

  async function hapus(id) {
    if (!confirm('Hapus pengurus ini dari struktur?')) return
    try {
      const j = await apiPost({ aksi: 'struktur-hapus', token: sesi.token, id })
      if (j.butuhLogin) { onSesiBerakhir(); return }
      if (!j.ok && j.pesan) { alert(j.pesan); return }
      muat()
    } catch {
      alert('Gagal menghapus. Periksa koneksi internet.')
    }
  }

  // puncak = induk kosong atau atasannya sudah tidak ada
  const puncak = urutkan((data || []).filter(s => !s.induk || !(data || []).some(x => x.id === s.induk)))

  return (
    <div className="kartu">
      <div className="bar-atas">
        <h2>Struktur Pemerintahan Korong</h2>
        {!formTampil && <button className="btn btn-kecil" onClick={mulaiTambah}>+ Tambah Pengurus</button>}
      </div>
      {status && !formTampil && <div className={'status ' + (status.ok ? 'ok' : 'gagal')}>{status.teks}</div>}
      {formTampil && (
      <form onSubmit={tambah}>
        <div className="form-baris">
          <div className="form-group">
            <label className="form-label" htmlFor="sNama">Nama</label>
            <input id="sNama" name="nama" className="form-input" maxLength={80} required
              value={form.nama} onChange={ubah} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="sJabatan">Jabatan</label>
            <input id="sJabatan" name="jabatan" className="form-input" maxLength={80} required
              placeholder="mis. Wali Korong" value={form.jabatan} onChange={ubah} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="sFoto">
            Foto (opsional{editId && editFoto ? ' — kosongkan untuk mempertahankan foto lama' : ''})
          </label>
          <input id="sFoto" type="file" accept="image/*" className="form-input" ref={fileRef}
            onChange={e => setFile(e.target.files[0] || null)} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="sUrut">Nomor urut (antar rekan setingkat; kecil = lebih dulu)</label>
          <input id="sUrut" name="urut" type="number" min="0" max="999" className="form-input"
            value={form.urut} onChange={ubah} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="sInduk">Atasan langsung</label>
          <select id="sInduk" name="induk" className="form-input" value={form.induk} onChange={ubah}>
            <option value="">— Puncak struktur (tanpa atasan) —</option>
            {(data || []).filter(s => s.id !== editId).map(s => (
              <option key={s.id} value={s.id}>{s.jabatan} — {s.nama}</option>
            ))}
          </select>
        </div>
        <button className="btn" type="submit" disabled={sibuk}>
          {sibuk ? 'Menyimpan…' : editId ? 'Simpan Perubahan ✏️' : 'Tambahkan ke Struktur 🏛'}
        </button>
        <button type="button" className="btn btn-polos" style={{ marginTop: '0.6rem' }} onClick={batalEdit}>
          Batal
        </button>
        {status && <div className={'status ' + (status.ok ? 'ok' : 'gagal')}>{status.teks}</div>}
      </form>
      )}

      {!formTampil && (
      <>
      <div className="sub-judul">Bagan Saat Ini</div>
      {data === null && <div className="kosong">Memuat…</div>}
      {data !== null && gagal && <div className="kosong">Gagal memuat. Coba muat ulang.</div>}
      {data !== null && !gagal && data.length === 0 && (
        <div className="kosong">Belum ada pengurus. Mulai dari jabatan puncak, mis. Wali Korong.</div>
      )}
      {data !== null && puncak.map(p => (
        <Cabang key={p.id} item={p} semua={data} onHapus={hapus} onEdit={mulaiEdit} />
      ))}
      </>
      )}
    </div>
  )
}
