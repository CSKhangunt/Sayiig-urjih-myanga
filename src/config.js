import { NETWORK_ERROR } from './apiErrors.js'
const configuredApiUrl = import.meta.env.VITE_API_URL || 'https://sayiig-urjih-myanga.onrender.com'
export const API_URL = configuredApiUrl.replace(/\/$/, '')
export const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || API_URL || window.location.origin).replace(/\/$/, '')
export const apiUrl = (path) => `${API_URL}${path}`
let tokenProvider = null
export const setTokenProvider = (provider) => { tokenProvider = provider }
export const getClerkToken = async () => tokenProvider ? tokenProvider() : null
export const apiFetch = async (url, options = {}) => {
  const token = await getClerkToken()
  const headers = new Headers(options.headers)
  if (token) headers.set('X-Clerk-Token', token)
  try {
    return await window.fetch(url, { ...options, headers })
  } catch {
    throw new Error(NETWORK_ERROR)
  }
}
