import { useCallback, useEffect, useState } from 'react'
import { apiUrl, SOCKET_URL } from './config.js'
import { io } from 'socket.io-client'
import './FriendsPanel.css'

export default function FriendsPanel({ account, getToken }) {
  const [relations, setRelations] = useState([])
  const [players, setPlayers] = useState([])
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const request = useCallback(async (path, options = {}) => {
    const token = await getToken()
    const response = await fetch(apiUrl(path), { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Хүсэлт амжилтгүй боллоо.')
    return data
  }, [getToken])
  const refresh = useCallback(async () => {
    const data = await request('/api/friends/requests')
    setRelations(data.requests)
  }, [request])
  useEffect(() => {
    let active = true
    const load = () => refresh().catch((error) => { if (active) setNotice(error.message) })
    load()
    const timer = setInterval(load, 15000)
    return () => { active = false; clearInterval(timer) }
  }, [refresh])
  useEffect(() => {
    const socket = io(`${SOCKET_URL}/social`, { autoConnect: false, auth: async (callback) => { try { callback({ token: await getToken() }) } catch { callback({}) } } })
    socket.on('presence:changed', ({ clerkId, online }) => setRelations((items) => items.map((item) => item.other?.clerkId === clerkId ? { ...item, other: { ...item.other, online } } : item)))
    socket.on('friends:changed', () => refresh().catch((error) => setNotice(error.message)))
    socket.on('connect_error', () => setNotice('Шууд холболт тасарсан. Жагсаалтыг түр хугацаанд давтан шалгаж байна.'))
    socket.on('disconnect', (reason) => { if (reason === 'io server disconnect') socket.connect() })
    socket.connect()
    return () => socket.disconnect()
  }, [getToken, refresh])
  async function act(path, method, body) {
    setBusy(true); setNotice('')
    try {
      await request(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) })
      await refresh(); setNotice('Амжилттай шинэчиллээ.')
    } catch (error) { setNotice(error.message) } finally { setBusy(false) }
  }
  async function search(event) {
    event.preventDefault(); setBusy(true); setNotice('')
    try { const data = await request(`/api/friends/search?q=${encodeURIComponent(query)}`); setPlayers(data.players); if (!data.players.length) setNotice('Тохирох тоглогч олдсонгүй.') } catch (error) { setNotice(error.message) } finally { setBusy(false) }
  }
  const friends = relations.filter((item) => item.status === 'accepted')
  const incoming = relations.filter((item) => item.status === 'pending' && item.recipient === account.clerkId)
  const outgoing = relations.filter((item) => item.status === 'pending' && item.requester === account.clerkId)
  const person = (item) => <span>{item.other?.avatar} {item.other?.displayName || 'Устгагдсан профайл'} · {item.other?.online ? 'Онлайн' : 'Офлайн'}</span>
  return <section className="social-panel" aria-label="Найзууд"><h2>Найзууд · {friends.length}</h2><form onSubmit={search}><label htmlFor="friend-search">Тоглогчийн нэрээр хайх</label><div><input id="friend-search" value={query} onChange={(event) => setQuery(event.target.value)} minLength={2} maxLength={32} required /><button disabled={busy}>Хайх</button></div></form>{notice && <p role="status">{notice}</p>}{players.map((player) => <div className="social-row" key={player.clerkId}><span>{player.avatar} {player.displayName}</span><button disabled={busy} onClick={() => act('/api/friends/request', 'POST', { clerkId: player.clerkId })}>Найз болох</button></div>)}<h3>Ирсэн хүсэлт · {incoming.length}</h3>{!incoming.length && <p>Ирсэн хүсэлт алга.</p>}{incoming.map((item) => <div className="social-row" key={item._id}>{person(item)}<div><button disabled={busy} onClick={() => act(`/api/friends/${item._id}`, 'PATCH', { status: 'accepted' })}>Зөвшөөрөх</button><button disabled={busy} onClick={() => act(`/api/friends/${item._id}`, 'PATCH', { status: 'rejected' })}>Татгалзах</button></div></div>)}<h3>Илгээсэн хүсэлт · {outgoing.length}</h3>{!outgoing.length && <p>Илгээсэн хүсэлт алга.</p>}{outgoing.map((item) => <div className="social-row" key={item._id}>{person(item)}<button disabled={busy} onClick={() => act(`/api/friends/${item._id}`, 'PATCH', { status: 'cancelled' })}>Цуцлах</button></div>)}<h3>Миний найзууд</h3>{!friends.length && <p>Тоглогч хайж найзын хүсэлт илгээгээрэй.</p>}{friends.map((item) => <div className="social-row" key={item._id}>{person(item)}<button disabled={busy} onClick={() => { if (window.confirm('Найзын жагсаалтаас хасах уу?')) act(`/api/friends/${item._id}`, 'DELETE') }}>Найзаас хасах</button></div>)}</section>
}
