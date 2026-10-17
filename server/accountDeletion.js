import crypto from 'node:crypto'

export function createDeletionService({ mongoose, deleteIdentity, cleanup, disconnect }) {
  const schema = new mongoose.Schema({
    clerkId: { type: String, unique: true, required: true },
    status: { type: String, enum: ['pending', 'completed'], default: 'pending', index: true },
    attempts: { type: Number, default: 0 }, nextAttemptAt: { type: Date, default: Date.now },
    lockedUntil: { type: Date, default: () => new Date(0) }, lease: String, completedAt: Date,
    sessionHashes: [String],
  }, { timestamps: true })
  const Job = mongoose.models.AccountDeletion || mongoose.model('AccountDeletion', schema)
  const blocked = async (id) => Boolean(await Job.exists({ clerkId: id }))
  async function request(id, sessionHashes = []) {
    // Persist the tombstone before any remote mutation. It blocks all subsequent authentication.
    try { await Job.updateOne({ clerkId: id }, { $setOnInsert: { status: 'pending', nextAttemptAt: new Date(), lockedUntil: new Date(0) }, $addToSet: { sessionHashes: { $each: sessionHashes } } }, { upsert: true }) } catch (error) { if (error.code !== 11000) throw error }
    await disconnect(id)
  }
  async function runOne() {
    const lease = crypto.randomUUID()
    const now = new Date()
    const job = await Job.findOneAndUpdate({ status: 'pending', nextAttemptAt: { $lte: now }, lockedUntil: { $lte: now } }, { $set: { lease, lockedUntil: new Date(Date.now() + 60000) }, $inc: { attempts: 1 } }, { returnDocument: 'after' })
    if (!job) return false
    try {
      await disconnect(job.clerkId)
      try { await deleteIdentity(job.clerkId) } catch (error) { if (error.status !== 404 && error.statusCode !== 404) throw error }
      await cleanup(job.clerkId, job.sessionHashes || [])
      await Job.updateOne({ _id: job._id, lease }, { $set: { status: 'completed', completedAt: new Date(), lockedUntil: new Date(0) }, $unset: { lease: 1, sessionHashes: 1 } })
    } catch {
      // Never store remote error messages: they may contain private account data.
      await Job.updateOne({ _id: job._id, lease }, { $set: { lockedUntil: new Date(0), nextAttemptAt: new Date(Date.now() + Math.min(3600000, 1000 * 2 ** Math.min(job.attempts, 12))) }, $unset: { lease: 1 } })
    }
    return true
  }
  return { Job, blocked, request, runOne }
}
