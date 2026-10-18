export const PRODUCTION_ORIGIN = 'https://sayiig-urjih-myanga.vercel.app'

export function productionRedirect(location) {
  if (location.hostname.endsWith('.vercel.app') && location.origin !== PRODUCTION_ORIGIN) {
    return `${PRODUCTION_ORIGIN}${location.pathname}${location.search}${location.hash}`
  }
  return null
}
