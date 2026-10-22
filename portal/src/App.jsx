import { useState } from 'react'
import { bacaSesi, simpanSesi } from './api.js'
import Login from './Login.jsx'
import Aspirasi from './Aspirasi.jsx'
import Pengumuman from './Pengumuman.jsx'
import Struktur from './Struktur.jsx'
import Footer from './Footer.jsx'

const MENU = [
  { id: 'aspirasi', label: '💬 Aspirasi' },
  { id: 'pengumuman', label: '📢 Pengumuman' },
  { id: 'struktur', label: '🏛 Struktur' },
]

export default function App() {
  const [sesi, setSesi] = useState(bacaSesi)
  const [pesanLogin, setPesanLogin] = useState('')
  const [tab, setTab] = useState('aspirasi')

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

  return (
    <div className="wrap">
      <div className="brand">
        <img src="./logo.svg" alt="" />
        <h1>
          Portal Admin
          <span>Korong Padang Jambu</span>
        </h1>
      </div>

      {!sesi ? (
        <Login onMasuk={masuk} pesanAwal={pesanLogin} />
      ) : (
        <>
          <div className="kartu kartu-nav">
            <div className="bar-atas">
              <div className="salam">Masuk sebagai <b>{sesi.nama}</b></div>
              <button className="btn btn-kecil" onClick={() => keluar()}>Keluar</button>
            </div>
            <nav className="menu-tab">
              {MENU.map(m => (
                <button
                  key={m.id}
                  className={'menu-item' + (tab === m.id ? ' aktif' : '')}
                  onClick={() => setTab(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </nav>
          </div>

          {tab === 'aspirasi' && <Aspirasi sesi={sesi} onSesiBerakhir={sesiBerakhir} />}
          {tab === 'pengumuman' && <Pengumuman sesi={sesi} onSesiBerakhir={sesiBerakhir} />}
          {tab === 'struktur' && <Struktur sesi={sesi} onSesiBerakhir={sesiBerakhir} />}
        </>
      )}

      <Footer />
    </div>
  )
}
