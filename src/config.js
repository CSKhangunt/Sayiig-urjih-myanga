export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
export const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || API_URL || window.location.origin).replace(/\/$/, '')
export const apiUrl = (path) => `${API_URL}${path}`
let tokenProvider = null
export const setTokenProvider = (provider) => { tokenProvider = provider }
export const getClerkToken = async () => tokenProvider ? tokenProvider() : null
export const apiFetch = async (url, options = {}) => {
  const token = await getClerkToken()
  const headers = new Headers(options.headers)
  if (token) headers.set('X-Clerk-Token', token)
  return window.fetch(url, { ...options, headers })
}
