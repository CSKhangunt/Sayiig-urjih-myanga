import { useCallback, useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { apiUrl, SOCKET_URL } from './config.js'

export default function InvitationsPanel({ getToken, account }) {
  const [invitations, setInvitations] = useState([])
  const [friends, setFriends] = useState([])
  const [recipientId, setRecipientId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(apiUrl(path), { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getToken()}`, 'X-Game-Token': localStorage.getItem('guestToken') || '' } })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Урилгыг шинэчилж чадсангүй.')
    return data
  }, [getToken])
  const refresh = useCallback(async () => {
    const [invites, relations] = await Promise.all([request('/api/invitations'), request('/api/friends/requests')])
    setInvitations(invites.invitations); setFriends(relations.requests.filter((item) => item.status === 'accepted' && item.other))
  }, [request])
  useEffect(() => {
    const socket = io(`${SOCKET_URL}/social`, { auth: async (callback) => callback({ token: await getToken() }) })
    const load = () => refresh().catch((error) => setNotice(error.message))
    load()
    for (const state of ['received', 'accepted', 'rejected', 'expired', 'cancelled']) socket.on(`invitation:${state}`, () => { setNotice('Тоглоомын урилга шинэчлэгдлээ.'); load() })
    socket.on('friends:changed', load)
    const timer = setInterval(load, 30000)
    return () => { clearInterval(timer); socket.disconnect() }
  }, [getToken, refresh])
  async function action(path, body) {
    setBusy(true)
    try {
      const data = await request(path, { method: path === '/api/invitations' ? 'POST' : 'PATCH', body: JSON.stringify(body) })
      if (data.room) window.dispatchEvent(new CustomEvent('game:invitation-joined', { detail: data.room }))
      await refresh(); setNotice('Амжилттай.')
    } catch (error) { setNotice(error.message) } finally { setBusy(false) }
  }
  return <details className="social-panel"><summary>Тоглоомын урилга · {invitations.filter((item) => item.recipientId === account.clerkId).length}</summary><form onSubmit={(event) => { event.preventDefault(); action('/api/invitations', { recipientId, roomId }) }}><label>Найз<select required value={recipientId} onChange={(event) => setRecipientId(event.target.value)}><option value="">Найз сонгох</option>{friends.map((item) => <option key={item._id} value={item.other.clerkId}>{item.other.displayName}</option>)}</select></label><label>Таны нэгдсэн өрөөний код<input required pattern="[A-Za-z0-9]{6}" maxLength={6} value={roomId} onChange={(event) => setRoomId(event.target.value.toUpperCase())} /></label><button disabled={busy}>Тоглоомд урих</button></form>{notice && <p role="status">{notice}</p>}{!invitations.length && <p>Хүлээгдэж буй урилга алга.</p>}{invitations.map((item) => <div className="social-row" key={item._id}><span>{item.inviter?.displayName} · Өрөө {item.roomId}</span>{item.recipientId === account.clerkId ? <div><button disabled={busy} onClick={() => action(`/api/invitations/${item._id}`, { status: 'accepted' })}>Нэгдэх</button><button disabled={busy} onClick={() => action(`/api/invitations/${item._id}`, { status: 'rejected' })}>Татгалзах</button></div> : <button disabled={busy} onClick={() => action(`/api/invitations/${item._id}`, { status: 'cancelled' })}>Цуцлах</button>}</div>)}</details>
}
