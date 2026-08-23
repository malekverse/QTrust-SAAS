import mongoose, { Schema, Document, Model } from 'mongoose'

// Delivery ledger for platform emails. Mirrors MessageLog for
// WhatsApp/Twilio: every send writes a row (SENT / FAILED / SKIPPED) so
// the operator can see whether an email actually left the system without
// digging into the transport's own logs.
export type EmailLogStatus = 'SENT' | 'FAILED' | 'SKIPPED'

export const EMAIL_TEMPLATES = {
  TENANT_WELCOME_ACTIVATION: 'tenant_welcome_activation',
  ACCESS_REISSUE: 'access_reissue',
  NEW_LEAD_ALERT: 'new_lead_alert',
} as const
export type EmailTemplateKey = typeof EMAIL_TEMPLATES[keyof typeof EMAIL_TEMPLATES]

export interface IEmailLog extends Document {
  _id: mongoose.Types.ObjectId
  to: string
  subject: string
  template: EmailTemplateKey | string
  status: EmailLogStatus
  error?: string
  tenantId?: mongoose.Types.ObjectId
  targetUserId?: mongoose.Types.ObjectId
  createdBy?: mongoose.Types.ObjectId
  createdAt: Date
}

const EmailLogSchema = new Schema<IEmailLog>(
  {
    to: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    subject: { type: String, required: true, maxlength: 300 },
    template: { type: String, required: true, maxlength: 60 },
    status: { type: String, enum: ['SENT', 'FAILED', 'SKIPPED'], required: true },
    error: { type: String, maxlength: 1000 },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant' },
    targetUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

EmailLogSchema.index({ createdAt: -1 })
EmailLogSchema.index({ tenantId: 1, createdAt: -1 })
EmailLogSchema.index({ status: 1, createdAt: -1 })

const EmailLog: Model<IEmailLog> =
  mongoose.models.EmailLog || mongoose.model<IEmailLog>('EmailLog', EmailLogSchema)

export default EmailLog
