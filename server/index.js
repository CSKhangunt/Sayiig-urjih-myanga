import 'dotenv/config'
import cors from 'cors'
import crypto from 'node:crypto'
import http from 'node:http'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import mongoose from 'mongoose'
import { verifyToken, createClerkClient } from '@clerk/backend'
import { Presence } from './presence.js'
import { skins, validateProfile } from '../shared/cosmetics.js'
import { installInvitations } from './invitations.js'
import { createDeletionService } from './accountDeletion.js'
import { createAuthentication } from './authentication.js'
import { serverEnvironment } from './environment.js'
import { persistGameResults } from './gameResults.js'
import { Server } from 'socket.io'
import { auctionBid, auctionPass, buildProperty, buyProperty, cancelTrade, counterTrade, createGame, createTrade, declinePurchase, endTurn, mortgageProperty, payBail, removeAuctionBidder, removeDisconnectedTransactions, repayMortgage, respondToTrade, rollDice, sanitizeGame, sellBuilding, skipExpiredTurn, startGame, useJailCard } from './gameEngine.js'
import { normalizeRoomSettings, validateRoomCapacity, validateRoomSettings } from './roomSettings.js'

const app = express()
// Render terminates TLS and forwards the original client IP in X-Forwarded-For.
app.set('trust proxy', 1)
const { port, origins: allowedOrigins } = serverEnvironment(process.env)
const allowedAvatars = ['🦅', '🐎', '🐺', '🦌', '🐫']
const roomCodePattern = /^[A-Z0-9]{6}$/

const guestSessionSchema = new mongoose.Schema({
  clerkId: { type: String, index: true },
  tokenHash: { type: String, required: true, unique: true, index: true },
  displayName: { type: String, required: true, trim: true, maxlength: 18 },
  avatar: { type: String, required: true, enum: allowedAvatars },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true })


const profileSchema = new mongoose.Schema({
  username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  clerkId: { type: String, required: true, unique: true, index: true },
  displayName: { type: String, required: true, trim: true, maxlength: 18 },
  email: { type: String, trim: true, lowercase: true },
  avatar: { type: String, default: '🦅' },
  activeSkin: { type: String, default: 'steppe-free' },
  skins: { type: [String], default: ['steppe-free'] },
  lastSeenAt: { type: Date, default: Date.now },
}, { timestamps: true })
const friendSchema = new mongoose.Schema({
  pairKey: { type: String },
  requester: { type: String, required: true, index: true },
  recipient: { type: String, required: true, index: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
}, { timestamps: true })
friendSchema.index({ requester: 1, recipient: 1 }, { unique: true })
friendSchema.index({ pairKey: 1 }, { unique: true, partialFilterExpression: { pairKey: { $type: 'string' } } })

const roomSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true },
  inviteToken: { type: String, required: true, default: () => crypto.randomBytes(18).toString('hex') },
  hostSessionHash: { type: String, required: true },
  players: [{
    sessionHash: { type: String, required: true },
    displayName: { type: String, required: true, maxlength: 18 },
    avatar: { type: String, required: true },
    balance: { type: Number, required: true, min: 0 },
    connected: { type: Boolean, default: true },
  }],
  settings: {
    maxPlayers: { type: Number, min: 2, max: 8, default: 4 },
    startingCash: { type: Number, min: 500000, max: 5000000, default: 1500000 },
    auction: { type: Boolean, default: true },
    doubledSetRent: { type: Boolean, default: true },
    privateRoom: { type: Boolean, default: false },
    bots: { type: Boolean, default: false },
    map: { type: String, enum: ['Сонгодог'], default: 'Сонгодог' },
    vacationCash: { type: Boolean, default: false },
    noRentInPrison: { type: Boolean, default: false },
    mortgage: { type: Boolean, default: true },
    evenBuild: { type: Boolean, default: true },
    randomOrder: { type: Boolean, default: true },
    rules: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  status: { type: String, enum: ['lobby', 'playing', 'finished'], default: 'lobby' },
}, { timestamps: true })
roomSchema.index({ inviteToken: 1 }, { unique: true, partialFilterExpression: { inviteToken: { $type: 'string' } } })

const GuestSession = mongoose.model('GuestSession', guestSessionSchema)
const Profile = mongoose.model('Profile', profileSchema)
const Friend = mongoose.model('Friend', friendSchema)
const resultSchema = new mongoose.Schema({ gameId: { type: String, required: true }, clerkId: { type: String, required: true, index: true }, won: Boolean, completedAt: Date })
resultSchema.index({ gameId: 1, clerkId: 1 }, { unique: true })
const GameResult = mongoose.model('GameResult', resultSchema)
const snapshotSchema = new mongoose.Schema({ roomId: { type: String, unique: true, required: true }, state: mongoose.Schema.Types.Mixed }, { timestamps: true })
const GameSnapshot = mongoose.model('GameSnapshot', snapshotSchema)
const Room = mongoose.model('Room', roomSchema)
const httpServer = http.createServer(app)
const io = new Server(httpServer, { cors: { origin: allowedOrigins, credentials: true }, allowRequest: (request, callback) => callback(null, !request.headers.origin || allowedOrigins.includes(request.headers.origin)), pingInterval: 25000, pingTimeout: 20000, connectTimeout: 10000 })
const games = new Map()
const social = io.of('/social')
const authentication = createAuthentication({ verifyToken, options: { secretKey: process.env.CLERK_SECRET_KEY, jwtKey: process.env.CLERK_JWT_KEY, authorizedParties: allowedOrigins }, blocked: (id) => deletion.blocked(id), findSession: (token) => GuestSession.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } }), findRoom: (code) => Room.findOne({ code }) })
const deletion = createDeletionService({ mongoose,
  deleteIdentity: (id) => createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY }).users.deleteUser(id),
  disconnect: async (id) => {
    social.in(`user:${id}`).disconnectSockets(true)
    for (const socket of io.sockets.sockets.values()) if (socket.data.clerkId === id) socket.disconnect(true)
  },
  cleanup: async (id, savedHashes) => {
    const sessions = await GuestSession.find({ clerkId: id }).select('tokenHash')
    const hashes = [...new Set([...savedHashes, ...sessions.map((session) => session.tokenHash)])]
    for (const game of games.values()) for (const player of game.players) if (hashes.includes(player.id)) { player.name = 'Устгагдсан тоглогч'; player.avatar = '🦅'; player.connected = false }
    await Room.updateMany({ 'players.sessionHash': { $in: hashes } }, { $set: { 'players.$[player].displayName': 'Устгагдсан тоглогч', 'players.$[player].avatar': '🦅' } }, { arrayFilters: [{ 'player.sessionHash': { $in: hashes } }] })
    await GameSnapshot.updateMany({ 'state.players.id': { $in: hashes } }, { $set: { 'state.players.$[player].name': 'Устгагдсан тоглогч', 'state.players.$[player].avatar': '🦅', 'state.players.$[player].connected': false } }, { arrayFilters: [{ 'player.id': { $in: hashes } }] })
    // Delete sessions last: their hashes are needed to retry historical anonymization.
    await Profile.deleteOne({ clerkId: id })
    await Friend.deleteMany({ $or: [{ requester: id }, { recipient: id }] })
    await mongoose.model('GameInvitation').deleteMany({ $or: [{ inviterId: id }, { recipientId: id }] })
    await GameResult.deleteMany({ clerkId: id })
    await GuestSession.deleteMany({ clerkId: id })
  },
})
const deletionTimer = setInterval(() => { if (mongoose.connection.readyState === 1) void deletion.runOne().catch(() => console.error('Бүртгэл устгах дарааллыг шалгаж чадсангүй.')) }, 5000)
deletionTimer.unref()
const presence = new Presence({ changed: async (clerkId, online) => {
  try {
    if (!online) await Profile.updateOne({ clerkId }, { $set: { lastSeenAt: new Date() } })
    const links = await Friend.find({ status: 'accepted', $or: [{ requester: clerkId }, { recipient: clerkId }] }).lean()
    for (const link of links) social.to(`user:${link.requester === clerkId ? link.recipient : link.requester}`).emit('presence:changed', { clerkId, online })
  } catch { console.error('Төлөв шинэчилж чадсангүй.') }
} })
social.use(async (socket, next) => {
  try {
    const claims = await authentication.verify(socket.handshake.auth?.token)
    socket.data.clerkId = claims.sub
    if (await deletion.blocked(claims.sub)) return next(new Error('Бүртгэл устгагдаж байна.'))
    socket.data.expiresAt = claims.exp * 1000
    next()
  } catch { next(new Error('Нэвтрэлт хүчингүй байна.')) }
})
social.on('connection', (socket) => {
  const id = socket.data.clerkId
  socket.join(`user:${id}`)
  presence.connect(id, socket.id)
  const expiry = setTimeout(() => socket.disconnect(true), Math.max(0, socket.data.expiresAt - Date.now()))
  expiry.unref?.()
  socket.on('disconnect', () => { clearTimeout(expiry); presence.disconnect(id, socket.id) })
})

app.use(helmet())
app.use(cors({ origin: (origin, callback) => { if (!origin || allowedOrigins.includes(origin)) return callback(null, true); return callback(Object.assign(new Error('Origin зөвшөөрөгдөөгүй.'), { code: 'ORIGIN_DENIED' })) }, credentials: true }))
app.use(express.json({ limit: '16kb' }))
app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 100, message: { error: 'Хэт олон хүсэлт илгээгдлээ. Түр хүлээгээд дахин оролдоно уу.' } }))

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')
const cleanName = (name) => String(name || '').trim().replace(/[<>]/g, '')
const createRoomCode = () => crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase()
const createSessionResponse = async (user) => {
  const token = crypto.createHmac('sha256', process.env.CLERK_SECRET_KEY).update(`game-session:${user.clerkId}`).digest('hex')
  await GuestSession.findOneAndUpdate({ tokenHash: hashToken(token) }, { $set: { clerkId: user.clerkId, displayName: user.displayName, avatar: user.avatar, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } }, { upsert: true })
  return { token, displayName: user.displayName, avatar: user.avatar, email: user.email }
}

const requireDatabase = (request, response, next) => {
  if (mongoose.connection.readyState !== 1) {
    return response.status(503).json({ error: 'Өгөгдлийн сан одоогоор холбогдоогүй байна.' })
  }
  return next()
}

const requireClerk = async (request, response, next) => {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token || !process.env.CLERK_SECRET_KEY) return response.status(401).json({ error: 'Нэвтрэх шаардлагатай.' })
  try {
    const claims = await authentication.verify(token)
    request.clerkId = claims.sub
    if (await deletion.blocked(claims.sub)) return response.status(403).json({ error: 'Бүртгэл устгагдаж байна.' })
    request.clerkClaims = claims
    return next()
  } catch { return response.status(401).json({ error: 'Нэвтрэлтийн хугацаа дууссан байна.' }) }
}

app.get('/api/health', (request, response) => {
  const ready = mongoose.connection.readyState === 1 && Boolean(process.env.CLERK_SECRET_KEY)
  response.status(ready ? 200 : 503).json({ ok: ready, database: mongoose.connection.readyState === 1 ? 'холбогдсон' : 'холбогдоогүй' })
})

installInvitations(app, { mongoose, Room, Friend, Profile, GuestSession, requireDatabase, requireClerk, hashToken, social })

app.post('/api/clerk-session', requireDatabase, requireClerk, async (request, response) => {
  const body = request.body || {}
  const displayName = cleanName(body.displayName || 'Тоглогч').slice(0, 18) || 'Тоглогч'
  const avatar = allowedAvatars.includes(body.avatar) ? body.avatar : allowedAvatars[0]
  const profile = await Profile.findOneAndUpdate({ clerkId: request.clerkId }, { $set: { lastSeenAt: new Date() }, $setOnInsert: { username: `player_${crypto.createHash('sha256').update(request.clerkId).digest('hex').slice(0, 12)}`, displayName, avatar, activeSkin: 'steppe-free', skins: ['steppe-free'] } }, { upsert: true, returnDocument: 'after' })
  const session = await createSessionResponse({ clerkId: request.clerkId, displayName: profile.displayName, avatar: profile.avatar, email: profile.email || '' })
  await GuestSession.updateOne({ tokenHash: hashToken(session.token) }, { $set: { clerkId: request.clerkId } })
  return response.json({ ...session, clerkId: request.clerkId, profile: { displayName: profile.displayName, avatar: profile.avatar, activeSkin: profile.activeSkin, skins: profile.skins } })
})

app.use('/api/rooms', requireDatabase, async (request, response, next) => {
  try {
    const claims = await authentication.verify(request.headers['x-clerk-token'])
    if (await deletion.blocked(claims.sub)) return response.status(403).json({ error: 'Бүртгэл устгагдаж байна.' })
    if (request.method !== 'GET') {
      const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
      const session = token ? await GuestSession.findOne({ tokenHash: hashToken(token), clerkId: claims.sub, expiresAt: { $gt: new Date() } }) : null
      if (!session) return response.status(401).json({ error: 'Тоглоомын нэвтрэлт хүчингүй байна.' })
    }
    next()
  } catch { return response.status(401).json({ error: 'Тоглохын тулд нэвтэрнэ үү.' }) }
})

app.get('/api/profile', requireDatabase, requireClerk, async (request, response) => {
  const profile = await Profile.findOne({ clerkId: request.clerkId })
  if (!profile) return response.status(404).json({ error: 'Профайл олдсонгүй.' })
  const results = await GameResult.find({ clerkId: request.clerkId }).lean()
  const wins = results.filter((result) => result.won).length
  const statistics = { totalGames: results.length, wins, losses: results.length - wins, winRate: results.length ? Math.round(wins / results.length * 100) : 0 }
  await Profile.updateOne({ clerkId: request.clerkId }, { $set: { lastSeenAt: new Date() } })
  const relations = await Friend.find({ $or: [{ requester: request.clerkId }, { recipient: request.clerkId }] }).lean()
  const ids = relations.map((item) => item.requester === request.clerkId ? item.recipient : item.requester)
  const friends = await Profile.find({ clerkId: { $in: ids } }).select('clerkId displayName avatar lastSeenAt').lean()
  return response.json({ profile: { ...profile.toObject(), statistics }, friends: friends.map((friend) => ({ ...friend, relation: relations.find((item) => item.requester === friend.clerkId || item.recipient === friend.clerkId)?.status })) })
})

app.get('/api/friends/search', requireDatabase, requireClerk, async (request, response) => {
  const query = cleanName(request.query?.q).slice(0, 32)
  if (query.length < 2) return response.json({ players: [] })
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const players = await Profile.find({ clerkId: { $ne: request.clerkId }, $or: [{ displayName: { $regex: escaped, $options: 'i' } }, { username: { $regex: escaped, $options: 'i' } }] }).select('clerkId username displayName avatar lastSeenAt').limit(20).lean()
  return response.json({ players })
})

app.get('/api/skins', requireDatabase, requireClerk, async (request, response) => response.json({ skins }))
app.post('/api/skins/:id/claim', requireDatabase, requireClerk, async (request, response) => {
  const skin = skins.find((item) => item.id === request.params.id && item.free && item.available)
  if (!skin) return response.status(400).json({ error: 'Энэ дүрийг авах боломжгүй.' })
  const profile = await Profile.findOneAndUpdate({ clerkId: request.clerkId }, { $addToSet: { skins: skin.id } }, { returnDocument: 'after' })
  if (!profile) return response.status(404).json({ error: 'Профайл олдсонгүй.' })
  return response.json({ profile })
})
app.patch('/api/profile', requireDatabase, requireClerk, async (request, response) => {
  const profile = await Profile.findOne({ clerkId: request.clerkId })
  if (!profile) return response.status(404).json({ error: 'Профайл олдсонгүй.' })
  let update
  try { update = validateProfile(request.body || {}, profile.skins) } catch (error) { return response.status(400).json({ error: error.message }) }
  Object.assign(profile, update)
  try { await profile.save() } catch (error) { if (error.code === 11000) return response.status(409).json({ error: 'Энэ хэрэглэгчийн нэр бүртгэлтэй байна.' }); throw error }
  const sessions = await GuestSession.find({ clerkId: request.clerkId }).select('tokenHash')
  const hashes = new Set(sessions.map((session) => session.tokenHash))
  await GuestSession.updateMany({ clerkId: request.clerkId }, { $set: { displayName: profile.displayName, avatar: profile.avatar } })
  for (const game of games.values()) {
    let changed = false
    for (const player of game.players) if (hashes.has(player.id)) { player.activeSkin = profile.activeSkin; player.avatar = profile.avatar; changed = true }
    if (changed) io.to(game.roomCode).emit('game:state', sanitizeGame(game))
  }
  return response.json({ profile })
})

app.delete('/api/profile', requireDatabase, requireClerk, async (request, response) => {
  if (request.body?.confirmation !== 'УСТГАХ') return response.status(400).json({ error: 'Баталгаажуулахын тулд УСТГАХ гэж бичнэ үү.' })
  const age = request.clerkClaims.fva?.[0]
  if (typeof age !== 'number' || age < 0 || age > 10) return response.status(403).json({ error: 'Дахин нэвтэрч эрхээ баталгаажуулсны дараа устгана уу.' })
  const sessions = await GuestSession.find({ clerkId: request.clerkId }).select('tokenHash')
  await deletion.request(request.clerkId, sessions.map((session) => session.tokenHash))
  void deletion.runOne().catch(() => console.error('Бүртгэл устгах үйлдлийг дараа дахин оролдоно.'))
  return response.status(202).json({ status: 'pending' })
})

app.get('/api/friends/requests', requireDatabase, requireClerk, async (request, response) => {
  const requests = await Friend.find({ $or: [{ requester: request.clerkId }, { recipient: request.clerkId }] }).sort({ createdAt: -1 }).limit(100).lean()
  const ids = requests.map((item) => item.requester === request.clerkId ? item.recipient : item.requester)
  const profiles = await Profile.find({ clerkId: { $in: ids } }).select('clerkId displayName avatar lastSeenAt').lean()
  return response.json({ requests: requests.map((item) => { const other = profiles.find((profile) => profile.clerkId === (item.requester === request.clerkId ? item.recipient : item.requester)); return { ...item, other: other ? { ...other, online: presence.online(other.clerkId) } : null } }) })
})

app.post('/api/friends/request', requireDatabase, requireClerk, async (request, response) => {
  const target = String(request.body?.clerkId || '').trim()
  if (!target || target === request.clerkId) return response.status(400).json({ error: 'Зөв найзын профайл сонгоно уу.' })
  if (!await Profile.exists({ clerkId: target })) return response.status(404).json({ error: 'Профайл олдсонгүй.' })
  const existing = await Friend.findOne({ $or: [{ requester: request.clerkId, recipient: target }, { requester: target, recipient: request.clerkId }] })
  if (existing?.status === 'accepted') return response.status(409).json({ error: 'Та аль хэдийн найзууд болсон байна.' })
  if (existing?.status === 'pending') return response.status(409).json({ error: 'Найзын хүсэлт аль хэдийн илгээгдсэн байна.' })
  const pairKey = [request.clerkId, target].sort().join(':')
  let relation
  try {
    relation = existing ? await Friend.findOneAndUpdate({ _id: existing._id, status: 'rejected' }, { $set: { requester: request.clerkId, recipient: target, status: 'pending', pairKey } }, { returnDocument: 'after' }) : await Friend.create({ requester: request.clerkId, recipient: target, status: 'pending', pairKey })
  } catch (error) { if (error.code === 11000) return response.status(409).json({ error: 'Найзын хүсэлт аль хэдийн байна.' }); throw error }
  if (!relation) return response.status(409).json({ error: 'Хүсэлт өөрчлөгдсөн байна. Дахин ачаална уу.' })
  social.to(`user:${request.clerkId}`).to(`user:${target}`).emit('friends:changed')
  return response.json({ relation })
})

app.patch('/api/friends/:id', requireDatabase, requireClerk, async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(400).json({ error: 'Хүсэлтийн дугаар буруу.' })
  const requestedStatus = request.body?.status
  const status = ['accepted', 'rejected', 'cancelled'].includes(requestedStatus) ? requestedStatus : null
  if (!status) return response.status(400).json({ error: 'Буруу хүсэлтийн төлөв.' })
  const filter = status === 'cancelled' ? { _id: request.params.id, requester: request.clerkId, status: 'pending' } : { _id: request.params.id, recipient: request.clerkId, status: 'pending' }
  const relation = status === 'cancelled' ? await Friend.findOneAndDelete(filter) : await Friend.findOneAndUpdate(filter, { $set: { status } }, { returnDocument: 'after' })
  if (!relation) return response.status(404).json({ error: 'Найзын хүсэлт олдсонгүй.' })
  social.to(`user:${relation.requester}`).to(`user:${relation.recipient}`).emit('friends:changed')
  return response.json({ relation })
})

app.delete('/api/friends/:id', requireDatabase, requireClerk, async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(400).json({ error: 'Хүсэлтийн дугаар буруу.' })
  const relation = await Friend.findOneAndDelete({ _id: request.params.id, status: 'accepted', $or: [{ requester: request.clerkId }, { recipient: request.clerkId }] })
  if (!relation) return response.status(404).json({ error: 'Найзын холбоос олдсонгүй.' })
  social.to(`user:${relation.requester}`).to(`user:${relation.recipient}`).emit('friends:changed')
  return response.json({ ok: true })
})

app.post('/api/rooms', requireDatabase, async (request, response) => {
  const token = request.headers.authorization?.replace('Bearer ', '')
  const session = token ? await GuestSession.findOne({ tokenHash: hashToken(token) }) : null
  if (!session) return response.status(401).json({ error: 'Зочны сесс хүчингүй болсон байна. Дахин оролдоно уу.' })

  const validatedSettings = validateRoomSettings(request.body)
  const { maxPlayers, startingCash } = validatedSettings
  let code
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = createRoomCode()
    if (!(await Room.exists({ code: candidate }))) { code = candidate; break }
  }
  if (!code) return response.status(503).json({ error: 'Өрөөний код үүсгэж чадсангүй. Дахин оролдоно уу.' })

  const room = await Room.create({
    code,
    hostSessionHash: session.tokenHash,
    players: [{ sessionHash: session.tokenHash, displayName: session.displayName, avatar: session.avatar, balance: startingCash }],
    settings: {
      maxPlayers,
      startingCash,
      auction: request.body?.auction !== false,
      doubledSetRent: request.body?.doubledSetRent !== false,
      privateRoom: Boolean(request.body?.privateRoom),
      bots: false,
      map: validatedSettings.map,
      vacationCash: Boolean(request.body?.vacationCash),
      noRentInPrison: Boolean(request.body?.noRentInPrison),
      mortgage: request.body?.mortgage !== false,
      evenBuild: request.body?.evenBuild !== false,
      randomOrder: request.body?.randomOrder !== false,
    },
  })
  return response.status(201).json({ code: room.code, inviteToken: room.inviteToken, status: room.status, player: { displayName: session.displayName, avatar: session.avatar, balance: startingCash }, settings: room.settings })
})

app.get('/api/rooms', requireDatabase, async (request, response) => {
  const candidates = await Room.find({ status: 'lobby', 'settings.privateRoom': false, $expr: { $lt: [{ $size: '$players' }, '$settings.maxPlayers'] } })
    .select('code hostSessionHash players.sessionHash players.displayName players.avatar players.connected settings.maxPlayers status')
    .sort({ createdAt: -1 })
    .limit(100)
  const sessionHashes = candidates.flatMap((room) => room.players.map((player) => player.sessionHash))
  const activeSessions = await GuestSession.find({ tokenHash: { $in: sessionHashes }, expiresAt: { $gt: new Date() } }).select('tokenHash').lean()
  const activeHashes = new Set(activeSessions.map((session) => session.tokenHash))
  const activeRooms = candidates.filter((room) => room.players.some((player) => activeHashes.has(player.sessionHash)))
  const latestByHost = new Set()
  const duplicateRoomIds = []
  for (const room of activeRooms) {
    if (latestByHost.has(room.hostSessionHash)) duplicateRoomIds.push(room._id)
    else latestByHost.add(room.hostSessionHash)
  }
  const rooms = activeRooms.filter((room) => !duplicateRoomIds.some((id) => String(id) === String(room._id))).slice(0, 12)
  const emptyRoomIds = candidates.filter((room) => !activeRooms.includes(room)).map((room) => room._id)
  const staleRoomIds = [...emptyRoomIds, ...duplicateRoomIds]
  if (staleRoomIds.length) await Room.deleteMany({ _id: { $in: staleRoomIds } })
  return response.json({ rooms })
})

app.post('/api/rooms/:code/join', requireDatabase, async (request, response) => {
  const token = request.headers.authorization?.replace('Bearer ', '')
  const session = token ? await GuestSession.findOne({ tokenHash: hashToken(token) }) : null
  if (!session) return response.status(401).json({ error: 'Зочны сесс хүчингүй болсон байна. Дахин оролдоно уу.' })
  const code = request.params.code.toUpperCase()
  let room = await Room.findOne({ code })
  if (!room) return response.status(404).json({ error: 'Ийм өрөө олдсонгүй.' })
  if (room.status !== 'lobby') return response.status(409).json({ error: 'Энэ тоглоом аль хэдийн эхэлсэн байна.' })
  const inviteToken = request.body?.inviteToken || request.query?.invite
  if (room.settings.privateRoom && inviteToken !== room.inviteToken) return response.status(403).json({ error: 'Хувийн өрөөнд нэгдэхийн тулд хүчинтэй урилга шаардлагатай.' })
  const alreadyJoined = room.players.some((player) => player.sessionHash === session.tokenHash)
  if (!alreadyJoined && room.players.length >= room.settings.maxPlayers) return response.status(409).json({ error: 'Өрөө дүүрсэн байна.' })
  if (!alreadyJoined) {
    const joined = await Room.findOneAndUpdate({ _id: room._id, status: 'lobby', 'players.sessionHash': { $ne: session.tokenHash }, ...(room.settings.privateRoom ? { inviteToken } : {}), $expr: { $lt: [{ $size: '$players' }, '$settings.maxPlayers'] } }, { $push: { players: { sessionHash: session.tokenHash, displayName: session.displayName, avatar: session.avatar, balance: room.settings.startingCash } } }, { returnDocument: 'after' })
    if (!joined) return response.status(409).json({ error: 'Өрөө дүүрсэн, урилга өөрчлөгдсөн эсвэл тоглоом эхэлсэн.' })
    room = joined
  }
  return response.json({ code: room.code, inviteToken: room.inviteToken, status: room.status, player: { displayName: session.displayName, avatar: session.avatar, balance: room.settings.startingCash }, settings: room.settings })
})

app.patch('/api/rooms/:code/settings', requireDatabase, async (request, response) => {
  const token = request.headers.authorization?.replace('Bearer ', '')
  const session = token ? await GuestSession.findOne({ tokenHash: hashToken(token) }) : null
  const code = request.params.code.toUpperCase()
  const room = await Room.findOne({ code })
  if (!session || !room) return response.status(404).json({ error: 'Өрөө эсвэл зочны сесс олдсонгүй.' })
  if (room.hostSessionHash !== session.tokenHash) return response.status(403).json({ error: 'Зөвхөн өрөөний эзэмшигч тохиргоо өөрчилнө.' })
  if (room.status !== 'lobby') return response.status(409).json({ error: 'Тоглоом эхэлсэн тул тохиргоо түгжигдсэн.' })
  const body = request.body || {}
  const currentSettings = room.settings.toObject ? room.settings.toObject() : room.settings
  const normalized = normalizeRoomSettings({ ...currentSettings, ...body })
  validateRoomCapacity(normalized, room.players.length)
  room.settings.maxPlayers = normalized.maxPlayers
  room.settings.startingCash = normalized.startingCash
  if (body.rules !== undefined) room.settings.rules = normalized.rules
  ;['privateRoom', 'bots', 'vacationCash', 'auction', 'doubledSetRent', 'noRentInPrison', 'mortgage', 'evenBuild', 'randomOrder'].forEach((key) => {
    if (body[key] !== undefined) room.settings[key] = key === 'bots' ? false : Boolean(body[key])
  })
  room.settings.map = normalized.map
  await room.save()
  const game = games.get(code)
  if (game) game.settings = room.settings.toObject ? room.settings.toObject() : room.settings
  return response.json({ settings: room.settings })
})

app.get('/api/rooms/:code', requireDatabase, async (request, response) => {
  const code = request.params.code.toUpperCase()
  if (!roomCodePattern.test(code)) return response.status(400).json({ error: 'Өрөөний код буруу байна.' })
  const room = await Room.findOne({ code }).select('code players.displayName players.avatar players.connected settings status')
  if (!room) return response.status(404).json({ error: 'Ийм өрөө олдсонгүй.' })
  return response.json(room)
})

const getSocketToken = (socket) => socket.handshake.auth?.token
const loadingGames = new Map()
const getGame = async (roomCode) => {
  if (games.has(roomCode)) return games.get(roomCode)
  if (loadingGames.has(roomCode)) return loadingGames.get(roomCode)
  const loading = (async () => {
    const room = await Room.findOne({ code: roomCode })
    if (!room) return null
    const snapshot = await GameSnapshot.findOne({ roomId: String(room._id) }).lean()
    const game = snapshot?.state || createGame(room)
    if (snapshot) for (const player of game.players) player.connected = false
    game.persistenceId = String(room._id)
    games.set(roomCode, game)
    return game
  })()
  loadingGames.set(roomCode, loading)
  try { return await loading } finally { loadingGames.delete(roomCode) }
}

io.use(async (socket, next) => {
  try {
    const roomCode = String(socket.handshake.query.roomCode || '').toUpperCase()
    const { claims, session, room } = await authentication.authenticateGame({ token: getSocketToken(socket), clerkToken: socket.handshake.auth?.clerkToken, roomCode })
    socket.data.clerkId = claims.sub
    socket.data.expiresAt = claims.exp * 1000
    socket.data.sessionHash = session.tokenHash
    if (session.clerkId) socket.data.profile = await Profile.findOne({ clerkId: session.clerkId }).select('activeSkin avatar').lean()
    if (!room.players.some((player) => player.sessionHash === session.tokenHash)) return next(new Error('Энэ өрөөнд нэгдэх эрхгүй байна.'))
    socket.data.roomCode = roomCode
    socket.data.displayName = session.displayName
    next()
  } catch (error) {
    console.error('Game socket authentication failed:', { name: error?.name || 'Error', code: error?.code ?? 'none', message: error?.message || 'unknown' })
    next(new Error('Өрөөтэй холбогдож чадсангүй.'))
  }
})

io.on('connection', async (socket) => {
  console.log('Game socket connected:', { roomCode: socket.data.roomCode, hasSession: Boolean(socket.data.sessionHash) })
  const expiry = setTimeout(() => socket.disconnect(true), Math.max(0, socket.data.expiresAt - Date.now()))
  expiry.unref?.()
  socket.once('disconnect', () => clearTimeout(expiry))
  const { roomCode, sessionHash } = socket.data
  const game = await getGame(roomCode)
  if (!game) return socket.disconnect(true)
  const room = await Room.findOne({ code: roomCode })
  const roomPlayer = room?.players.find((item) => item.sessionHash === sessionHash)
  if (roomPlayer && !game.players.some((item) => item.id === sessionHash)) {
    game.players.push({ id: sessionHash, publicId: crypto.randomUUID(), name: roomPlayer.displayName, avatar: roomPlayer.avatar, balance: room.settings.startingCash, position: 0, connected: true, bankrupt: false })
  }
  socket.join(roomCode)
  const player = game.players.find((item) => item.id === sessionHash)
  if (player && socket.data.profile) { player.activeSkin = socket.data.profile.activeSkin; player.avatar = socket.data.profile.avatar }
  if (player) player.connected = true
  io.to(roomCode).emit('game:state', sanitizeGame(game))

  const replyError = (error) => socket.emit('game:error', { message: error.message || 'Үйлдэл амжилтгүй боллоо.' })
  const broadcast = () => io.to(roomCode).emit('game:state', sanitizeGame(game))

  socket.on('game:start', async () => {
    try { startGame(game, sessionHash); await Room.updateOne({ code: roomCode }, { $set: { status: game.status } }); broadcast() } catch (error) { replyError(error) }
  })
  socket.on('room:update-settings', async (payload = {}) => {
    try {
      const room = await Room.findOne({ code: roomCode })
      if (!room || room.hostSessionHash !== sessionHash) throw new Error('Зөвхөн өрөөний эзэмшигч тохиргоо өөрчилнө.')
      if (game.status !== 'lobby') throw new Error('Тоглоом эхэлсэн тул тохиргоо түгжигдсэн.')
      const next = payload.settings || {}
      const currentSettings = room.settings.toObject ? room.settings.toObject() : room.settings
      const normalized = normalizeRoomSettings({ ...currentSettings, ...next })
      validateRoomCapacity(normalized, room.players.length)
      room.settings.maxPlayers = normalized.maxPlayers
      room.settings.startingCash = normalized.startingCash
      if (next.rules !== undefined) room.settings.rules = normalized.rules
      ;['privateRoom', 'bots', 'vacationCash', 'auction', 'doubledSetRent', 'noRentInPrison', 'mortgage', 'evenBuild', 'randomOrder'].forEach((key) => { if (next[key] !== undefined) room.settings[key] = key === 'bots' ? false : Boolean(next[key]) })
      room.settings.map = normalized.map
      await room.save()
      game.settings = room.settings.toObject ? room.settings.toObject() : room.settings
      broadcast()
    } catch (error) { replyError(error) }
  })
  socket.on('game:roll', () => {
    try { rollDice(game, sessionHash); broadcast() } catch (error) { replyError(error) }
  })
  socket.on('game:buy', () => {
    try { buyProperty(game, sessionHash); broadcast() } catch (error) { replyError(error) }
  })
  socket.on('game:pay-bail', () => {
    try { payBail(game, sessionHash); broadcast() } catch (error) { replyError(error) }
  })
  socket.on('game:use-jail-card', (payload = {}) => {
    try { useJailCard(game, sessionHash, payload.cardId); broadcast() } catch (error) { replyError(error) }
  })
  socket.on('game:decline-buy', () => {
    try { declinePurchase(game, sessionHash); broadcast() } catch (error) { replyError(error) }
  })
  socket.on('auction:bid', (payload = {}) => {
    try { auctionBid(game, sessionHash, payload.amount); broadcast() } catch (error) { replyError(error) }
  })
  socket.on('auction:pass', () => {
    try { auctionPass(game, sessionHash); broadcast() } catch (error) { replyError(error) }
  })
  socket.on('game:end-turn', () => {
    try { endTurn(game, sessionHash); broadcast() } catch (error) { replyError(error) }
  })
  socket.on('game:build', (payload = {}) => {
    try { buildProperty(game, sessionHash, payload.propertyId); broadcast() } catch (error) { replyError(error) }
  })
  socket.on('game:sell-building', (payload = {}) => {
    try { sellBuilding(game, sessionHash, payload.propertyId); broadcast() } catch (error) { replyError(error) }
  })
  socket.on('game:mortgage', (payload = {}) => {
    try { mortgageProperty(game, sessionHash, payload.propertyId); broadcast() } catch (error) { replyError(error) }
  })
  socket.on('game:repay-mortgage', (payload = {}) => {
    try { repayMortgage(game, sessionHash, payload.propertyId); broadcast() } catch (error) { replyError(error) }
  })
  socket.on('trade:create', (payload = {}) => {
    try { createTrade(game, sessionHash, payload.targetId, payload.cashOffer, payload.propertyId, payload); broadcast() } catch (error) { replyError(error) }
  })
  socket.on('trade:respond', (payload = {}) => {
    try { respondToTrade(game, sessionHash, payload.tradeId, Boolean(payload.accepted), payload.version); broadcast() } catch (error) { replyError(error) }
  })
  socket.on('trade:cancel', (payload = {}) => {
    try { cancelTrade(game, sessionHash, payload.tradeId); broadcast() } catch (error) { replyError(error) }
  })
  socket.on('trade:counter', (payload = {}) => {
    try { counterTrade(game, sessionHash, payload.tradeId, payload); broadcast() } catch (error) { replyError(error) }
  })
  socket.on('chat:send', (message) => {
    const text = String(message || '').trim().slice(0, 160)
    if (!text) return
    io.to(roomCode).emit('chat:message', { name: socket.data.displayName, text, at: new Date().toISOString() })
  })
  socket.on('disconnect', () => {
    const otherConnection = [...io.sockets.sockets.values()].some((item) => item.id !== socket.id && item.data.sessionHash === sessionHash && item.data.roomCode === roomCode)
    if (otherConnection) return
    const disconnectedPlayer = game.players.find((item) => item.id === sessionHash)
    if (disconnectedPlayer) disconnectedPlayer.connected = false
    removeAuctionBidder(game, sessionHash)
    removeDisconnectedTransactions(game, sessionHash)
    broadcast()
  })
})

const recordingResults = new Set()
const savingSnapshots = new Set()
async function saveSnapshot(game) {
  if (!game.persistenceId || savingSnapshots.has(game.roomCode)) return
  savingSnapshots.add(game.roomCode)
  try { await GameSnapshot.updateOne({ roomId: game.persistenceId }, { $set: { state: JSON.parse(JSON.stringify(game)) } }, { upsert: true }) } catch { console.error('Тоглоомын төлөв хадгалж чадсангүй.') } finally { savingSnapshots.delete(game.roomCode) }
}
async function saveResults(game) {
  if (game.status !== 'finished' || game.resultsSaved || recordingResults.has(game.roomCode)) return
  recordingResults.add(game.roomCode)
  try {
    await persistGameResults({ game, GameResult, GuestSession, Room })
    game.resultsSaved = true
  } catch { console.error('Тоглоомын үр дүн хадгалж чадсангүй. Дахин оролдоно.') } finally { recordingResults.delete(game.roomCode) }
}
const gameTimer = setInterval(() => {
  games.forEach((game) => {
    if (skipExpiredTurn(game)) io.to(game.roomCode).emit('game:state', sanitizeGame(game))
    void saveResults(game)
    void saveSnapshot(game)
  })
}, 1000)

export default app

app.use((error, request, response, _next) => {
  console.error('API хүсэлт амжилтгүй:', error.name || 'Error')
  if (response.headersSent) return
  if (error.code === 'ORIGIN_DENIED') return response.status(403).json({ error: 'Энэ domain-оос хандах эрхгүй байна.' })
  if (error.code === 11000) return response.status(409).json({ error: 'Энэ мэдээлэл аль хэдийн бүртгэлтэй.' })
  if (error.name === 'ValidationError' || error.name === 'CastError' || error.type === 'entity.parse.failed') return response.status(400).json({ error: 'Илгээсэн мэдээлэл буруу байна.' })
  return response.status(500).json({ error: 'Серверийн алдаа гарлаа. Дахин оролдоно уу.' })
})

const shutdown = async (signal) => {
  clearInterval(deletionTimer)
  clearInterval(gameTimer)
  presence.close()
  console.log(`${signal}: серверийг зөөлөн унтрааж байна.`)
  const deadline = setTimeout(() => process.exit(1), 10000)
  deadline.unref()
  await Promise.all([...games.values()].map(async (game) => {
    await saveResults(game)
    await saveSnapshot(game)
  }))
  io.close()
  httpServer.close(async () => { await mongoose.connection.close(false); process.exit(0) })
}
process.once('SIGTERM', () => shutdown('SIGTERM'))
process.once('SIGINT', () => shutdown('SIGINT'))

function safeMongoError(error) {
  const message = String(error?.message || 'Unknown MongoDB error')
    .replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, '[redacted MongoDB URI]')
    .replace(/(password|passwd|pwd|secret|token)=([^\s&]+)/gi, '$1=[redacted]')
  return { name: error?.name || 'Error', code: error?.code ?? 'none', message }
}

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { maxPoolSize: 10, minPoolSize: 1, serverSelectionTimeoutMS: 10000 })
  } catch (error) {
    console.error('MongoDB connection failed:', safeMongoError(error))
    process.exitCode = 1
    clearInterval(gameTimer)
    return
  }

  try {
    for (const [modelName, model] of Object.entries(mongoose.models)) {
      try {
        if (modelName === 'Room') {
          await model.collection.dropIndex('inviteToken_1').catch((error) => {
            if (error?.code !== 27 && error?.codeName !== 'IndexNotFound') throw error
          })
          await model.collection.createIndex({ inviteToken: 1 }, { unique: true, partialFilterExpression: { inviteToken: { $type: 'string' } }, name: 'inviteToken_1' })
        }
        await model.init()
      } catch (error) {
        console.error(`MongoDB model initialization failed: ${modelName}`, safeMongoError(error))
        process.exitCode = 1
        clearInterval(gameTimer)
        return
      }
    }
  } catch (error) {
    console.error('MongoDB model initialization failed:', safeMongoError(error))
    process.exitCode = 1
    clearInterval(gameTimer)
    return
  }

  console.log('MongoDB connection and model initialization succeeded.')
  if (!process.env.VERCEL) httpServer.listen(port, () => console.log(`Тэрбумтан backend :${port}`))
}

if (process.env.MONGODB_URI) {
  void startServer()
} else if (false) {
  mongoose.connect(process.env.MONGODB_URI, { maxPoolSize: 10, minPoolSize: 1, serverSelectionTimeoutMS: 10000 })
    .catch((error) => { console.error(`MongoDB connection details: ${error?.name || 'Error'}: ${error?.message || 'unknown'} (code: ${error?.code || 'none'})`); throw error })
    .then(async () => { await Promise.all(Object.values(mongoose.models).map((model) => model.init())); console.log('MongoDB холболт амжилттай.'); if (!process.env.VERCEL) httpServer.listen(port, () => console.log(`Тэрбумтан backend :${port}`)) })
    .catch(() => { console.error('MongoDB холболт амжилтгүй.'); process.exitCode = 1; clearInterval(gameTimer) })
} else {
  console.error('MONGODB_URI тохируулагдаагүй байна. .env файл үүсгэнэ үү.')
}
