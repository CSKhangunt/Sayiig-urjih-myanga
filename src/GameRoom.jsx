import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ArrowLeftRight, Building2, Check, Copy, Crown, Dice5, MessageCircle, Play, Send, Settings2, Volume2, VolumeX, X } from 'lucide-react'
import { io } from 'socket.io-client'
import './GameRoom.css'
import './GameRoomPremium.css'
import './TradeBuilder.css'
import { BOARD_POSITIONS } from './boardLayout.js'
import { propertyAssets, specialAssets } from './propertyAssets.js'
import { audioManager } from './audioManager.js'
import { SOCKET_URL, getClerkToken } from './config.js'
import { skins } from '../shared/cosmetics.js'
import { mn } from './mn.js'

const DiceScene = lazy(() => import('./DiceScene.jsx'))

const tiles = [
  { id: 0, name: 'Эхлэл', type: 'start', icon: '➜' }, { id: 1, name: 'GS25', price: 180000, type: 'property', color: '#4caf50' }, { id: 2, name: 'Хонжвор', type: 'chance', icon: '▣' }, { id: 3, name: 'CU', price: 220000, type: 'property', color: '#4caf50' }, { id: 4, name: 'Орлогын татвар', type: 'tax', icon: '₮' }, { id: 5, name: 'Пирошки', price: 420000, type: 'transport', color: '#3f637a' }, { id: 6, name: 'Миний дэлгүүр', price: 260000, type: 'property', color: '#4b8d8c' }, { id: 7, name: 'Woo Pizza & Burger', price: 300000, type: 'property', color: '#4b8d8c' }, { id: 8, name: 'Гэнэтийн бэлэг', type: 'chance', icon: '?' }, { id: 9, name: 'My dent', price: 390000, type: 'property', color: '#c08a45' },
  { id: 10, name: 'Шорон', type: 'jail', icon: '▥' }, { id: 11, name: '21-ийн талбай', price: 200000, type: 'property', color: '#3f637a' }, { id: 12, name: 'Эфэс', price: 150000, type: 'utility', color: '#d7aa35' }, { id: 13, name: 'Цэцэрлэгт хүрээлэн', price: 240000, type: 'property', color: '#62a86a' }, { id: 14, name: 'Шинэ Зайсан', price: 280000, type: 'property', color: '#62a86a' }, { id: 15, name: 'KFC', price: 360000, type: 'transport', color: '#3f637a' }, { id: 16, name: "Ивэлт's лагар", price: 390000, type: 'property', color: '#c08a45' }, { id: 17, name: "Гүнээ's home", price: 420000, type: 'property', color: '#c08a45' }, { id: 18, name: "Тамира's home", price: 450000, type: 'property', color: '#6c5c88' }, { id: 19, name: 'Хонжвор', type: 'chance', icon: '▣' },
  { id: 20, name: 'Шоронд очих', type: 'jail', icon: '⚑' }, { id: 21, name: "Tugu's home", price: 280000, type: 'property', color: '#3f637a' }, { id: 22, name: 'Olymp', price: 270000, type: 'property', color: '#3f637a' }, { id: 23, name: 'Жүр Үр', price: 150000, type: 'utility', color: '#37a6c8' }, { id: 24, name: "Төвшү's home", price: 260000, type: 'property', color: '#3f637a' }, { id: 25, name: 'Халиартай хуушуур', price: 360000, type: 'transport', color: '#3f637a' }, { id: 26, name: "Kat's home", price: 240000, type: 'property', color: '#b84d62' }, { id: 27, name: "Иверлт's home", price: 220000, type: 'property', color: '#b84d62' }, { id: 28, name: 'Гэнэтийн бэлэг', type: 'chance', icon: '?' }, { id: 29, name: "Aza's home", price: 210000, type: 'property', color: '#b84d62' },
  { id: 30, name: 'Амралт', type: 'vacation', icon: '☼' }, { id: 31, name: 'Toyota Aqua', price: 290000, type: 'property', color: '#4b8d8c' }, { id: 32, name: 'Prius20', price: 300000, type: 'property', color: '#4b8d8c' }, { id: 33, name: 'Хонжвор', type: 'chance', icon: '▣' }, { id: 34, name: 'Prius30', price: 320000, type: 'property', color: '#4b8d8c' }, { id: 35, name: 'Ким Баб Чонгүг', price: 360000, type: 'transport', color: '#3f637a' }, { id: 36, name: 'Гэнэтийн бэлэг', type: 'chance', icon: '?' }, { id: 37, name: 'P-Gaming', price: 360000, type: 'property', color: '#6c5c88' }, { id: 38, name: 'Дээд зэрэглэлийн татвар', type: 'tax', icon: '₮' }, { id: 39, name: 'Meta-Gaming', price: 400000, type: 'property', color: '#6c5c88' },
]
const positions = BOARD_POSITIONS
const money = (value) => {
  const amount = Number(value || 0)
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(amount % 1000000 ? 1 : 0)}M ₮`
  if (amount >= 1000) return `${Math.round(amount / 1000)}K ₮`
  return `${amount} ₮`
}


export default function GameRoom({ room, player, onLeave }) {
  const socketRef = useRef(null)
  const [game, setGame] = useState(null)
  const [messages, setMessages] = useState([])
  const [chatText, setChatText] = useState('')
  const [error, setError] = useState('')
  const [eventNotice, setEventNotice] = useState('')
  const [revealedCard, setRevealedCard] = useState(null)
  const [rolling, setRolling] = useState(false)
  const [showTrade, setShowTrade] = useState(false)
  const [tradeTarget, setTradeTarget] = useState('')
  const [tradeCash, setTradeCash] = useState('0')
  const [tradeProperty, setTradeProperty] = useState('none')
  const [tradeOfferProperties, setTradeOfferProperties] = useState([])
  const [tradeRequestProperties, setTradeRequestProperties] = useState([])
  const [tradeRequestedCash, setTradeRequestedCash] = useState('0')
  const [tradeOfferCards, setTradeOfferCards] = useState([])
  const [tradeRequestCards, setTradeRequestCards] = useState([])
  const [turnSeconds, setTurnSeconds] = useState(0)
  const [audioSettings, setAudioSettings] = useState(() => audioManager.getSettings())
  const [showAudioSettings, setShowAudioSettings] = useState(false)
  const [soundMuted, setSoundMuted] = useState(() => audioManager.getSettings().muted)
  const [showRoomSettings, setShowRoomSettings] = useState(false)
  const [animatedPlayers, setAnimatedPlayers] = useState([])
  const animationSnapshot = useRef([])

  useEffect(() => {
    const socket = io(SOCKET_URL, { auth: async (callback) => { try { callback({ token: localStorage.getItem('guestToken'), clerkToken: await getClerkToken() }) } catch { callback({}) } }, query: { roomCode: room.code }, reconnection: true, reconnectionAttempts: Infinity, timeout: 10000 })
    socketRef.current = socket
    socket.on('game:state', setGame)
    socket.on('disconnect', (reason) => { if (reason === 'io server disconnect') socket.connect() })
    socket.on('game:error', (payload) => setError(payload.message))
    socket.on('chat:message', (message) => setMessages((current) => [...current.slice(-30), message]))
    socket.on('connect_error', (connectError) => setError(connectError.message || 'Өрөөтэй холбогдож чадсангүй.'))
    return () => socket.disconnect()
  }, [room.code])

  useEffect(() => {
    if (!game?.turnEndsAt) return undefined
    const updateTimer = () => setTurnSeconds(Math.max(0, Math.ceil((game.turnEndsAt - Date.now()) / 1000)))
    updateTimer()
    const timer = window.setInterval(updateTimer, 1000)
    return () => window.clearInterval(timer)
  }, [game?.turnEndsAt])

  useEffect(() => {
    if (!game?.players) return undefined
    const targetPlayers = game.players.map((item) => ({ ...item }))
    const previousPlayers = animationSnapshot.current
    const timers = []
    let duration = 0
    timers.push(window.setTimeout(() => setAnimatedPlayers(previousPlayers.length ? previousPlayers : targetPlayers), 0))
    for (const target of targetPlayers) {
      const previous = previousPlayers.find((item) => item.id === target.id)
      if (!previous || previous.position === target.position || target.bankrupt) continue
      const distance = (target.position - previous.position + 40) % 40
      if (distance === 0 || distance > 20) continue
      duration = Math.max(duration, distance * 190)
      for (let step = 1; step <= distance; step += 1) {
        timers.push(window.setTimeout(() => { audioManager.play('move'); setAnimatedPlayers((items) => items.map((item) => item.id === target.id ? { ...target, position: (previous.position + step) % 40 } : item)) }, step * 190))
      }
    }
    timers.push(window.setTimeout(() => setAnimatedPlayers(targetPlayers), duration + 1))
    animationSnapshot.current = targetPlayers
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [game?.players])

  useEffect(() => {
    if (!game?.dice || !rolling) return undefined
    const timer = window.setTimeout(() => { audioManager.play('dice-land'); setRolling(false) }, 1750)
    return () => window.clearTimeout(timer)
  }, [game?.dice, rolling])

  const previousGameRef = useRef(null)
  const seenEventRef = useRef(0)
  useEffect(() => {
    if (!game) return
    const previous = previousGameRef.current
    if (!previous) {
      seenEventRef.current = Math.max(0, ...(game.events || []).map((event) => event.id || 0))
      previousGameRef.current = game
      return
    }
    if (previous) {
      const newEvents = (game.events || []).filter((event) => event.id > seenEventRef.current)
      newEvents.forEach((event) => {
        if (event.type === 'purchase' || event.type === 'auction-win') audioManager.play('buy')
        if (event.type === 'auction-bid') audioManager.play('click')
        if (event.type === 'auction-close') audioManager.play('click')
        if (event.type === 'trade-complete') audioManager.play('money')
        if (event.type === 'victory') audioManager.play('win')
        if (event.type === 'bankruptcy' || event.type === 'payment') audioManager.play('pay')
        if (event.type === 'go') audioManager.play('start')
        if (event.type === 'jail') audioManager.play('jail')
        if (event.type === 'vacation') audioManager.play('vacation')
        if (event.type === 'card') { audioManager.play('card'); setRevealedCard({ ...event.card, deck: event.deck, cardId: event.cardId }) }
      })
      if (newEvents.length) {
        seenEventRef.current = Math.max(...newEvents.map((event) => event.id))
        const tradeEvent = newEvents.filter((event) => event.type.startsWith('trade-')).at(-1)
        if (tradeEvent) {
          const labels = { 'trade-offer': 'New trade offer received.', 'trade-rejected': 'Trade offer rejected.', 'trade-cancelled': 'Trade offer cancelled.', 'trade-expired': 'Trade offer expired.', 'trade-counter': 'Trade offer updated with a counteroffer.', 'trade-complete': 'Trade completed.' }
          setEventNotice(labels[tradeEvent.type] || 'Trade state updated.')
          window.setTimeout(() => setEventNotice(''), 4500)
        }
        const auctionEvent = newEvents.filter((event) => event.type === 'auction-close').at(-1)
        if (auctionEvent) {
          setEventNotice(auctionEvent.sold ? 'Auction closed — property sold.' : 'Auction closed — property remains unowned.')
          window.setTimeout(() => setEventNotice(''), 4500)
        }
      }
    }
    previousGameRef.current = game
  }, [game, player.displayName])

  const send = (event, payload) => {
    setError('')
    const nextPayload = event === 'trade:respond' && payload?.version === undefined
      ? { ...payload, version: game?.trades?.find((trade) => trade.id === payload.tradeId)?.version }
      : payload
    socketRef.current?.emit(event, nextPayload)
  }
  const sendChat = (event) => {
    event.preventDefault()
    if (chatText.trim()) send('chat:send', chatText.trim())
    setChatText('')
  }
  const handleRoll = () => {
    if (rolling) return
    audioManager.setSettings({ muted: soundMuted })
    audioManager.startMusic(); audioManager.play('dice-roll')
    setRolling(true)
    send('game:roll')
  }
  const currentPlayer = game?.players.find((item) => item.name === player.displayName)
  if (!game) return <main className="game-loading">Өрөөтэй холбогдож байна...</main>
  const tile = currentPlayer ? tiles[currentPlayer.position] : tiles[0]
  const canBuy = Boolean(game?.lastRoll?.playerName === player.displayName && ['property', 'transport', 'utility'].includes(tile.type) && !game.properties[tile.id] && !game.auction)
  const auctionTile = game.auction ? tiles[game.auction.propertyId] : null
  const isHost = game?.players?.[0]?.name === player.displayName
  const isMyTurn = game?.currentPlayerName === player.displayName
  const tileOwners = game.properties || {}
  const otherPlayers = game?.players.filter((item) => item.name !== player.displayName && !item.bankrupt) || []
  const ownedProperties = tiles.filter((item) => item.price && game.properties[item.id] === player.displayName)
  const incomingTrades = game.trades.filter((trade) => trade.toName === player.displayName)
  const ownedBuildable = ownedProperties.filter((item) => item.type === 'property')
  const submitTrade = () => {
    if (!tradeTarget) return setError('Арилжааны тоглогчоо сонгоно уу.')
    send('trade:create', { targetId: tradeTarget, cashOffer: Number(tradeCash) || 0, requestedCash: Number(tradeRequestedCash) || 0, propertyId: tradeProperty === 'none' ? null : Number(tradeProperty), properties: tradeOfferProperties, requestedProperties: tradeRequestProperties, cards: tradeOfferCards, requestedCards: tradeRequestCards })
    setShowTrade(false)
    setTradeCash('0')
    setTradeProperty('none')
    setTradeOfferProperties([]); setTradeRequestProperties([]); setTradeRequestedCash('0'); setTradeOfferCards([]); setTradeRequestCards([])
  }
  const counterOffer = (trade) => {
    setTradeTarget(trade.fromId); setTradeCash(String(trade.requestedCash || 0)); setTradeRequestedCash(String(trade.cashOffer || 0)); setTradeOfferProperties([...(trade.requestedProperties || [])]); setTradeRequestProperties([...(trade.properties || [])]); setTradeOfferCards([...(trade.requestedCards || [])]); setTradeRequestCards([...(trade.cards || [])]); setShowTrade(true)
    send('trade:cancel', { tradeId: trade.id })
  }
  const updateRoomSettings = (key, value) => {
    if (!isHost || game.status !== 'lobby') return
    send('room:update-settings', { settings: { ...game.settings, [key]: value } })
  }

  return <main className="game-shell">
    <aside className="game-sidebar left-sidebar">
      <div className="game-brand"><span>₮</span> ТЭРБУМТАН<span className="brand-fade">.io</span></div>
      <div className="share-card"><strong>Тоглоомоо хуваалцах</strong><div className="share-input">{window.location.origin}/room/{room.code}{room.settings?.privateRoom && room.inviteToken ? `?invite=${room.inviteToken}` : ''}<button onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/room/${room.code}${room.settings?.privateRoom && room.inviteToken ? `?invite=${room.inviteToken}` : ''}`)}><Copy size={14} /></button></div><small>Найздаа энэ холбоосыг илгээнэ үү</small></div>
      <div className="ad-space">зар сурталчилгаа</div>
      <section className="chat-panel"><div className="panel-heading"><span><MessageCircle size={15} /> Чат</span><button className="sound-toggle" title={soundMuted ? 'Дуу асаах' : 'Дуу унтраах'} onClick={() => { const next = !soundMuted; setSoundMuted(next); localStorage.setItem('terbumtanMuted', String(next)) }}>{soundMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}</button></div><div className="messages">{messages.length === 0 ? <small>Одоогоор мессеж алга</small> : messages.map((message, index) => <p key={`${message.at}-${index}`}><b>{message.name}</b>{message.text}</p>)}</div><form className="chat-form" onSubmit={sendChat}><input value={chatText} onChange={(event) => setChatText(event.target.value)} placeholder="Мессеж бичих..." maxLength={160} /><button><Send size={15} /></button></form></section>
      <section className="audio-settings-panel"><button className="mini-button" onClick={() => setShowAudioSettings((value) => !value)}><Volume2 size={13} /> Дууны тохиргоо</button>{showAudioSettings && <div className="audio-settings"><label>Ерөнхий дуу <input aria-label="Ерөнхий дууны түвшин" type="range" min="0" max="1" step="0.01" value={audioSettings.master} onChange={(event) => { const next = { ...audioSettings, master: Number(event.target.value) }; audioManager.setSettings(next); setAudioSettings(next) }} /></label><label>Үйлдлийн дуу <input aria-label="Үйлдлийн дууны түвшин" type="range" min="0" max="1" step="0.01" value={audioSettings.effects} onChange={(event) => { const next = { ...audioSettings, effects: Number(event.target.value) }; audioManager.setSettings(next); setAudioSettings(next) }} /></label><label>Хөгжмийн дуу <input aria-label="Хөгжмийн дууны түвшин" type="range" min="0" max="1" step="0.01" value={audioSettings.music} onChange={(event) => { const next = { ...audioSettings, music: Number(event.target.value) }; audioManager.setSettings(next); setAudioSettings(next) }} /></label><button className="mini-button" onClick={() => { const next = { ...audioSettings, muted: !audioSettings.muted }; audioManager.setSettings(next); setAudioSettings(next); setSoundMuted(next.muted) }}>{audioSettings.muted ? 'Дуу асаах' : 'Дуу унтраах'}</button></div>}</section>
    </aside>

    <section className="board-stage">
      <div className="stage-top"><span className="room-label">ӨРӨӨ {room.code}</span><span>{game.status === 'lobby' ? 'Тоглогчдыг хүлээж байна' : game.status === 'finished' ? `${game.winnerName} яллаа` : `Ээлж ${game.turn + 1} · ${game.turnEndsAt ? turnSeconds : 0}s`}</span></div>
      <div className="board-grid">{tiles.map((item, index) => <Tile key={item.id} tile={item} position={positions[index]} owner={tileOwners[item.id]} players={game.players} animatedPlayers={animatedPlayers.length ? animatedPlayers : game.players} houses={game.houses[item.id] || 0} />)}<div className="board-center"><Dice5 size={35} /><h1>{game.status === 'lobby' ? 'Өрөөгөө бэлдээрэй' : game.status === 'finished' ? `${game.winnerName} ялагч боллоо` : 'Эдийн засгийг удирд.'}</h1><Suspense fallback={<div className="dice-scene-placeholder">3D шоо бэлдэж байна...</div>}><DiceScene values={game.dice || [1, 1]} rolling={rolling} /></Suspense>{game.status === 'lobby' ? <div className="lobby-room-actions"><p className="turn-copy">{game.players.length} / {game.settings.maxPlayers} тоглогч нэгдсэн</p>{isHost ? <><button className="primary-action" onClick={() => setShowRoomSettings(true)}><Settings2 size={15} /> Өрөөний тохиргоо</button><button className="secondary-action" onClick={() => send('game:start')}><Play size={15} /> Тоглоом эхлүүлэх</button></> : <p className="turn-copy">Өрөөний эзэмшигч эхлүүлэхийг хүлээж байна.</p>}</div> : game.status === 'playing' && <><p className="turn-copy">{isMyTurn ? `Таны ээлж · ${game.turnEndsAt ? turnSeconds : 0} секунд` : `${game.currentPlayerName || 'Тоглогч'}-ийн ээлж`}</p>{isMyTurn && <div className="turn-actions"><button className="primary-action" onClick={handleRoll} disabled={Boolean(game.dice) || rolling}><Dice5 size={16} className={rolling ? 'spin-icon' : ''} /> {rolling ? 'Шоо эргэлдэж байна...' : 'Шоо хаях'}</button>{currentPlayer?.jail && <><button className="secondary-action" onClick={() => send('game:pay-bail')}>{mn.payBail} · {money(game.rules?.jailBail || 50000)}</button>{(currentPlayer.cards || []).filter((card) => String(card).includes('jail-free')).map((card) => <button className="secondary-action" key={card} onClick={() => send('game:use-jail-card', { cardId: card })}>{mn.jailCard}</button>)}</>}{canBuy && <button className="secondary-action" onClick={() => send('game:buy')}>Худалдаж авах · {money(tile.price)}</button>}{game.dice && <button className="secondary-action" onClick={() => send('game:end-turn')}>Ээлж дуусгах</button>}</div>}</>}</div></div>
      {error && <div className="game-error">{error}<button onClick={() => setError('')}><X size={13} /></button></div>}
      {eventNotice && <div className="game-notice">{eventNotice}<button onClick={() => setEventNotice('')}><X size={13} /></button></div>}
      {game.settings.auction && game.dice && !game.auction && game.lastRoll?.playerName === player.displayName && ['property', 'transport', 'utility'].includes(tile.type) && !game.properties[tile.id] && <button className="secondary-action decline-auction" onClick={() => send('game:decline-buy')}>Худалдан авахаас татгалзаж дуудлага худалдаа эхлүүлэх</button>}
      {ownedProperties.some((item) => game.houses[item.id] > 0) && <div className="asset-quick-actions">{ownedProperties.filter((item) => game.houses[item.id] > 0).map((item) => <button className="secondary-action" key={item.id} onClick={() => send('game:sell-building', { propertyId: item.id })}>Sell building · {item.name}</button>)}</div>}
      <div className="activity-log">{game.logs.slice(0, 3).map((log) => <p key={log}>{log}</p>)}</div>
      {game.auction && <AuctionModal auction={game.auction} tile={auctionTile} players={game.players} onBid={(amount) => send('auction:bid', { amount })} onPass={() => send('auction:pass')} />}
      {revealedCard && <CardRevealModal card={revealedCard} onClose={() => setRevealedCard(null)} />}
      {incomingTrades.length > 0 && <div className="incoming-trade-overlay">{incomingTrades.map((trade) => <IncomingTrade key={trade.id} trade={trade} allTiles={tiles} onAccept={() => send('trade:respond', { tradeId: trade.id, version: trade.version, accepted: true })} onReject={() => send('trade:respond', { tradeId: trade.id, version: trade.version, accepted: false })} onCounter={() => counterOffer(trade)} />)}</div>}
    </section>

    <aside className="game-sidebar right-sidebar"><div className="profile-card"><span className="profile-avatar">{player.avatar}</span><div><strong>{player.displayName}</strong><small>{isHost ? 'Өрөө үүсгэгч' : 'Тоглогч'}</small></div><Crown size={16} /></div><section className="settings-card"><div className="panel-heading"><span><Settings2 size={15} /> Тоглоомын тохиргоо</span>{isHost && game.status === 'lobby' && <button className="mini-button" onClick={() => setShowRoomSettings(true)}>Засах</button>}</div><SettingLine label="Тоглогчид" value={`${game.players.length} / ${game.settings.maxPlayers}`} /><SettingLine label="Самбар" value={game.settings.map} /><SettingLine label="x2 бүтэн багц" value={game.settings.doubledSetRent ? 'Идэвхтэй' : 'Унтраалттай'} /><SettingLine label="Дуудлага худалдаа" value={game.settings.auction ? 'Идэвхтэй' : 'Унтраалттай'} /><SettingLine label="Эхлэх мөнгө" value={money(game.settings.startingCash)} /></section><section className="players-card"><div className="panel-heading"><span><Crown size={15} /> Тоглогчид</span></div>{game.players.map((item) => <div className={`game-player ${item.name === game.currentPlayerName ? 'active-player' : ''}`} key={item.id}><span>{item.avatar}</span><div><strong>{item.name}</strong><small>{item.name === game.currentPlayerName ? 'Одоо ээлжтэй' : item.connected ? 'Холбогдсон' : 'Түр салсан'}</small></div><b>{money(item.balance)}</b></div>)}</section><section className="assets-card"><div className="panel-heading"><span><Building2 size={15} /> Миний хөрөнгө</span></div>{ownedBuildable.length === 0 ? <small className="trade-empty">Одоогоор хөрөнгө эзэмшээгүй.</small> : ownedBuildable.map((item) => <div className="asset-row" key={item.id}><span><b>{item.name}</b><small>{game.mortgaged[item.id] ? 'Ипотектэй' : `${game.houses[item.id] || 0} түвшин`}</small></span><div><button onClick={() => send(game.mortgaged[item.id] ? 'game:repay-mortgage' : 'game:mortgage', { propertyId: item.id })}>{game.mortgaged[item.id] ? 'Төлөх' : 'Ипотек'}</button>{!game.mortgaged[item.id] && <button onClick={() => send('game:build', { propertyId: item.id })}>Барих</button>}</div></div>)}</section><section className="trade-card"><div className="panel-heading"><span><ArrowLeftRight size={15} /> Арилжаа</span><button className="mini-button" onClick={() => setShowTrade(true)}><ArrowLeftRight size={13} /> Санал</button></div>{incomingTrades.length === 0 ? <small className="trade-empty">Тоглогчидтой хөрөнгө, мөнгө солилцоорой.</small> : incomingTrades.map((trade) => <div className="incoming-trade" key={trade.id}><span><b>{trade.fromName}</b> санал илгээлээ</span><div><button onClick={() => send('trade:respond', { tradeId: trade.id, accepted: true })}><Check size={13} /></button><button onClick={() => send('trade:respond', { tradeId: trade.id, accepted: false })}><X size={13} /></button></div></div>)}</section><button className="leave-button" onClick={onLeave}>{mn.lobby}</button></aside>
  {showTrade && <TradeBuilderModal players={otherPlayers} properties={ownedProperties} allTiles={tiles} game={game} playerName={player.displayName} target={tradeTarget} setTarget={setTradeTarget} cash={tradeCash} setCash={setTradeCash} requestedCash={tradeRequestedCash} setRequestedCash={setTradeRequestedCash} offerProperties={tradeOfferProperties} setOfferProperties={setTradeOfferProperties} requestProperties={tradeRequestProperties} setRequestProperties={setTradeRequestProperties} offerCards={tradeOfferCards} setOfferCards={setTradeOfferCards} requestCards={tradeRequestCards} setRequestCards={setTradeRequestCards} onClose={() => setShowTrade(false)} onSubmit={submitTrade} />}
    {showRoomSettings && <RoomSettingsModalPremium settings={game.settings} onChange={updateRoomSettings} onClose={() => setShowRoomSettings(false)} />}
  </main>
}

function Tile({ tile, position, owner, players, animatedPlayers = players, houses }) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const player = players.find((item) => item.name === owner)
  const occupants = animatedPlayers.filter((item) => item.position === tile.id && !item.bankrupt)
  const asset = propertyAssets[tile.id] || (specialAssets[tile.type] ? { src: specialAssets[tile.type], kind: 'special' } : null)
  const isPhoto = asset?.kind === 'photo'
  useEffect(() => {
    if (!previewOpen) return undefined
    const close = (event) => { if (event.key === 'Escape') setPreviewOpen(false) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [previewOpen])
  return <>
    <button className={`game-tile tile-${tile.type}`} style={{ gridArea: position, '--tile-color': tile.color || '#5b4b70' }} onClick={() => setPreviewOpen(true)} type="button">
      <span className={`tile-image-wrap ${isPhoto ? 'tile-photo' : 'tile-logo'}`}>{asset && <img className="tile-image" src={asset.src} alt="" loading="lazy" />}</span>
      <span className="tile-name">{tile.name}</span>{occupants.length > 0 && <span className="player-tokens">{occupants.map((item) => <span className="player-token" style={{ border: `2px solid ${skins.find((skin) => skin.id === item.activeSkin)?.color || '#38bdf8'}` }} key={item.id} title={item.name}>{item.avatar}</span>)}</span>}{tile.color && <span className="tile-band" />}
      {tile.price && <small>{money(tile.price)}</small>}
      {houses > 0 && <span className="house-chip">{houses === 5 ? '★' : '▴'.repeat(houses)}</span>}
      {player && <span className="owner-chip">{player.avatar}</span>}
    </button>
    {previewOpen && <div className="property-preview-layer" role="presentation" onClick={() => setPreviewOpen(false)}><section className="property-preview" role="dialog" aria-modal="true" aria-label={`${tile.name} дэлгэрэнгүй`} onClick={(event) => event.stopPropagation()}><button className="property-preview-close" type="button" onClick={() => setPreviewOpen(false)} aria-label="Хаах">×</button><div className="property-preview-art"><img src={asset?.src} alt="" /></div><div className="property-preview-copy"><span className="property-preview-group" style={{ background: tile.color || '#8b5cf6' }}>{tile.group || 'Тусгай нүд'}</span><h2>{tile.name}</h2>{tile.price ? <><p className="property-preview-price">Худалдан авах <strong>{money(tile.price)}</strong></p><p className="property-preview-detail">Түрээс: <strong>{money(tile.rent || 0)}</strong></p><p className="property-preview-detail">Барилга: <strong>{tile.buildCost ? money(tile.buildCost) : 'Боломжгүй'}</strong></p></> : <p className="property-preview-detail">{tile.description || 'Тусгай үйлдэлтэй нүд'}</p>}{tile.price && <p className="property-preview-detail">Эзэмшигч: <strong>{owner || 'Эзэмшээгүй'}</strong></p>}{tile.price && <p className="property-preview-detail">Байшин: <strong>{houses === 5 ? 'Зочид буудал' : `${houses} түвшин`}</strong></p>}</div></section></div>}
  </>
}

function SettingLine({ label, value }) {
  return <div className="setting-line"><span>{label}</span><strong>{value}</strong></div>
}

function IncomingTrade({ trade, allTiles, onAccept, onReject, onCounter }) {
  const propertyNames = (ids) => (ids || []).map((id) => allTiles.find((tile) => tile.id === Number(id))?.name || `Property ${id}`).join(', ') || 'None'
  const cardNames = (ids) => (ids || []).join(', ') || 'None'
  return <section className="trade-modal incoming-trade-modal"><div className="trade-modal-title"><ArrowLeftRight size={19} /><div><small>{trade.fromName}-ЭЭС ИРСЭН АРИЛЖААНЫ САНАЛ</small><h2>Саналыг шалгах</h2></div></div><div className="trade-detail"><strong>Тэр өгнө</strong><span>{money(trade.cashOffer || 0)} мөнгө</span><span>{propertyNames(trade.properties)}</span><span>{cardNames(trade.cards)}</span></div><div className="trade-detail"><strong>Та өгнө</strong><span>{money(trade.requestedCash || 0)} мөнгө</span><span>{propertyNames(trade.requestedProperties)}</span><span>{cardNames(trade.requestedCards)}</span></div><div className="trade-response-actions"><button className="primary-action" onClick={onAccept}><Check size={14} /> Зөвшөөрөх</button><button className="secondary-action" onClick={onCounter}><ArrowLeftRight size={14} /> Эсрэг санал</button><button className="secondary-action" onClick={onReject}><X size={14} /> Татгалзах</button></div></section>
}

function CardRevealModal({ card, onClose }) {
  const deckLabel = card.deck === 'chest' ? 'COMMUNITY CHEST' : 'CHANCE'
  const artwork = specialAssets.chance?.src
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])
  const amount = Number(card.amount || 0)
  const action = card.actionMn || (card.type === 'collect' ? `Receive ${money(amount)}` : card.type === 'pay' ? `Pay ${money(amount)}` : card.type === 'jail' ? 'Go directly to Jail' : card.type === 'get-out-of-jail' ? 'Keep this card until needed' : card.type === 'advance' ? 'Advance to the indicated space' : card.type === 'back' ? `Move back ${card.spaces || 0} spaces` : card.type === 'repairs' ? 'Pay property repair costs' : card.type === 'collect-from-players' ? `Collect ${money(amount)} from each player` : card.type === 'pay-each-player' ? `Pay ${money(amount)} to each player` : 'Resolve the card instruction')
  return <div className="card-reveal-layer" role="presentation" onClick={onClose}><section className="card-reveal" role="dialog" aria-modal="true" aria-label="Card reveal" onClick={(event) => event.stopPropagation()}><button className="card-reveal-close" type="button" onClick={onClose} aria-label="Close">×</button><div className={`card-reveal-art card-reveal-${card.deck || 'chance'}`}><img src={artwork} alt="" /><span>{card.deck === 'chest' ? '✦' : '★'}</span><small>{deckLabel}</small></div><div className="card-reveal-copy"><span className="card-reveal-kicker">{deckLabel}</span><h2>{card.titleMn || card.title || card.name || card.id}</h2><p>{card.textMn || card.text || card.description || 'A new instruction has been revealed.'}</p><strong>{action}</strong></div><button className="primary-action" onClick={onClose}>Continue</button></section></div>
}

function AuctionModal({ auction, tile, players, onBid, onPass }) {
  const [customBid, setCustomBid] = useState(String((auction.highestBid || 0) + 10000))
  const nextBid = Math.max(10000, auction.highestBid + 10000)
  const highest = players.find((item) => item.id === auction.highestBidderId)
  return <div className="trade-modal-layer auction-layer"><section className="trade-modal auction-modal"><div className="trade-modal-title"><Dice5 size={19} /><div><small>{mn.auction}</small><h2>{tile?.name || mn.property}</h2></div></div><div className="auction-price">{auction.highestBid ? money(auction.highestBid) : mn.noBids}<small>{highest ? `${mn.highestBidder}: ${highest.name}` : `${mn.originalPrice}: ${money(auction.price)}`}</small></div><div className="auction-players">{players.filter((item) => !item.bankrupt).map((item) => <span key={item.id} className={item.id === auction.highestBidderId ? 'auction-player active' : 'auction-player'}>{item.avatar} {item.name} · {money(item.balance)}</span>)}</div><div className="auction-actions"><button className="secondary-action" onClick={() => onBid(nextBid)}>{mn.bid} {money(nextBid)}</button><input type="number" min={nextBid} value={customBid} onChange={(event) => setCustomBid(event.target.value)} /><button className="primary-action" onClick={() => onBid(Number(customBid))}>{mn.customBid}</button><button className="secondary-action" onClick={onPass}>{mn.pass}</button></div></section></div>
}

function TradeBuilderModal({ players, properties, allTiles, game, playerName, target, setTarget, cash, setCash, requestedCash, setRequestedCash, offerProperties, setOfferProperties, requestProperties, setRequestProperties, offerCards, setOfferCards, requestCards, setRequestCards, onClose, onSubmit }) {
  const partner = players.find((item) => item.id === target)
  const partnerProperties = partner ? allTiles.filter((item) => item.price && game.properties[item.id] === partner.name) : []
  const mine = game.players.find((item) => item.name === playerName)?.cards || []
  const theirs = partner?.cards || []
  const toggle = (setter, values, id) => setter(values.includes(id) ? values.filter((value) => value !== id) : [...values, id])
  const list = (items, selected, setter) => <div className="trade-asset-list">{items.map((item) => <button type="button" key={item.id} className={selected.includes(item.id) ? 'trade-asset selected' : 'trade-asset'} onClick={() => toggle(setter, selected, item.id)}><span style={{ background: item.color || '#65418c' }} />{propertyAssets[item.id]?.src && <img src={propertyAssets[item.id].src} alt="" />}{item.name}<b>{money(item.price)}</b></button>)}{!items.length && <small className="trade-empty">Арилжаалах хөрөнгө алга</small>}</div>
  const cardList = (items, selected, setter) => items.length ? <div className="trade-card-select"><b>Картууд</b>{items.map((card) => <button type="button" key={card} className={selected.includes(card) ? 'selected' : ''} onClick={() => toggle(setter, selected, card)}>{card}</button>)}</div> : null
  return <div className="trade-modal-layer"><section className="trade-modal trade-builder"><button className="close-button" onClick={onClose}><X size={18} /></button><div className="trade-modal-title"><ArrowLeftRight size={19} /><div><small>ХӨРӨНГӨ АРИЛЖААЛАХ</small><h2>Арилжааны санал</h2></div></div><label>Арилжааны тоглогч<select value={target} onChange={(event) => setTarget(event.target.value)}><option value="">Тоглогч сонгох</option>{players.map((item) => <option value={item.id} key={item.id}>{item.avatar} {item.name} · {money(item.balance)}</option>)}</select></label><div className="trade-panels"><div><h3>Та өгнө</h3>{list(properties, offerProperties, setOfferProperties)}<label>Мөнгө<input aria-label="Өгөх мөнгө" type="number" min="0" step="10000" value={cash} onChange={(event) => setCash(event.target.value)} /></label>{cardList(mine, offerCards, setOfferCards)}</div><div><h3>Та авна</h3>{list(partnerProperties, requestProperties, setRequestProperties)}<label>Мөнгө<input aria-label="Авах мөнгө" type="number" min="0" step="10000" value={requestedCash} onChange={(event) => setRequestedCash(event.target.value)} /></label>{cardList(theirs, requestCards, setRequestCards)}</div></div><div className="trade-summary"><span>Өгөх: {money(Number(cash) || 0)} · {offerProperties.length} хөрөнгө</span><span>Авах: {money(Number(requestedCash) || 0)} · {requestProperties.length} хөрөнгө</span></div><button className="primary-action trade-submit" onClick={onSubmit} disabled={!target}><ArrowLeftRight size={15} /> Санал илгээх</button></section></div>
}

function RoomSettingsModalPremium({ settings, onChange, onClose }) {
  const toggle = (key) => onChange(key, !settings[key])
  const options = [2, 3, 4, 5, 6, 7, 8]
  const cash = [500000, 1000000, 1500000, 2000000, 2500000, 3000000]
  return <div className="trade-modal-layer"><section className="trade-modal room-settings-modal"><button className="close-button" onClick={onClose}><X size={18} /></button><div className="trade-modal-title"><Settings2 size={19} /><div><small>ТОГЛООМ ЭХЛЭХИЙН ӨМНӨХ ТОХИРГОО</small><h2>Тоглоомын тохиргоо</h2></div></div><div className="room-setting-control"><label>Тоглогчийн дээд тоо<small>Тоглоом эхлэхээс өмнө өрөөнд нэгдэх тоглогчдын тоог сонгоно.</small></label><select value={settings.maxPlayers} onChange={(event) => onChange('maxPlayers', Number(event.target.value))}>{options.map((value) => <option value={value} key={value}>{value} тоглогч</option>)}</select></div><div className="room-setting-control"><label>Самбарын зураг<small>Бүх тоглогч ижил самбар, нэршил болон дүрслэлийг харна.</small></label><select value={settings.map} onChange={(event) => onChange('map', event.target.value)}><option>Сонгодог</option><option>Улаанбаатар</option></select></div><div className="room-setting-control"><label>Эхлэх мөнгө<small>Тоглогч бүр тоглоом эхлэхэд энэ хэмжээний мөнгөтэй байна.</small></label><select value={settings.startingCash} onChange={(event) => onChange('startingCash', Number(event.target.value))}>{cash.map((value) => <option value={value} key={value}>{money(value)}</option>)}</select></div><div className="room-rules-list"><ToggleRoom label="Хувийн өрөө" checked={settings.privateRoom} onChange={() => toggle('privateRoom')} /><ToggleRoom label="Бот нэгдэхийг зөвшөөрөх (одоо боломжгүй)" checked={false} onChange={() => {}} disabled /><ToggleRoom label="Бүтэн багц эзэмшвэл түрээс 2 дахин нэмэгдэх" checked={settings.doubledSetRent} onChange={() => toggle('doubledSetRent')} /><ToggleRoom label="Амралтын талбайн мөнгө" checked={settings.vacationCash} onChange={() => toggle('vacationCash')} /><ToggleRoom label="Худалдаж аваагүй хөрөнгийг дуудлагаар худалдах" checked={settings.auction} onChange={() => toggle('auction')} /><ToggleRoom label="Хоригдож байх үед түрээс төлөхгүй" checked={settings.noRentInPrison} onChange={() => toggle('noRentInPrison')} /><ToggleRoom label="Ипотек ашиглах" checked={settings.mortgage} onChange={() => toggle('mortgage')} /><ToggleRoom label="Барилгыг тэнцвэртэй нэмэх" checked={settings.evenBuild} onChange={() => toggle('evenBuild')} /><ToggleRoom label="Тоглогчдын дарааллыг санамсаргүй сонгох" checked={settings.randomOrder} onChange={() => toggle('randomOrder')} /></div><p className="settings-saved">Эдгээр тохиргоог зөвхөн өрөөний эзэмшигч өөрчилнө. Тоглоом эхэлсний дараа тохиргоо түгжигдэнэ.</p></section></div>
}

function ToggleRoom({ label, checked, onChange, disabled = false }) {
  return <label className={`toggle-room ${disabled ? 'disabled' : ''}`}><span>{label}</span><input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} /><i /></label>
}

