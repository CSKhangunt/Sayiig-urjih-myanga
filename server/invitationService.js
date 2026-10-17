export class InvitationError extends Error {
  constructor(message, status = 409) { super(message); this.status = status }
}

export async function respondInvitation({ connection, Invitation, Room, id, actorId, status, gameSession, now = () => new Date() }) {
  if (!['accepted', 'rejected', 'cancelled'].includes(status)) throw new InvitationError('Урилгын төлөв буруу.', 400)
  if (status === 'accepted' && !gameSession) throw new InvitationError('Тоглоомын нэвтрэлт хүчингүй.', 401)
  return connection.transaction(async (transaction) => {
    const timestamp = now()
    const invitation = await Invitation.findOneAndUpdate({ _id: id, status: 'pending', expiresAt: { $gt: timestamp }, [status === 'cancelled' ? 'inviterId' : 'recipientId']: actorId }, { $set: { status, respondedAt: timestamp } }, { returnDocument: 'after', session: transaction })
    if (!invitation) throw new InvitationError('Урилга олдсонгүй, өөрчлөгдсөн эсвэл хугацаа дууссан.', 409)
    let result
    if (status === 'accepted') {
      let room = await Room.findOne({ code: invitation.roomId, status: 'lobby' }).session(transaction)
      if (!room) throw new InvitationError('Өрөө хаагдсан эсвэл тоглоом эхэлсэн.')
      if (!room.players.some((player) => player.sessionHash === gameSession.tokenHash)) {
        room = await Room.findOneAndUpdate({ _id: room._id, status: 'lobby', 'players.sessionHash': { $ne: gameSession.tokenHash }, $expr: { $lt: [{ $size: '$players' }, '$settings.maxPlayers'] } }, { $push: { players: { sessionHash: gameSession.tokenHash, displayName: gameSession.displayName, avatar: gameSession.avatar, balance: room.settings.startingCash } } }, { returnDocument: 'after', session: transaction })
        if (!room) throw new InvitationError('Өрөө дүүрсэн эсвэл тоглоом эхэлсэн.')
      }
      result = { code: room.code, inviteToken: room.inviteToken, settings: room.settings, status: room.status, player: { displayName: gameSession.displayName, avatar: gameSession.avatar, balance: room.settings.startingCash } }
    }
    return { invitation, room: result }
  }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } })
}
