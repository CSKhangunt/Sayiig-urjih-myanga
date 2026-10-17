export function serverEnvironment(environment) {
  const production = environment.NODE_ENV === 'production'
  const port = Number(environment.PORT || 3001)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT тохиргоо буруу.')
  if (production && (!environment.CLERK_SECRET_KEY || !environment.MONGODB_URI || !environment.CLIENT_ORIGIN)) throw new Error('Production орчинд CLERK_SECRET_KEY, MONGODB_URI, CLIENT_ORIGIN шаардлагатай.')
  const origins = (environment.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((entry) => entry.trim()).filter(Boolean)
  if (!origins.length) throw new Error('CLIENT_ORIGIN хоосон байна.')
  for (const origin of origins) {
    let url
    try { url = new URL(origin) } catch { throw new Error('CLIENT_ORIGIN зөв URL байх шаардлагатай.') }
    if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol) || (production && url.protocol !== 'https:')) throw new Error('Production origin HTTPS ашигласан, замгүй domain байх шаардлагатай.')
  }
  return { port, origins, production }
}
