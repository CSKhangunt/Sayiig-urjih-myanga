import { SignInButton, useAuth, useUser, UserButton } from '@clerk/clerk-react'
import { useEffect, useState } from 'react'
import Lobby from './Lobby.jsx'
import { apiUrl, setTokenProvider } from './config.js'
import InvitationsPanel from './InvitationsPanel.jsx'

export default function ClerkLobby() {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const { user } = useUser()
  const [account, setAccount] = useState(null)
  useEffect(() => { setTokenProvider(isSignedIn ? getToken : null); return () => setTokenProvider(null) }, [getToken, isSignedIn])
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) { localStorage.removeItem('guestToken'); sessionStorage.removeItem('accountToken'); setAccount(null); return }
    let cancelled = false
    getToken().then((token) => fetch(apiUrl('/api/clerk-session'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ displayName: user.fullName || user.username || 'Тоглогч', avatar: '🦁' }) })).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Профайл ачаалж чадсангүй.'); return data }).then((data) => { if (cancelled || !data.token) return; localStorage.setItem('guestToken', data.token); sessionStorage.setItem('accountToken', data.token); setAccount({ ...data, userId: user.id }) }).catch((error) => { if (!cancelled) setAccount({ userId: user.id, error: error.message }) })
    return () => { cancelled = true; localStorage.removeItem('guestToken'); sessionStorage.removeItem('accountToken') }
  }, [getToken, isLoaded, isSignedIn, user])
  const current = isSignedIn && account?.userId === user?.id ? account : null
  const clerkLogin = isLoaded && !isSignedIn ? <SignInButton mode="modal"><button type="button"><span>Нэвтрэх</span></button></SignInButton> : null
  return <>{current?.error && <p role="alert" className="game-error">{current.error}</p>}{current?.token && <InvitationsPanel key={user.id} account={current} getToken={getToken} />}<Lobby key={isSignedIn ? user?.id : 'signed-out'} clerkAccount={current?.token ? current : null} clerkUser={user} userButton={isSignedIn ? <UserButton afterSignOutUrl="/" /> : null} clerkLogin={clerkLogin} clerkGetToken={getToken} /></>
}
