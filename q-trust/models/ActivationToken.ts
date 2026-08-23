import mongoose, { Schema, Document, Model } from 'mongoose'
import { createHash, randomBytes } from 'crypto'

// One-time activation token for setting a first (or re-issued) password.
//
// Design decisions:
//   - Only the sha256 hash of the token is stored — a DB read never yields
//     anything that can be used to authenticate.
//   - Unique index on `userId` so re-issuing replaces the previous token
//     atomically; there is at most one active token per user.
//   - TTL index on `expiresAt` — MongoDB auto-deletes the row when it
//     expires (72h by default). This works because "expired means gone".
//   - `sendCount` / `lastSentAt` power the AccessCard display without
//     needing a separate email-audit lookup.
export interface IActivationToken extends Document {
  _id: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  tenantId?: mongoose.Types.ObjectId
  tokenHash: string
  expiresAt: Date
  usedAt?: Date
  issuedBy: mongoose.Types.ObjectId
  issuedAt: Date
  sendCount: number
  lastSentAt?: Date
  purpose: 'activation' | 'reissue'
  createdAt: Date
  updatedAt: Date
}

const ActivationTokenSchema = new Schema<IActivationToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant' },
    tokenHash: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    usedAt: { type: Date },
    issuedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    issuedAt: { type: Date, default: () => new Date(), required: true },
    sendCount: { type: Number, default: 0 },
    lastSentAt: { type: Date },
    purpose: { type: String, enum: ['activation', 'reissue'], default: 'activation' },
  },
  { timestamps: true }
)

const ActivationToken: Model<IActivationToken> =
  mongoose.models.ActivationToken ||
  mongoose.model<IActivationToken>('ActivationToken', ActivationTokenSchema)

export default ActivationToken

// ─── Token helpers ───────────────────────────────────────────────────────

// Length in raw bytes (before base64url encoding). 32 bytes = 256 bits — more
// than enough to make guessing infeasible even with our IP-keyed rate limiter
// disabled.
const TOKEN_BYTES = 32

export function generateActivationToken(): { token: string; tokenHash: string } {
  const raw = randomBytes(TOKEN_BYTES)
  const token = raw
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return { token, tokenHash: hashToken(token) }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export const DEFAULT_ACTIVATION_TTL_MS = 72 * 60 * 60 * 1000 // 72h
