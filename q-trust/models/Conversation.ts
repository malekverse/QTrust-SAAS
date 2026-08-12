import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
  result?: unknown
}

export interface IConversationMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  toolCalls?: IToolCall[]
  timestamp: Date
}

export interface IPendingAction {
  id: string
  toolName: string
  description: string
  params: Record<string, unknown>
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed'
  result?: unknown
  error?: string
  createdAt: Date
  resolvedAt?: Date
}

export interface IConversation extends Document {
  _id: mongoose.Types.ObjectId
  tenantId: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  title: string
  messages: IConversationMessage[]
  pendingActions: IPendingAction[]
  status: 'active' | 'archived'
  createdAt: Date
  updatedAt: Date
}

const ToolCallSchema = new Schema<IToolCall>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    arguments: { type: Schema.Types.Mixed, default: {} },
    result: { type: Schema.Types.Mixed },
  },
  { _id: false }
)

const ConversationMessageSchema = new Schema<IConversationMessage>(
  {
    role: {
      type: String,
      enum: ['user', 'assistant', 'system', 'tool'],
      required: true,
    },
    content: { type: String, default: '' },
    toolCalls: { type: [ToolCallSchema], default: undefined },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
)

const PendingActionSchema = new Schema<IPendingAction>(
  {
    id: { type: String, required: true },
    toolName: { type: String, required: true },
    description: { type: String, required: true },
    params: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'executed', 'failed'],
      default: 'pending',
    },
    result: { type: Schema.Types.Mixed },
    error: { type: String },
    createdAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date },
  },
  { _id: false }
)

const ConversationSchema = new Schema<IConversation>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: 'محادثة جديدة',
      maxlength: 200,
    },
    messages: {
      type: [ConversationMessageSchema],
      default: [],
    },
    pendingActions: {
      type: [PendingActionSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
  },
  { timestamps: true }
)

ConversationSchema.index({ tenantId: 1, userId: 1, status: 1, updatedAt: -1 })

const Conversation: Model<IConversation> =
  mongoose.models.Conversation ||
  mongoose.model<IConversation>('Conversation', ConversationSchema)

export default Conversation
