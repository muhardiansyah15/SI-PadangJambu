import { useState } from 'react'
import { apiPost } from './api.js'

export default function Login({ onMasuk, pesanAwal }) {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [pesan, setPesan] = useState(pesanAwal)
  const [sibuk, setSibuk] = useState(false)

  async function kirim(ev) {
    ev.preventDefault()
    setSibuk(true)
    try {
      const j = await apiPost({ aksi: 'login', user, pass })
      if (!j.ok) {
        setPesan(j.pesan || 'Gagal masuk.')
        return
      }
      onMasuk({ token: j.token, nama: j.nama, user: j.user, peran: j.peran || 'admin', foto: j.foto || '', akses: j.akses || '' })
    } catch {
      setPesan('Gagal terhubung. Periksa koneksi internet.')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className="kartu">
      <h2>Masuk</h2>
      <form onSubmit={kirim}>
        <div className="form-group">
          <label className="form-label" htmlFor="lUser">Username</label>
          <input id="lUser" className="form-input" autoComplete="username" required
            value={user} onChange={e => setUser(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="lPass">Password</label>
          <input id="lPass" className="form-input" type="password" autoComplete="current-password" required
            value={pass} onChange={e => setPass(e.target.value)} />
        </div>
        <button className="btn" type="submit" disabled={sibuk}>
          {sibuk ? 'Memeriksa…' : 'Masuk'}
        </button>
        {pesan && <div className="status gagal">{pesan}</div>}
      </form>
    </div>
  )
}
