import { useState } from 'react'
import { apiPost } from './api.js'

const KOSONG = { nama: '', rw: '', jk: 'L', tahun: '', pekerjaan: '', pendidikan: '', kk: false }

/**
 * Input data warga — WRITE-ONLY: portal hanya bisa MENAMBAH baris.
 * Melihat atau mengubah data per orang tetap langsung di Google Sheets
 * (dilindungi login Google + 2FA), sesuai asas minimalisasi UU PDP.
 */
export default function Penduduk({ sesi, onSesiBerakhir }) {
  const [form, setForm] = useState(KOSONG)
  const [status, setStatus] = useState(null)
  const [sibuk, setSibuk] = useState(false)

  const ubah = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  async function kirim(ev) {
    ev.preventDefault()
    setSibuk(true)
    setStatus(null)
    try {
      const j = await apiPost({
        aksi: 'penduduk-tambah', token: sesi.token,
        nama: form.nama, rw: form.rw, jk: form.jk, tahun: form.tahun,
        pekerjaan: form.pekerjaan, pendidikan: form.pendidikan,
        kk: form.kk ? 'Y' : '',
      })
      if (j.butuhLogin) { onSesiBerakhir(); return }
      if (!j.ok) { setStatus({ ok: false, teks: j.pesan || 'Gagal menyimpan.' }); return }
      // RW dipertahankan supaya input berurutan per wilayah tidak mengetik ulang
      setForm(f => ({ ...KOSONG, rw: f.rw }))
      setStatus({ ok: true, teks: `Tersimpan. Total ${j.total} jiwa tercatat. ✅` })
    } catch {
      setStatus({ ok: false, teks: 'Gagal terhubung. Periksa koneksi internet.' })
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className="kartu">
      <h2>🪪 Input Penduduk</h2>
      <p className="keterangan-kartu">
        Portal ini hanya bisa <b>menambah</b> data (write-only). Melihat, mencari,
        atau mengubah data per orang tetap langsung di Google Sheets — tanyakan
        ke Super User. Data sengaja minim (tanpa NIK, tanpa tanggal lahir lengkap)
        sesuai asas minimalisasi UU PDP; website publik hanya menampilkan agregat.
      </p>

      <form onSubmit={kirim}>
        <div className="form-baris">
          <div className="form-group">
            <label className="form-label" htmlFor="pdNama">Nama lengkap *</label>
            <input id="pdNama" name="nama" className="form-input" maxLength={80} required
              value={form.nama} onChange={ubah} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="pdRw">RW / wilayah</label>
            <input id="pdRw" name="rw" className="form-input" maxLength={20}
              placeholder="mis. RW 01" value={form.rw} onChange={ubah} />
          </div>
        </div>
        <div className="form-baris">
          <div className="form-group">
            <label className="form-label" htmlFor="pdJk">Jenis kelamin *</label>
            <select id="pdJk" name="jk" className="form-input" value={form.jk} onChange={ubah}>
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="pdTahun">Tahun lahir *</label>
            <input id="pdTahun" name="tahun" className="form-input" type="number"
              min={1901} max={new Date().getFullYear()} required
              placeholder="mis. 1987" value={form.tahun} onChange={ubah} />
          </div>
        </div>
        <div className="form-baris">
          <div className="form-group">
            <label className="form-label" htmlFor="pdKerja">Pekerjaan</label>
            <input id="pdKerja" name="pekerjaan" className="form-input" maxLength={60}
              list="pdKerjaSaran" value={form.pekerjaan} onChange={ubah} />
            <datalist id="pdKerjaSaran">
              <option value="Petani" /><option value="Nelayan" /><option value="Pedagang" />
              <option value="Wiraswasta" /><option value="PNS" /><option value="Guru" />
              <option value="Ibu Rumah Tangga" /><option value="Pelajar/Mahasiswa" />
              <option value="Belum/Tidak Bekerja" />
            </datalist>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="pdDidik">Pendidikan terakhir</label>
            <input id="pdDidik" name="pendidikan" className="form-input" maxLength={60}
              list="pdDidikSaran" value={form.pendidikan} onChange={ubah} />
            <datalist id="pdDidikSaran">
              <option value="Belum Sekolah" /><option value="SD" /><option value="SMP" />
              <option value="SMA/SMK" /><option value="Diploma" /><option value="Sarjana" />
            </datalist>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" checked={form.kk}
              onChange={e => setForm(f => ({ ...f, kk: e.target.checked }))} />
            Kepala keluarga (dasar hitungan jumlah KK)
          </label>
        </div>
        <button className="btn" type="submit" disabled={sibuk}>
          {sibuk ? 'Menyimpan…' : 'Simpan & Input Berikutnya 🪪'}
        </button>
        {status && <div className={'status ' + (status.ok ? 'ok' : 'gagal')}>{status.teks}</div>}
      </form>
    </div>
  )
}
