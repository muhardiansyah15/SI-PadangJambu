import { useRef, useState } from 'react'
import { apiPost, bacaSesi, simpanSesi, unggahCloudinary, urlTransform, CLOUDINARY } from './api.js'
import Login from './Login.jsx'
import Aspirasi from './Aspirasi.jsx'
import Pengumuman from './Pengumuman.jsx'
import Struktur from './Struktur.jsx'
import Galeri from './Galeri.jsx'
import Pengguna from './Pengguna.jsx'
import Footer from './Footer.jsx'

const MENU = [
  { id: 'aspirasi', label: '💬 Aspirasi' },
  { id: 'pengumuman', label: '📢 Pengumuman' },
  { id: 'struktur', label: '🏛 Struktur' },
  { id: 'galeri', label: '🖼 Galeri' },
  { id: 'pengguna', label: '👥 Pengguna', khususPemilik: true },
]

export default function App() {
  const [sesi, setSesi] = useState(bacaSesi)
  const [pesanLogin, setPesanLogin] = useState('')
  const [tab, setTab] = useState('aspirasi')
  const fotoRef = useRef(null)

  async function gantiFotoProfil(e) {
    const f = e.target.files[0]
    e.target.value = ''
    if (!f) return
    try {
      const url = await unggahCloudinary(f, 600, 'padang-jambu/profil')
      const j = await apiPost({ aksi: 'profil-foto', token: sesi.token, url })
      if (j.butuhLogin) { sesiBerakhir(); return }
      if (!j.ok) { alert(j.pesan || 'Gagal menyimpan foto profil.'); return }
      const baru = { ...sesi, foto: url }
      simpanSesi(baru)
      setSesi(baru)
    } catch {
      alert('Gagal mengunggah foto profil.')
    }
  }

  function masuk(sesiBaru) {
    simpanSesi(sesiBaru)
    setPesanLogin('')
    setSesi(sesiBaru)
  }

  function keluar(pesan) {
    simpanSesi(null)
    setPesanLogin(pesan || '')
    setSesi(null)
  }

  const sesiBerakhir = () => keluar('Sesi berakhir. Silakan masuk lagi.')

  if (!sesi) {
    return (
      <div className="wrap">
        <div className="brand">
          <img src="./logo.svg" alt="" />
          <h1>
            Portal Admin
            <span>Korong Padang Jambu</span>
          </h1>
        </div>
        <Login onMasuk={masuk} pesanAwal={pesanLogin} />
        <Footer />
      </div>
    )
  }

  return (
    <div className="tataletak">
      <aside className="sisi">
        <div className="brand brand-sisi">
          <img src="./logo.svg" alt="" />
          <h1>
            Portal Admin
            <span>Korong Padang Jambu</span>
          </h1>
        </div>
        <nav className="menu-sisi">
          {MENU.filter(m => !m.khususPemilik || sesi.peran === 'pemilik').map(m => (
            <button
              key={m.id}
              className={'menu-item' + (tab === m.id ? ' aktif' : '')}
              onClick={() => setTab(m.id)}
            >
              {m.label}
            </button>
          ))}
        </nav>
        <div className="sisi-bawah">
          {CLOUDINARY.cloud && (
            <>
              <button className="avatar-sisi" title="Ganti foto profil" onClick={() => fotoRef.current.click()}>
                {sesi.foto
                  ? <img src={urlTransform(sesi.foto, 'w_120,h_120,c_fill,q_auto,f_auto')} alt="" />
                  : '👤'}
              </button>
              <input type="file" accept="image/*" hidden ref={fotoRef} onChange={gantiFotoProfil} />
            </>
          )}
          <div className="salam-sisi">Masuk sebagai<br /><b>{sesi.nama}</b></div>
          <button className="btn btn-kecil" onClick={() => keluar()}>Keluar</button>
        </div>
      </aside>

      <main className="isi">
        {tab === 'aspirasi' && <Aspirasi sesi={sesi} onSesiBerakhir={sesiBerakhir} />}
        {tab === 'pengumuman' && <Pengumuman sesi={sesi} onSesiBerakhir={sesiBerakhir} />}
        {tab === 'struktur' && <Struktur sesi={sesi} onSesiBerakhir={sesiBerakhir} />}
        {tab === 'galeri' && <Galeri sesi={sesi} onSesiBerakhir={sesiBerakhir} />}
        {tab === 'pengguna' && sesi.peran === 'pemilik' && <Pengguna sesi={sesi} onSesiBerakhir={sesiBerakhir} />}
        <Footer />
      </main>
    </div>
  )
}
