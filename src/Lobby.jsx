import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Coins, Dice5, Gamepad2, KeyRound, LayoutGrid, Lock, LogIn, Map, Palette, Plus, Settings2, ShoppingCart, Sparkles, UserCircle, Users, Volume2, VolumeX, X, Zap } from 'lucide-react'
import GameRoom from './GameRoom.jsx'
import './Lobby.css'
import './LobbyPremium.css'
import './LobbyLoginPremium.css'
import { apiUrl, apiFetch as fetch } from './config.js'
import FriendsPanel from './FriendsPanel.jsx'
import ProfilePanel from './ProfilePanel.jsx'
import { readRoomRoute, roomPath, navigateRoom, joinRoomOnce } from './roomRouting.js'
import { readApiResponse } from './apiErrors.js'

const avatars = ['🦅', '🐎', '🐺', '🦌', '🐫']
const defaultSettings = {
  maxPlayers: 4,
  startingCash: 1500,
  privateRoom: true,
  bots: false,
  map: 'Сонгодог',
  doubledSetRent: true,
  vacationCash: false,
  auction: true,
  noRentInPrison: false,
  mortgage: true,
  evenBuild: true,
  randomOrder: true,
}

export default function Lobby({ clerkAccount = null, userButton = null, clerkLogin = null, clerkGetToken = null }) {
  const [nickname, setNickname] = useState('')
  const [avatar, setAvatar] = useState(avatars[0])
  const [settings, setSettings] = useState(() => { try { return { ...defaultSettings, ...JSON.parse(localStorage.getItem('terbumtanRoomSettings') || '{}') } } catch { return defaultSettings } })
  const [showSettings, setShowSettings] = useState(false)
  const [showRooms, setShowRooms] = useState(false)
  const [rooms, setRooms] = useState([])
  const [room, setRoom] = useState(null)
  const [infoModal, setInfoModal] = useState(null)
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [route, setRoute] = useState(() => readRoomRoute(window.location))
  const routeVersion = useRef(0)
  const creationPending = useRef(false)

  useEffect(() => {
    const changed = () => { routeVersion.current += 1; setRoute(readRoomRoute(window.location)); setRoom(null); setError(''); setShowRooms(false) }
    window.addEventListener('popstate', changed)
    return () => window.removeEventListener('popstate', changed)
  }, [])

  const enterRoom = (nextRoom) => {
    navigateRoom(roomPath(nextRoom))
    setRoom(nextRoom)
    setShowRooms(false)
    setInfoModal(null)
  }

  useEffect(() => {
    if (!route || !clerkAccount?.token || room?.code === route.code) return
    let active = true
    setBusy(true)
    setError('')
    const key = JSON.stringify([clerkAccount.token, route.code, route.inviteToken])
    joinRoomOnce(key, async () => {
      const response = await fetch(apiUrl(`/api/rooms/${route.code}/join`), {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clerkAccount.token}`, 'X-Clerk-Token': await clerkGetToken() },
        body: JSON.stringify({ inviteToken: route.inviteToken }),
      })
      const result = await readApiResponse(response)
      return result
    }).then((result) => {
      if (!active) return
      // Canonicalize the URL without starting a second navigation/join.
      window.history.replaceState({}, '', roomPath(result))
      setRoom(result)
    }).catch((failure) => { if (active) setError(failure.message) })
      .finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [route, clerkAccount?.token, room?.code, clerkGetToken])

  useEffect(() => {
    const joined = (event) => { navigateRoom(roomPath(event.detail)); setRoom(event.detail); setInfoModal(null) }
    window.addEventListener('game:invitation-joined', joined)
    return () => window.removeEventListener('game:invitation-joined', joined)
  }, [])


  const createSession = async () => {
    if (!clerkAccount?.token) throw new Error('Тоглохын тулд нэвтэрнэ үү.')
    localStorage.setItem('guestToken', clerkAccount.token)
    return clerkAccount.token
  }

  const createRoom = async (privateRoom) => {
    if (creationPending.current || busy) return
    if (!clerkAccount && nickname.trim().length < 2) {
      setError('Эхлээд 2-18 тэмдэгттэй тоглогчийн нэр оруулна уу.')
      return
    }
    setError('')
    creationPending.current = true
    const version = routeVersion.current
    setBusy(true)
    try {
      const token = await createSession()
      const response = await fetch(apiUrl('/api/rooms'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...settings, privateRoom, startingCash: settings.startingCash * 1000 }),
      })
      const result = await readApiResponse(response)
      if (version !== routeVersion.current) return
      enterRoom(result)
      setShowSettings(false)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      creationPending.current = false
      setBusy(false)
    }
  }

  const loadRooms = async () => {
    try {
      const response = await fetch(apiUrl('/api/rooms'))
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setRooms(result.rooms || [])
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const joinRoom = (code) => {
    navigateRoom(`/room/${code.toUpperCase()}`)
    setShowRooms(false)
  }

  const updateSetting = (key, value) => setSettings((current) => { const next = { ...current, [key]: value }; localStorage.setItem('terbumtanRoomSettings', JSON.stringify(next)); return next })
  const openRooms = () => {
    setShowRooms(true)
    loadRooms()
  }

  if (room) return <GameRoom key={room.code} room={room} player={room.player} getToken={clerkGetToken} onLeave={() => { navigateRoom('/'); setRoom(null) }} />
  if (infoModal === 'store') return <StoreView onBack={() => setInfoModal(null)} onLogin={() => setInfoModal('login')} clerkLogin={clerkLogin} />

  return (
    <main className="lobby-shell">
      <header className="lobby-nav">
        <button className="sound-button" title={muted ? 'Дуу асаах' : 'Дуу унтраах'} onClick={() => setMuted((current) => { const next = !current; localStorage.setItem('terbumtanMuted', String(next)); return next })}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
        <div className="nav-links"><button onClick={() => setInfoModal('store')}><ShoppingCart size={15} /> Дэлгүүр</button>{clerkAccount ? <><span className="account-chip">{clerkAccount.profile?.displayName || 'Тоглогч'} · идэвхтэй</span>{userButton}</> : clerkLogin || <button onClick={() => setInfoModal('login')}><LogIn size={15} /> Нэвтрэх</button>}</div>
      </header>

      <section className="lobby-hero">
        {route && <section className="room-toast" aria-live="polite"><div><strong>Өрөө {route.code}</strong><small>{clerkAccount ? (busy ? 'Өрөөнд нэгдэж байна…' : 'Доорх мэдээллийг шалгана уу.') : 'Өрөөнд орохын тулд нэвтэрнэ үү.'}</small></div>{!clerkAccount && clerkLogin}<button onClick={() => navigateRoom('/')}>Буцах</button></section>}
        <div className="dice-logo"><Dice5 size={88} strokeWidth={1.8} /></div>
        <div className="logo-wordmark">ТЭРБУМТАН<span>.io</span></div>
        <p>Эдийн засгийг удирд.</p>
        <div className="play-form">
          <input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="Тоглогчийн нэр..." maxLength={18} aria-label="Тоглогчийн нэр" />
          <div className="avatar-row">{avatars.map((item) => <button key={item} className={avatar === item ? 'avatar active' : 'avatar'} onClick={() => setAvatar(item)} aria-label={`Дүр ${item}`}>{item}</button>)}</div>
          <button className="play-button" onClick={() => createRoom(false)} disabled={busy}><Gamepad2 size={25} /> {busy ? 'Холбогдож байна...' : 'Тоглох'}</button>
        </div>
        <div className="lobby-actions"><button onClick={openRooms}><Users size={15} /> Бүх нээлттэй өрөө</button><button onClick={() => createRoom(true)} disabled={busy}><KeyRound size={15} /> Хувийн өрөө үүсгэх</button></div>
        {error && <div role="alert" className="lobby-error"><p>{error}</p>{route && clerkAccount && <button disabled={busy} onClick={() => setRoute(readRoomRoute(window.location))}>Дахин оролдох</button>}</div>}
      </section>

      <footer className="lobby-footer"><span>© 2026 Тэрбумтан Онлайн</span><span>Зочин горим · Ахиц түр хадгалагдана</span></footer>

      {clerkAccount && <><ProfilePanel getToken={clerkGetToken} /><FriendsPanel account={clerkAccount} getToken={clerkGetToken} /></>}

      {showSettings && <SettingsModal settings={settings} updateSetting={updateSetting} onClose={() => setShowSettings(false)} onCreate={() => createRoom(true)} busy={busy} />}
      {showRooms && <RoomsModal rooms={rooms} onClose={() => setShowRooms(false)} onJoin={joinRoom} />}
      {infoModal && <InfoModal type={infoModal} onClose={() => setInfoModal(null)} />}
    </main>
  )
}

function SettingsModal({ settings, updateSetting, onClose, onCreate, busy }) {
  return <div className="modal-layer"><section className="settings-modal"><button className="close-button" onClick={onClose}><X size={18} /></button><div className="modal-heading"><Settings2 size={19} /><div><span className="modal-kicker">ӨРӨӨНИЙ ТОХИРГОО</span><h2>Хувийн тоглоом үүсгэх</h2></div></div><div className="setting-block"><label>Тоглогчийн дээд тоо<small>2-8 тоглогчийн суудал</small></label><div className="stepper"><button onClick={() => updateSetting('maxPlayers', Math.max(2, settings.maxPlayers - 1))}>−</button><strong>{settings.maxPlayers}</strong><button onClick={() => updateSetting('maxPlayers', Math.min(8, settings.maxPlayers + 1))}>+</button></div></div><Toggle label="Хувийн өрөө" hint="Зөвхөн өрөөний холбоосоор нэвтэрнэ" checked={settings.privateRoom} onChange={(value) => updateSetting('privateRoom', value)} /><Toggle label="Бот нэгдэхийг зөвшөөрөх" hint="AI тоглоомын хөдөлгүүр бэлэн болтол идэвхгүй" checked={false} onChange={() => {}} beta disabled /><div className="setting-block"><label>Самбарын зураг<small>Самбар сонгох · талбар, хөрөнгө болон картын багц</small></label><select className="map-select" value={settings.map} onChange={(event) => updateSetting('map', event.target.value)}><option value="Сонгодог">Сонгодог · Өөрчилсөн сонгодог самбар</option><option value="Улаанбаатар">Улаанбаатар · Өөрчилсөн самбар</option></select></div><div className="rules-title">ТОГЛООМЫН ДҮРЭМ</div><div className="rules-grid"><Toggle label="Бүтэн багцын x2 түрээс" hint="Бүтэн багц эзэмшвэл үндсэн түрээс 2 дахин нэмэгдэнэ" checked={settings.doubledSetRent} onChange={(value) => updateSetting('doubledSetRent', value)} /><Toggle label="Амралтын мөнгө · Нэмэлт дүрэм" hint="Амралтын талбарт нэмэлт мөнгө олгоно" checked={settings.vacationCash} onChange={(value) => updateSetting('vacationCash', value)} /><Toggle label="Дуудлага худалдаа" hint="Худалдаж аваагүй хөрөнгийг дуудлагаар өгнө" checked={settings.auction} onChange={(value) => updateSetting('auction', value)} /><Toggle label="Хориход түрээс авахгүй · Нэмэлт дүрэм" hint="Хоригдож буй эзэмшигч түрээс авахгүй" checked={settings.noRentInPrison} onChange={(value) => updateSetting('noRentInPrison', value)} /><Toggle label="Ипотек" hint="Хөрөнгийн үнийн 50%-ийг авч болно" checked={settings.mortgage} onChange={(value) => updateSetting('mortgage', value)} /><Toggle label="Тэнцвэртэй барилга" hint="Байшин, зочид буудлыг жигд байгуулна" checked={settings.evenBuild} onChange={(value) => updateSetting('evenBuild', value)} /></div><div className="setting-block cash-block"><label>Эхлэх мөнгө<small>Үндсэн тохиргоо · сонголтыг өрөөний тохиргоонд хадгална</small></label><select value={settings.startingCash} onChange={(event) => updateSetting('startingCash', Number(event.target.value))}><option value={500}>500 ₮</option><option value={1000}>1,000 ₮</option><option value={1500}>1,500 ₮</option><option value={2000}>2,000 ₮</option><option value={2500}>2,500 ₮</option><option value={3000}>3,000 ₮</option></select></div><Toggle label="Тоглогчийн дарааллыг санамсаргүй болгох" hint="Тоглоом эхлэхэд дарааллыг дахин холино" checked={settings.randomOrder} onChange={(value) => updateSetting('randomOrder', value)} /><button className="create-room-button" onClick={onCreate} disabled={busy}><Lock size={17} /> {busy ? 'Үүсгэж байна...' : 'Хувийн өрөө үүсгэх'}</button></section></div>
}

function Toggle({ label, hint, checked, onChange, beta, disabled = false }) {
  return <label className={`toggle-row ${disabled ? 'disabled' : ''}`}><span><strong>{label}{beta && <em>БЕТА</em>}</strong><small>{hint}</small></span><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><i /></label>
}

function RoomsModal({ rooms, onClose, onJoin }) {
  return <div className="modal-layer"><section className="rooms-modal"><button className="close-button" onClick={onClose}><X size={18} /></button><div className="modal-heading"><Users size={19} /><div><span className="modal-kicker">ОЛОН НИЙТИЙН ЛОББИ</span><h2>Нээлттэй өрөөнүүд</h2></div></div>{rooms.length === 0 ? <div className="empty-rooms"><Sparkles size={25} /><p>Одоогоор нээлттэй өрөө алга.</p><small>Нэрээ оруулаад “Тоглох” товчийг дарж шинэ өрөө үүсгээрэй.</small></div> : <div className="room-list">{rooms.map((item) => <button className="room-card" key={item.code} onClick={() => onJoin(item.code)}><span><strong>{item.code}</strong><small>{item.players?.length || 0} / {item.settings?.maxPlayers || 6} тоглогч · {item.settings?.map || 'Сонгодог'}</small></span><span className="join-label">Нэгдэх <Plus size={15} /></span></button>)}</div>}</section></div>
}

function InfoModal({ onClose }) {
  return <div className="modal-layer"><section className="rooms-modal"><button className="close-button" onClick={onClose} aria-label="Хаах"><X size={18} /></button><h2>Нэвтрэх</h2><p>Clerk нэвтрэлтийн тохиргоог шалгана уу.</p></section></div>
}

const storeCategories = [
  { id: 'all', label: 'Бүгд', icon: LayoutGrid },
  { id: 'appearance', label: 'Тоглогчийн төрх', icon: Palette },
  { id: 'maps', label: 'Самбарын зураг', icon: Map },
  { id: 'upgrades', label: 'Нэмэлт боломж', icon: Zap },
  { id: 'avatars', label: 'Профайлын зураг', icon: UserCircle },
  { id: 'coins', label: 'Тэрбумтан зоос', icon: Coins },
]

const storeItems = [
  { id: 'blue', category: 'appearance', title: 'Хөх тэнгэр', price: 40, icon: '●', tone: 'blue' },
  { id: 'lilac', category: 'appearance', title: 'Нил ягаан', price: 80, icon: '●', tone: 'lilac' },
  { id: 'apple', category: 'appearance', title: 'Ногоон алим', price: 90, icon: '●', tone: 'apple' },
  { id: 'fire', category: 'appearance', title: 'Галын дүр', price: 130, icon: '✦', tone: 'fire' },
  { id: 'ub', category: 'maps', title: 'Улаанбаатарын тойрог', price: 180, icon: '✦', tone: 'ub' },
  { id: 'steppe', category: 'maps', title: 'Хөх талын зам', price: 180, icon: '☼', tone: 'steppe' },
  { id: 'future', category: 'maps', title: 'Ирээдүйн хот', price: 180, icon: '⌁', tone: 'future' },
  { id: 'players', category: 'upgrades', title: '7–8 тоглогч', price: 30, icon: '♟', tone: 'upgrade' },
  { id: 'teams', category: 'upgrades', title: 'Багийн горим', price: 20, icon: '◈', tone: 'upgrade' },
  { id: 'ads', category: 'upgrades', title: 'Заргүй тоглох', price: 80, icon: '✧', tone: 'upgrade' },
  { id: 'double', category: 'upgrades', title: 'Зоос x2 урамшуулал', price: 140, icon: 'x2', tone: 'upgrade' },
  { id: 'person', category: 'avatars', title: 'Хөх баатар', price: 20, icon: '●', tone: 'avatar-blue' },
  { id: 'space', category: 'avatars', title: 'Сансрын аялагч', price: 20, icon: '✦', tone: 'avatar-purple' },
  { id: 'giraffe', category: 'avatars', title: 'Өндөр шар', price: 20, icon: '●', tone: 'avatar-yellow' },
  { id: 'coinpack', category: 'coins', title: 'Жижиг зоосны багц', price: 100, icon: '₮', tone: 'coin' },
]

function StoreView({ onBack, onLogin, clerkLogin = null }) {
  const [category, setCategory] = useState('all')
  const [notice, setNotice] = useState('')
  const visibleItems = category === 'all' ? storeItems : storeItems.filter((item) => item.category === category)
  const groups = category === 'all' ? ['appearance', 'maps', 'upgrades', 'avatars'] : [category]
  const groupNames = { appearance: 'Тоглогчийн төрх', maps: 'Самбарын зураг', upgrades: 'Нэмэлт боломж', avatars: 'Профайлын зураг', coins: 'Тэрбумтан зоос' }

  return <main className="store-shell"><header className="store-nav"><button className="store-brand" onClick={onBack}><span>₮</span> ТЭРБУМТАН<span>.io</span></button><div className="store-nav-actions"><span className="coin-balance"><Coins size={15} /> 0 зоос</span>{clerkLogin || <button onClick={onLogin}><LogIn size={15} /> Нэвтрэх</button>}</div></header><div className="store-layout"><aside className="store-sidebar"><button className="back-store" onClick={onBack}><ArrowLeft size={15} /> Хүлээлгийн өрөө рүү буцах</button><p className="store-kicker">АНГИЛАЛ</p>{storeCategories.map(({ id, label, icon: Icon }) => <button className={`category-button ${category === id ? 'active' : ''}`} key={id} onClick={() => setCategory(id)}><Icon size={16} /> {label}{id === 'coins' && <span className="coin-dot">₮</span>}</button>)}<div className="store-guest-note"><Lock size={14} /><span>Зочин дэлгүүр үзэж болно. Худалдан авалт хадгалахын тулд бүртгэл үүсгэнэ.</span></div></aside><section className="store-content"><div className="store-heading"><div><p className="store-kicker">ТЭРБУМТАН ЗООС</p><h1>Дэлгүүр</h1><p>Өөрийн тоглоомын төрхийг бүтээ. Бүх зүйл зөвхөн гоёлын зориулалттай.</p></div><div className="store-heading-mark">✦</div></div>{groups.map((group) => <StoreSection key={group} title={groupNames[group]} items={visibleItems.filter((item) => item.category === group)} onBuy={() => setNotice('Байнгын цуглуулгаа хадгалахын тулд бүртгэл үүсгээрэй.')} />)}</section></div>{notice && <div className="store-notice"><span>{notice}</span><button onClick={() => setNotice('')}><X size={15} /></button></div>}<footer className="store-footer"><span>© 2026 Тэрбумтан Онлайн</span><span>Зоос нь виртуал бөгөөд мөнгөн үнэ цэнгүй</span></footer></main>
}

function StoreSection({ title, items, onBuy }) {
  if (!items.length) return null
  return <section className="store-section"><div className="store-section-heading"><h2>{title}</h2><span>Бүх зүйл <ArrowLeft size={14} /></span></div><div className="store-grid">{items.map((item) => <StoreItem item={item} key={item.id} onBuy={onBuy} />)}</div></section>
}

function StoreItem({ item, onBuy }) {
  return <article className="store-item"><div className={`store-art art-${item.tone}`}><span>{item.icon}</span>{item.category === 'maps' && <i className="art-board" />}</div><div className="store-item-info"><strong>{item.title}</strong><span><Coins size={13} /> {item.price}</span></div><button className="store-buy" onClick={onBuy}>Авах</button></article>
}

