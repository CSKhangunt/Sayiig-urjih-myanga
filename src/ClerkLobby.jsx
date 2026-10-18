import { SignInButton, useAuth, useUser, UserButton } from '@clerk/clerk-react'
import { useEffect, useState } from 'react'
import Lobby from './Lobby.jsx'
import { apiUrl, setTokenProvider } from './config.js'
import InvitationsPanel from './InvitationsPanel.jsx'
import ProfilePanel from './ProfilePanel.jsx'
import FriendsPanel from './FriendsPanel.jsx'
import './AccountTools.css'
import { readApiResponse, NETWORK_ERROR } from './apiErrors.js'

function RoomSignIn() {
  const [redirect, setRedirect] = useState(() => window.location.pathname + window.location.search)
  useEffect(() => {
    const update = () => setRedirect(window.location.pathname + window.location.search)
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])
  return <SignInButton mode="modal" forceRedirectUrl={redirect} signUpForceRedirectUrl={redirect}><button type="button"><span>Нэвтрэх</span></button></SignInButton>
}

export default function ClerkLobby() {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const { user } = useUser()
  const [account, setAccount] = useState(null)
  const [panel, setPanel] = useState(null)
  useEffect(() => { setTokenProvider(isSignedIn ? getToken : null); return () => setTokenProvider(null) }, [getToken, isSignedIn])
  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) { localStorage.removeItem('guestToken'); sessionStorage.removeItem('accountToken'); setAccount(null); return }
    if (!user) return
    let cancelled = false
    getToken().then((token) => {
      if (!token) throw new Error('HTTP 401: Нэвтрэлтийн token бэлэн болсонгүй. Дахин нэвтэрнэ үү.')
      return fetch(apiUrl('/api/clerk-session'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ displayName: user.fullName || user.username || 'Тоглогч', avatar: '🦅' }) }).catch(() => { throw new Error(NETWORK_ERROR) })
    }).then(readApiResponse).then((data) => { if (cancelled) return; if (!data.token) throw new Error('HTTP 502: Тоглоомын session ирсэнгүй.'); localStorage.setItem('guestToken', data.token); sessionStorage.setItem('accountToken', data.token); setAccount({ ...data, userId: user.id }) }).catch((error) => { if (!cancelled) setAccount({ userId: user.id, error: error.message }) })
    return () => { cancelled = true }
  }, [getToken, isLoaded, isSignedIn, user])
  const current = isSignedIn && account?.userId === user?.id ? account : null
  const clerkLogin = isLoaded && !isSignedIn ? <RoomSignIn /> : null
  const closePanel = () => setPanel(null)
  return <>
    {current?.error && <p role="alert" className="game-error">{current.error}</p>}
    <Lobby key={isSignedIn ? user?.id : 'signed-out'} clerkAccount={current?.token ? current : null} clerkUser={user} userButton={isSignedIn ? <UserButton afterSignOutUrl="/" /> : null} clerkLogin={clerkLogin} clerkGetToken={getToken} />
    {current?.token && <div className="account-tools" aria-label="Хэрэглэгчийн цэс">
      <button className={panel === 'invite' ? 'tool-button active' : 'tool-button'} onClick={() => setPanel(panel === 'invite' ? null : 'invite')}>✉️ Урилга</button>
      <button className={panel === 'friends' ? 'tool-button active' : 'tool-button'} onClick={() => setPanel(panel === 'friends' ? null : 'friends')}>👥 Найзууд</button>
      <button className={panel === 'profile' ? 'tool-button active' : 'tool-button'} onClick={() => setPanel(panel === 'profile' ? null : 'profile')}>👤 Профайл</button>
    </div>}
    {current?.token && panel && <div className="account-modal-backdrop" onClick={closePanel}><section className="account-modal" onClick={(event) => event.stopPropagation()}><button className="account-modal-close" onClick={closePanel} aria-label="Хаах">×</button>{panel === 'invite' && <InvitationsPanel key="invite" account={current} getToken={getToken} />}{panel === 'friends' && <FriendsPanel key="friends" account={current} getToken={getToken} />}{panel === 'profile' && <ProfilePanel key="profile" getToken={getToken} />}</section></div>}
  </>
}
