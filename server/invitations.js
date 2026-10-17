import { InvitationError, respondInvitation } from './invitationService.js'

export function installInvitations(app, { mongoose, Room, Friend, Profile, GuestSession, requireDatabase, requireClerk, hashToken, social }) {
  const schema = new mongoose.Schema({
    inviterId: { type: String, required: true, index: true }, recipientId: { type: String, required: true, index: true },
    roomId: { type: String, required: true }, status: { type: String, enum: ['pending', 'accepted', 'rejected', 'expired', 'cancelled'], default: 'pending' },
    expiresAt: { type: Date, required: true, index: true }, respondedAt: Date,
  }, { timestamps: true })
  schema.index({ inviterId: 1, recipientId: 1, roomId: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } })
  const Invitation = mongoose.model('GameInvitation', schema)
  const notify = (invitation, event) => social.to(`user:${invitation.recipientId}`).to(`user:${invitation.inviterId}`).emit(`invitation:${event}`, { id: invitation.id })
  const expire = async () => {
    const overdue = await Invitation.find({ status: 'pending', expiresAt: { $lte: new Date() } })
    for (const invitation of overdue) {
      const result = await Invitation.updateOne({ _id: invitation._id, status: 'pending' }, { $set: { status: 'expired', respondedAt: new Date() } })
      if (result.modifiedCount) notify(invitation, 'expired')
    }
  }
  const timer = setInterval(() => expire().catch(() => console.error('Урилгын хугацаа шинэчилж чадсангүй.')), 30000)
  timer.unref()
  app.get('/api/invitations', requireDatabase, requireClerk, async (req, res) => {
    await expire()
    const invitations = await Invitation.find({ $or: [{ recipientId: req.clerkId }, { inviterId: req.clerkId }], status: 'pending' }).sort({ createdAt: -1 }).limit(100).lean()
    const profiles = await Profile.find({ clerkId: { $in: invitations.map((item) => item.inviterId) } }).select('clerkId displayName avatar').lean()
    res.json({ invitations: invitations.map((item) => ({ ...item, inviter: profiles.find((profile) => profile.clerkId === item.inviterId) })) })
  })
  app.post('/api/invitations', requireDatabase, requireClerk, async (req, res) => {
    await expire()
    const recipientId = String(req.body?.recipientId || '')
    const roomId = String(req.body?.roomId || '').toUpperCase()
    const room = await Room.findOne({ code: roomId, status: 'lobby' })
    const token = req.headers['x-game-token']
    const session = typeof token === 'string' ? await GuestSession.findOne({ tokenHash: hashToken(token), clerkId: req.clerkId, expiresAt: { $gt: new Date() } }) : null
    if (!room || !session || !room.players.some((player) => player.sessionHash === session.tokenHash)) return res.status(403).json({ error: 'Урих боломжтой өрөө олдсонгүй.' })
    if (room.players.length >= room.settings.maxPlayers) return res.status(409).json({ error: 'Өрөө дүүрсэн байна.' })
    const friend = await Friend.exists({ status: 'accepted', $or: [{ requester: req.clerkId, recipient: recipientId }, { requester: recipientId, recipient: req.clerkId }] })
    if (!friend) return res.status(403).json({ error: 'Зөвхөн найзаа урьж болно.' })
    try {
      const invitation = await Invitation.create({ inviterId: req.clerkId, recipientId, roomId, expiresAt: new Date(Date.now() + 300000) })
      notify(invitation, 'received'); res.status(201).json({ invitation })
    } catch (error) { if (error.code === 11000) return res.status(409).json({ error: 'Урилга аль хэдийн илгээгдсэн.' }); throw error }
  })
  app.patch('/api/invitations/:id', requireDatabase, requireClerk, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Урилгын дугаар буруу.' })
    await expire()
    const status = req.body?.status
    if (!['accepted', 'rejected', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Урилгын төлөв буруу.' })
    const token = req.headers['x-game-token']
    const gameSession = status === 'accepted' && typeof token === 'string' ? await GuestSession.findOne({ tokenHash: hashToken(token), clerkId: req.clerkId, expiresAt: { $gt: new Date() } }) : null
    try {
      const result = await respondInvitation({ connection: mongoose.connection, Invitation, Room, id: req.params.id, actorId: req.clerkId, status, gameSession })
      notify(result.invitation, status)
      res.json(result)
    } catch (error) {
      if (error instanceof InvitationError) return res.status(error.status).json({ error: error.message })
      throw error
    }
  })
}
