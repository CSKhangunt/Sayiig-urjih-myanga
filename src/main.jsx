import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ClerkLobby from './ClerkLobby.jsx'
import Lobby from './Lobby.jsx'
import { ClerkProvider } from '@clerk/clerk-react'
import { productionRedirect } from '../shared/deployment.js'

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

const redirect = productionRedirect(window.location)
if (redirect) window.location.replace(redirect)
else createRoot(document.getElementById('root')).render(
  <StrictMode>
    {publishableKey ? <ClerkProvider publishableKey={publishableKey}><ClerkLobby /></ClerkProvider> : <Lobby />}
  </StrictMode>,
)
