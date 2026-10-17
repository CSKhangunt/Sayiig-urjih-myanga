import { useEffect, useState } from 'react'
import { apiUrl } from './config.js'
import { avatars, skins } from '../shared/cosmetics.js'

export default function ProfilePanel({ getToken }) {
  const [profile, setProfile] = useState(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  async function request(path, options = {}) {
    const token = await getToken()
    const response = await fetch(apiUrl(path), { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Хадгалж чадсангүй.')
    return data.profile
  }
  useEffect(() => {
    let active = true
    getToken().then((token) => fetch(apiUrl('/api/profile'), { headers: { Authorization: `Bearer ${token}` } })).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); if (active) setProfile(data.profile) }).catch((error) => { if (active) setNotice(error.message) })
    return () => { active = false }
  }, [getToken])
  async function save(event) {
    event.preventDefault(); setBusy(true)
    try { setProfile(await request('/api/profile', { method: 'PATCH', body: JSON.stringify({ username: profile.username, displayName: profile.displayName, avatar: profile.avatar, activeSkin: profile.activeSkin }) })); setNotice('Профайл хадгалагдлаа.') } catch (error) { setNotice(error.message) } finally { setBusy(false) }
  }
  async function claim(id) {
    setBusy(true)
    try { setProfile(await request(`/api/skins/${id}/claim`, { method: 'POST' })); setNotice('Үнэгүй дүр таны цуглуулгад нэмэгдлээ.') } catch (error) { setNotice(error.message) } finally { setBusy(false) }
  }
  async function deleteAccount() {
    if (confirmation !== 'УСТГАХ' || !window.confirm('Бүртгэл болон хувийн мэдээллээ бүрмөсөн устгах уу?')) return
    setBusy(true)
    try { await request('/api/profile', { method: 'DELETE', body: JSON.stringify({ confirmation }) }); localStorage.removeItem('guestToken'); sessionStorage.removeItem('accountToken'); window.location.assign('/') } catch (error) { setNotice(error.message) } finally { setBusy(false) }
  }
  return <section className="social-panel"><h2>Миний профайл</h2>{notice && <p role="status">{notice}</p>}{!profile ? <p>Ачаалж байна…</p> : <form onSubmit={save}><p>Дуусгасан тоглоом: {profile.statistics?.totalGames || 0} · Хожил: {profile.statistics?.wins || 0} · Ялагдал: {profile.statistics?.losses || 0} · Хожлын хувь: {profile.statistics?.winRate || 0}%</p><label>Хэрэглэгчийн нэр<input value={profile.username || ''} pattern="[a-zA-Z0-9_]{3,24}" maxLength={24} required onChange={(event) => setProfile({ ...profile, username: event.target.value })} /></label><label>Тоглогчийн нэр<input value={profile.displayName} minLength={2} maxLength={18} required onChange={(event) => setProfile({ ...profile, displayName: event.target.value })} /></label><label>Дүрээ сонгох<select value={profile.avatar} onChange={(event) => setProfile({ ...profile, avatar: event.target.value })}>{avatars.map((avatar) => <option key={avatar}>{avatar}</option>)}</select></label><h3>Дүрийн цуглуулга</h3>{skins.map((skin) => <div className="social-row" key={skin.id}><span><i style={{ color: skin.color }}>●</i> {skin.name}<small> · {skin.description}</small></span>{profile.skins.includes(skin.id) ? <label><input type="radio" name="skin" checked={profile.activeSkin === skin.id} onChange={() => setProfile({ ...profile, activeSkin: skin.id })} /> Сонгох</label> : <button type="button" disabled={busy} onClick={() => claim(skin.id)}>Үнэгүй авах</button>}</div>)}<button disabled={busy} type="submit">{busy ? 'Хадгалж байна…' : 'Хадгалах'}</button></form>}{profile && <details><summary>Бүртгэл устгах</summary><p>Энэ үйлдлийг буцаах боломжгүй. Сүүлийн 10 минутын дотор дахин нэвтэрсэн байх шаардлагатай.</p><label>УСТГАХ гэж бичнэ үү<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><button type="button" disabled={busy || confirmation !== 'УСТГАХ'} onClick={deleteAccount}>Бүртгэлээ бүрмөсөн устгах</button></details>}</section>
}
