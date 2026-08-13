import mongoose, { Schema, Document, Model } from 'mongoose'

// One row per completed AI tool-calling round (LLM completion call). This is the
// per-tenant cost ledger: it lets the platform see Groq token spend per tenant
// and price the Premium tier sustainably. Distinct from the coarse
// Tenant.aiUsageCurrentMonth counter, which is the quota-enforcement tally.
export interface IAiUsageLog extends Document {
  _id: mongoose.Types.ObjectId
  tenantId: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  conversationId?: mongoose.Types.ObjectId
  route: 'chat' | 'execute'
  modelName: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  createdAt: Date
  updatedAt: Date
}

const AiUsageLogSchema = new Schema<IAiUsageLog>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation' },
    route: { type: String, enum: ['chat', 'execute'], required: true },
    modelName: { type: String, required: true },
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
  },
  { timestamps: true }
)

// Cost-per-tenant-over-time queries (super-admin Groq-spend dashboard).
AiUsageLogSchema.index({ tenantId: 1, createdAt: -1 })

const AiUsageLog: Model<IAiUsageLog> =
  mongoose.models.AiUsageLog || mongoose.model<IAiUsageLog>('AiUsageLog', AiUsageLogSchema)

export default AiUsageLog
