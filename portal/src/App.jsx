import { useState } from 'react'
import { bacaSesi, simpanSesi } from './api.js'
import Login from './Login.jsx'
import Aspirasi from './Aspirasi.jsx'
import Pengumuman from './Pengumuman.jsx'
import Footer from './Footer.jsx'

export default function App() {
  const [sesi, setSesi] = useState(bacaSesi)
  const [pesanLogin, setPesanLogin] = useState('')

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
          <Aspirasi sesi={sesi} onSesiBerakhir={() => keluar('Sesi berakhir. Silakan masuk lagi.')} onKeluar={() => keluar()} />
          <Pengumuman sesi={sesi} onSesiBerakhir={() => keluar('Sesi berakhir. Silakan masuk lagi.')} />
        </>
      )}

      <Footer />
    </div>
  )
}
