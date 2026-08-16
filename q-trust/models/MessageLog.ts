import mongoose, { Schema, Document, Model } from 'mongoose'
import {
  MESSAGING_PROVIDER,
  MESSAGE_STATUS,
  MESSAGE_TYPE,
  type MessagingProvider,
  type MessageStatus,
  type MessageType,
} from '@/lib/constants'

// An audit record of every outbound message attempt (sent, failed, or skipped
// because no provider is configured). Answers "did the parent get notified?".
export interface IMessageLog extends Document {
  _id: mongoose.Types.ObjectId
  tenantId: mongoose.Types.ObjectId
  to: string
  type: MessageType
  provider: MessagingProvider
  status: MessageStatus
  body: string
  error?: string
  providerMessageId?: string
  studentId?: mongoose.Types.ObjectId
  createdByUserId?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const MessageLogSchema = new Schema<IMessageLog>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    to: { type: String, required: true, trim: true },
    type: { type: String, enum: Object.values(MESSAGE_TYPE), default: MESSAGE_TYPE.GENERAL },
    provider: { type: String, enum: Object.values(MESSAGING_PROVIDER), default: MESSAGING_PROVIDER.DISABLED },
    status: { type: String, enum: Object.values(MESSAGE_STATUS), required: true },
    body: { type: String, required: true, maxlength: 2000 },
    error: { type: String, maxlength: 1000 },
    providerMessageId: { type: String, trim: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student' },
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

MessageLogSchema.index({ tenantId: 1, createdAt: -1 })

const MessageLog: Model<IMessageLog> =
  mongoose.models.MessageLog || mongoose.model<IMessageLog>('MessageLog', MessageLogSchema)

export default MessageLog
