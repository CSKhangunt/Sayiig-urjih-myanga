import crypto from 'node:crypto'
import rateLimit from 'express-rate-limit'

export function installOAuth(app, { mongoose, GuestSession, createSessionResponse, allowedAvatars, clientOrigin, requireDatabase }) {
  const identities = mongoose.model('OAuthIdentity', new mongoose.Schema({
    provider: String, subject: String, displayName: String, avatar: String,
  }).index({ provider: 1, subject: 1 }, { unique: true }))
  const transactions = mongoose.model('OAuthTransaction', new mongoose.Schema({
    stateHash: { type: String, unique: true }, provider: String, verifier: String,
    expiresAt: { type: Date, index: { expires: 0 } },
  }))
  const digest = (s) => crypto.createHash('sha256').update(s).digest('hex')
  const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/api/auth' }
  const cookie = (req, name) => req.headers.cookie?.split(';').map((s) => s.trim()).find((s) => s.startsWith(`${name}=`))?.slice(name.length + 1)
  const base = (process.env.OAUTH_CALLBACK_BASE_URL || clientOrigin).replace(/\/$/, '')
  const version = process.env.FACEBOOK_GRAPH_VERSION || 'v23.0'
  const configs = {
    google: { id: process.env.GOOGLE_CLIENT_ID, secret: process.env.GOOGLE_CLIENT_SECRET, auth: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', profile: 'https://openidconnect.googleapis.com/v1/userinfo', scope: 'openid profile email' },
    facebook: { id: process.env.FACEBOOK_APP_ID, secret: process.env.FACEBOOK_APP_SECRET, auth: `https://www.facebook.com/${version}/dialog/oauth`, token: `https://graph.facebook.com/${version}/oauth/access_token`, profile: `https://graph.facebook.com/${version}/me?fields=id,name`, scope: 'public_profile' },
  }
  const fail = (res, code) => res.redirect(`${clientOrigin}/?auth_error=${code}`)
  const jsonFetch = async (url, options) => {
    const result = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) })
    const json = await result.json()
    if (!result.ok || json.error) throw new Error('Provider request failed')
    return json
  }
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60000, limit: 40, message: { error: 'Түр хүлээгээд дахин оролдоно уу.' } }))
  app.get('/api/auth/:provider/callback', requireDatabase, async (req, res) => {
    res.set('Cache-Control', 'no-store')
    const config = configs[req.params.provider]
    const state = req.query.state
    const browserState = cookie(req, 'oauth_state')
    res.clearCookie('oauth_state', cookieOptions)
    if (!config || typeof state !== 'string' || state !== browserState) return fail(res, 'invalid_state')
    const transaction = await transactions.findOneAndDelete({ stateHash: digest(state), provider: req.params.provider, expiresAt: { $gt: new Date() } })
    if (!transaction || req.query.error || typeof req.query.code !== 'string') return fail(res, 'cancelled')
    try {
      const params = new URLSearchParams({ client_id: config.id, client_secret: config.secret, code: req.query.code, redirect_uri: `${base}/api/auth/${req.params.provider}/callback`, grant_type: 'authorization_code' })
      if (req.params.provider === 'google') params.set('code_verifier', transaction.verifier)
      const token = await jsonFetch(config.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params })
      if (!token.access_token) throw new Error('Missing token')
      const profileUrl = new URL(config.profile)
      if (req.params.provider === 'facebook') profileUrl.searchParams.set('appsecret_proof', crypto.createHmac('sha256', config.secret).update(token.access_token).digest('hex'))
      const profile = await jsonFetch(profileUrl, { headers: { Authorization: `Bearer ${token.access_token}` } })
      const subject = req.params.provider === 'google' ? profile.sub : profile.id
      if (typeof subject !== 'string' || !subject) throw new Error('Missing identity')
      const displayName = String(profile.name || 'Тоглогч').replace(/[<>]/g, '').trim().slice(0, 18) || 'Тоглогч'
      // Provider IDs are identities; never automatically link accounts by an email claim.
      const identity = await identities.findOneAndUpdate({ provider: req.params.provider, subject }, { $setOnInsert: { displayName, avatar: allowedAvatars[0] } }, { upsert: true, new: true })
      const session = await createSessionResponse(identity)
      res.cookie('oauth_session', session.token, { ...cookieOptions, maxAge: 60000 })
      return res.redirect(`${clientOrigin}/?auth_success=1`)
    } catch { return fail(res, 'provider_failed') }
  })
  app.post('/api/auth/oauth-session', requireDatabase, async (req, res) => {
    res.set('Cache-Control', 'no-store')
    if (req.headers.origin !== clientOrigin) return res.sendStatus(403)
    const token = cookie(req, 'oauth_session')
    res.clearCookie('oauth_session', cookieOptions)
    const session = token && await GuestSession.findOne({ tokenHash: digest(token), expiresAt: { $gt: new Date() } })
    if (!session) return res.status(401).json({ error: 'Нэвтрэх хугацаа дууссан. Дахин оролдоно уу.' })
    return res.json({ token, displayName: session.displayName, avatar: session.avatar })
  })
  app.get('/api/auth/:provider', requireDatabase, async (req, res) => {
    const config = configs[req.params.provider]
    if (!config) return res.sendStatus(404)
    if (!config.id || !config.secret) return fail(res, 'not_configured')
    const state = crypto.randomBytes(32).toString('hex')
    const verifier = crypto.randomBytes(32).toString('base64url')
    await transactions.create({ provider: req.params.provider, stateHash: digest(state), verifier, expiresAt: new Date(Date.now() + 600000) })
    res.cookie('oauth_state', state, { ...cookieOptions, maxAge: 600000 })
    const url = new URL(config.auth)
    url.search = new URLSearchParams({ client_id: config.id, redirect_uri: `${base}/api/auth/${req.params.provider}/callback`, response_type: 'code', scope: config.scope, state }).toString()
    if (req.params.provider === 'google') {
      url.searchParams.set('code_challenge', crypto.createHash('sha256').update(verifier).digest('base64url'))
      url.searchParams.set('code_challenge_method', 'S256')
    }
    return res.redirect(url.toString())
  })
}
