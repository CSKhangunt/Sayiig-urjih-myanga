export async function persistGameResults({ game, GameResult, GuestSession, Room }) {
  if (game.status !== 'finished' || !game.persistenceId) return false
  const sessions = await GuestSession.find({ tokenHash: { $in: game.players.map((player) => player.id) }, clerkId: { $exists: true } }).lean()
  for (const session of sessions) await GameResult.updateOne({ gameId: game.persistenceId, clerkId: session.clerkId }, { $setOnInsert: { won: session.tokenHash === game.winnerId, completedAt: new Date() } }, { upsert: true })
  await Room.updateOne({ code: game.roomCode }, { $set: { status: 'finished' } })
  return true
}
