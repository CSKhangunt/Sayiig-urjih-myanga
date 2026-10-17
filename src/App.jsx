import { useState } from 'react'
import { ArrowRight, Banknote, ChevronRight, CircleHelp, Crown, Dice5, LockKeyhole, MessageCircle, Plus, Settings2, Sparkles, Users, X } from 'lucide-react'
import './App.css'
import './AppPremium.css'

const themes = [
  { id: 'ub', name: 'Улаанбаатар', subtitle: 'Хотын бизнесийн тойрог', icon: '✦', accent: '#d99a43', colors: ['#9a4d40', '#355c70', '#356d61'] },
  { id: 'steppe', name: 'Монголын тал', subtitle: 'Хөх тэнгэрийн зам', icon: '☼', accent: '#d5a642', colors: ['#a65e35', '#5d7548', '#557d8b'] },
  { id: 'future', name: 'Ирээдүйн хот', subtitle: 'Шинэ боломжийн бүс', icon: '⌁', accent: '#3fc1bb', colors: ['#227b86', '#536394', '#964c79'] },
  { id: 'palace', name: 'Алтан ордон', subtitle: 'Өв соёлын хөрөнгө', icon: '♢', accent: '#dfb55b', colors: ['#8f563d', '#6a5278', '#3a6880'] },
]

const properties = [
  { name: 'GS25', price: 180000, color: '#b66b48' }, { name: 'CU', price: 220000, color: '#b66b48' },
  { name: 'Миний дэлгүүр', price: 260000, color: '#4b8d8c' }, { name: 'Woo Pizza & Burger', price: 310000, color: '#4b8d8c' },
  { name: 'Пирошки', price: 420000, color: '#3f637a', transport: true }, { name: 'KFC', price: 360000, color: '#c08a45' },
  { name: 'Шинэ Зайсан', price: 390000, color: '#c08a45' }, { name: 'Цэцэрлэгт хүрээлэн', price: 440000, color: '#6c5c88' },
  { name: "Ивэлт's лагар", price: 480000, color: '#6c5c88' }, { name: "Гүнээ's home", price: 520000, color: '#a44d68' },
]

const fmt = (value) => `${value.toLocaleString('mn-MN')} ₮`

function App() {
  const [selectedTheme, setSelectedTheme] = useState(themes[0])
  const [showGuest, setShowGuest] = useState(false)
  const [playerName, setPlayerName] = useState('')
  const [avatar, setAvatar] = useState('🦅')
  const [room, setRoom] = useState(null)
  const [apiError, setApiError] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const startGuest = async (event) => {
    event.preventDefault()
    if (!playerName.trim()) return
    setApiError('')
    setIsCreating(true)
    try {
      const sessionResponse = await fetch('/api/guest-sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: playerName, avatar }) })
      const session = await sessionResponse.json()
      if (!sessionResponse.ok) throw new Error(session.error || 'Зочны сесс үүссэнгүй.')
      const roomResponse = await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` }, body: JSON.stringify({}) })
      const createdRoom = await roomResponse.json()
      if (!roomResponse.ok) throw new Error(createdRoom.error || 'Өрөө үүссэнгүй.')
      localStorage.setItem('guestToken', session.token)
      setRoom(createdRoom)
      setShowGuest(false)
    } catch (error) {
      setApiError(error.message)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar"><div className="brand"><span className="brand-mark">₮</span><span>ТЭРБУМТАН <b>ONLINE</b></span></div><div className="top-actions"><button className="icon-button" title="Тусламж"><CircleHelp size={18} /></button><button className="ghost-button">Нэвтрэх</button><button className="gold-button" onClick={() => setShowGuest(true)}><Sparkles size={16} /> Зочноор тоглох</button></div></header>
      <section className="hero-copy"><div><p className="eyebrow">ОНЛАЙН БИЗНЕСИЙН СТРАТЕГИ</p><h1>Өөрийн хотыг<br /><em>бүтээ.</em></h1><p className="hero-text">Хөрөнгө оруулалт хийж, боломжийг атгаж, найзуудаасаа түрүүлэн тэрбумтан болоорой.</p><div className="hero-actions"><button className="gold-button large" onClick={() => setShowGuest(true)}>Тоглоом эхлүүлэх <ArrowRight size={18} /></button><button className="outline-button"><Users size={17} /> Өрөөнд нэгдэх</button></div></div><div className="hero-stats"><div><strong>2–6</strong><span>тоглогч</span></div><div><strong>40</strong><span>талбар</span></div><div><strong>∞</strong><span>боломж</span></div></div></section>
      <section className="board-section"><div className="section-heading"><div><p className="eyebrow">САМБАРЫН СОНГОЛТ</p><h2>Таны дараагийн алхам</h2></div><button className="text-button">Бүх самбар <ChevronRight size={16} /></button></div><div className="board-wrap"><div className="board" style={{ '--theme-accent': selectedTheme.accent }}><div className="board-corner start-corner"><span>ЭХЛЭЛ</span><strong>➜</strong><small>Нэг тойрогт +100,000 ₮</small></div>{properties.slice(0, 3).map((property) => <PropertyTile key={property.name} property={property} position="top" />)}<div className="board-corner pass-corner"><span>ТУСГАЙ</span><strong>↗</strong><small>Дахин тоглох эрх</small></div>{properties.slice(3, 6).map((property) => <PropertyTile key={property.name} property={property} position="right" />)}<div className="board-corner rest-corner"><span>АМРАЛТ</span><strong>☼</strong><small>Тайвшрах мөч</small></div>{properties.slice(6, 9).map((property) => <PropertyTile key={property.name} property={property} position="bottom" />)}<div className="board-corner prison-corner"><span>СААТУУЛАХ</span><strong>✦</strong><small>Дүрмээ шалга</small></div>{properties.slice(9).map((property) => <PropertyTile key={property.name} property={property} position="left" />)}<div className="board-center"><span className="center-kicker">ТЭРБУМТАН ONLINE</span><div className="center-icon">{selectedTheme.icon}</div><h3>{selectedTheme.name}</h3><p>{selectedTheme.subtitle}</p><div className="center-line" /></div></div></div></section>
      <section className="lower-grid"><div className="theme-panel"><div className="section-heading compact"><div><p className="eyebrow">ВИЗУАЛЫН ӨНГӨ</p><h2>Өөрийн уур амьсгалаа сонго</h2></div><Settings2 size={20} /></div><div className="theme-list">{themes.map((theme) => <button className={`theme-card ${selectedTheme.id === theme.id ? 'selected' : ''}`} key={theme.id} onClick={() => setSelectedTheme(theme)}><span className="theme-swatch" style={{ background: `linear-gradient(135deg, ${theme.colors.join(', ')})` }}>{theme.icon}</span><span><strong>{theme.name}</strong><small>{theme.subtitle}</small></span>{selectedTheme.id === theme.id && <span className="selected-dot" />}</button>)}</div></div><aside className="player-panel"><div className="panel-title"><span><Crown size={16} /> ТОГЛОГЧИЙН БҮС</span><span className="online-dot">● {room ? '1' : '0'} онлайн</span></div>{room ? <div className="player-row active"><span className="avatar">{avatar}</span><span><strong>{playerName}</strong><small>Өрөө үүсгэгч · {room.code}</small></span><span className="balance">{fmt(room.player.balance)}</span></div> : <div className="empty-player"><Users size={22} /><p>Энд тоглогчид нэгдэнэ</p><small>Өрөөгөө үүсгээд найзуудаа уриарай</small></div>}<button className="invite-button" onClick={() => setShowGuest(true)}><Plus size={16} /> Тоглогч урих</button></aside></section>
      <footer><span>© 2026 Тэрбумтан Online</span><span><LockKeyhole size={13} /> Зочны ахиц түр хадгалагдана</span><span><MessageCircle size={13} /> Дэмжлэг</span></footer>
      {showGuest && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowGuest(false)}><form className="guest-modal" onSubmit={startGuest}><button type="button" className="modal-close" onClick={() => setShowGuest(false)}><X size={18} /></button><p className="eyebrow">ШУУД ЭХЛҮҮЛЭХ</p><h2>Зочноор тоглох</h2><p className="modal-copy">Бүртгэлгүйгээр тоглоомд орно. Таны ахиц энэ төхөөрөмж дээр түр хадгалагдана.</p>{apiError && <p className="modal-error">{apiError}</p>}<label>Тоглогчийн нэр<input value={playerName} onChange={(event) => setPlayerName(event.target.value)} placeholder="Жишээ: Саруул" autoFocus maxLength={18} required /></label><label>Дүрээ сонгох<div className="avatar-picker">{['🦅', '🐎', '🐺', '🦌', '🐫'].map((item) => <button type="button" className={avatar === item ? 'avatar-choice active' : 'avatar-choice'} onClick={() => setAvatar(item)} key={item}>{item}</button>)}</div></label><button className="gold-button large" type="submit" disabled={isCreating}>{isCreating ? 'Холбогдож байна...' : 'Өрөө үүсгэх'} <ArrowRight size={18} /></button></form></div>}
    </main>
  )
}

function PropertyTile({ property, position }) {
  return <div className={`property-tile ${position}`}><span className="property-band" style={{ background: property.color }} />{property.transport ? <Dice5 size={21} /> : <Banknote size={19} />}<strong>{property.name}</strong><small>{fmt(property.price)}</small></div>
}

export default App
