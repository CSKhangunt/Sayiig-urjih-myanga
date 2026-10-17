export function createAuthentication({ verifyToken, options, blocked, findSession, findRoom }) {
  const verify = async (token) => {
    if (typeof token !== 'string' || !token) throw new Error('Нэвтрэх шаардлагатай.')
    const claims = await verifyToken(token, options)
    if (!claims.sub || !Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now()) throw new Error('Нэвтрэлтийн хугацаа дууссан.')
    if (await blocked(claims.sub)) throw new Error('Бүртгэл устгагдаж байна.')
    return claims
  }
  const authenticateGame = async ({ token, clerkToken, roomCode }) => {
    const claims = await verify(clerkToken)
    if (typeof token !== 'string' || !/^[A-Z0-9]{6}$/.test(roomCode)) throw new Error('Өрөөний нэвтрэлт буруу.')
    const session = await findSession(token)
    if (!session || session.clerkId !== claims.sub || new Date(session.expiresAt).getTime() <= Date.now()) throw new Error('Тоглоомын нэвтрэлт хүчингүй.')
    const room = await findRoom(roomCode)
    if (!room || !room.players.some((player) => player.sessionHash === session.tokenHash)) throw new Error('Энэ өрөөнд нэгдэх эрхгүй байна.')
    return { claims, session, room }
  }
  return { verify, authenticateGame }
}
