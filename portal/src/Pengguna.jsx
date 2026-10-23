import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPost, urlTransform } from './api.js'

const FORM_KOSONG = { user: '', pass: '', nama: '', peran: 'admin' }

export default function Pengguna({ sesi, onSesiBerakhir }) {
  const [form, setForm] = useState(FORM_KOSONG)
  const [editUser, setEditUser] = useState(null)
  const [status, setStatus] = useState(null)
  const [sibuk, setSibuk] = useState(false)
  const [data, setData] = useState(null)
  const [gagal, setGagal] = useState(false)

  const ubah = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const muat = useCallback(async () => {
    setData(null)
    setGagal(false)
    try {
      const j = await apiGet({ daftar: 'user', token: sesi.token })
      if (j.butuhLogin) { onSesiBerakhir(); return }
      if (!j.ok || !Array.isArray(j.data)) throw new Error()
      setData(j.data)
    } catch {
      setGagal(true)
      setData([])
    }
  }, [sesi.token, onSesiBerakhir])

  useEffect(() => { muat() }, [muat])

  async function tambah(ev) {
    ev.preventDefault()
    setSibuk(true)
    setStatus(null)
    try {
      const j = editUser
        ? await apiPost({ aksi: 'user-edit', token: sesi.token, ...form, user: editUser })
        : await apiPost({ aksi: 'user-tambah', token: sesi.token, ...form })
      if (j.butuhLogin) { onSesiBerakhir(); return }
      if (!j.ok) {
        setStatus({ ok: false, teks: j.pesan || 'Gagal menyimpan akun.' })
        return
      }
      setForm(FORM_KOSONG)
      setEditUser(null)
      setStatus({
        ok: true,
        teks: editUser
          ? 'Akun diperbarui. Perubahan peran/password membuat pemiliknya harus login ulang. ✅'
          : 'Akun dibuat. Sampaikan username & password-nya secara langsung. ✅',
      })
      muat()
    } catch {
      setStatus({ ok: false, teks: 'Gagal terhubung. Periksa koneksi internet.' })
    } finally {
      setSibuk(false)
    }
  }

  function mulaiEdit(u) {
    setEditUser(u.user)
    setForm({ user: u.user, pass: '', nama: u.nama, peran: u.peran })
    setStatus(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function batalEdit() {
    setEditUser(null)
    setForm(FORM_KOSONG)
    setStatus(null)
  }

  async function hapus(user) {
    if (!confirm(`Hapus akun "${user}"? Semua sesi login-nya ikut dicabut.`)) return
    try {
      const j = await apiPost({ aksi: 'user-hapus', token: sesi.token, user })
      if (j.butuhLogin) { onSesiBerakhir(); return }
      if (!j.ok && j.pesan) { alert(j.pesan); return }
      muat()
    } catch {
      alert('Gagal menghapus. Periksa koneksi internet.')
    }
  }

  return (
    <div className="kartu">
      <h2>Kelola Pengguna</h2>
      <p className="keterangan-kartu">
        Akun tersimpan di sheet <b>ADMIN</b>. Gunakan password karangan — jangan
        password asli akun lain. Hanya akun berperan <b>pemilik</b> yang bisa
        membuka menu ini.
      </p>
      <form onSubmit={tambah}>
        <div className="form-baris">
          <div className="form-group">
            <label className="form-label" htmlFor="uUser">Username</label>
            <input id="uUser" name="user" className="form-input" maxLength={40} required disabled={!!editUser}
              placeholder="huruf/angka/titik/strip" value={form.user} onChange={ubah} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="uPass">
              {editUser ? 'Password baru (kosongkan jika tidak diganti)' : 'Password (min. 8 karakter)'}
            </label>
            <input id="uPass" name="pass" className="form-input" maxLength={80} required={!editUser}
              value={form.pass} onChange={ubah} />
          </div>
        </div>
        <div className="form-baris">
          <div className="form-group">
            <label className="form-label" htmlFor="uNama">Nama lengkap</label>
            <input id="uNama" name="nama" className="form-input" maxLength={80}
              value={form.nama} onChange={ubah} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="uPeran">Peran</label>
            <select id="uPeran" name="peran" className="form-input" value={form.peran} onChange={ubah}>
              <option value="admin">Admin — kelola konten</option>
              <option value="pemilik">Pemilik — konten + kelola pengguna</option>
            </select>
          </div>
        </div>
        <button className="btn" type="submit" disabled={sibuk}>
          {sibuk ? 'Menyimpan…' : editUser ? 'Simpan Perubahan ✏️' : 'Buat Akun 👥'}
        </button>
        {editUser && (
          <button type="button" className="btn btn-polos" style={{ marginTop: '0.6rem' }} onClick={batalEdit}>
            Batal Edit
          </button>
        )}
        {status && <div className={'status ' + (status.ok ? 'ok' : 'gagal')}>{status.teks}</div>}
      </form>

      <div className="sub-judul">Daftar Pengguna</div>
      {data === null && <div className="kosong">Memuat…</div>}
      {data !== null && gagal && <div className="kosong">Gagal memuat. Coba muat ulang.</div>}
      {data !== null && !gagal && data.length === 0 && (
        <div className="kosong">Belum ada pengguna terdaftar.</div>
      )}
      {data !== null && data.map(u => (
        <div className="aspirasi-item" key={u.user}>
          <div className="aspirasi-meta">
            <b className="str-kiri">
              {u.foto
                ? <img className="str-foto" src={urlTransform(u.foto, 'w_80,h_80,c_fill,q_auto,f_auto')} alt="" />
                : <div className="str-foto str-foto-kosong">👤</div>}
              <span className={'peng-tag-mini' + (u.peran === 'pemilik' ? ' penting' : '')}>
                {u.peran}
              </span>
              {u.nama}
            </b>
            <span>@{u.user}{u.user === sesi.user ? ' (Anda)' : ''}</span>
          </div>
          <div className="baris-hapus">
            <button className="btn btn-kecil btn-polos" onClick={() => mulaiEdit(u)}>Edit ✏️</button>{' '}
            {u.user !== sesi.user && (
              <button className="btn-hapus" onClick={() => hapus(u.user)}>Hapus</button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
