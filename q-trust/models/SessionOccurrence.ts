import mongoose, { Schema, Document, Model } from 'mongoose'
import { SESSION_STATUS, type SessionStatus } from '@/lib/constants'

export interface ISessionOccurrence extends Document {
  _id: mongoose.Types.ObjectId
  tenantId: mongoose.Types.ObjectId
  sessionTemplateId: mongoose.Types.ObjectId
  teacherId: mongoose.Types.ObjectId
  date: Date // The specific date of this occurrence
  startDateTime: Date
  endDateTime: Date
  qrOpenDateTime: Date
  qrCloseDateTime: Date
  status: SessionStatus
  notes?: string
  createdAt: Date
  updatedAt: Date
}

const SessionOccurrenceSchema = new Schema<ISessionOccurrence>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    sessionTemplateId: {
      type: Schema.Types.ObjectId,
      ref: 'SessionTemplate',
      required: [true, 'قالب الحصة مطلوب']
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'المعلم مطلوب']
    },
    date: {
      type: Date,
      required: [true, 'تاريخ الحصة مطلوب']
    },
    startDateTime: {
      type: Date,
      required: [true, 'وقت البداية مطلوب']
    },
    endDateTime: {
      type: Date,
      required: [true, 'وقت النهاية مطلوب']
    },
    qrOpenDateTime: {
      type: Date,
      required: [true, 'وقت فتح QR مطلوب']
    },
    qrCloseDateTime: {
      type: Date,
      required: [true, 'وقت إغلاق QR مطلوب']
    },
    status: {
      type: String,
      enum: Object.values(SESSION_STATUS),
      default: SESSION_STATUS.SCHEDULED
    },
    notes: {
      type: String,
      maxlength: [500, 'الملاحظات يجب أن لا تتجاوز 500 حرف']
    }
  },
  {
    timestamps: true
  }
)

// Indexes for efficient querying (tenant-scoped)
SessionOccurrenceSchema.index({ tenantId: 1, sessionTemplateId: 1, date: 1 })
SessionOccurrenceSchema.index({ tenantId: 1, teacherId: 1, date: 1 })
SessionOccurrenceSchema.index({ tenantId: 1, date: 1, status: 1 })
SessionOccurrenceSchema.index({ tenantId: 1, qrOpenDateTime: 1, qrCloseDateTime: 1 })

// Compound index for finding active sessions during QR scanning
SessionOccurrenceSchema.index({
  tenantId: 1,
  qrOpenDateTime: 1,
  qrCloseDateTime: 1,
  status: 1
})

const SessionOccurrence: Model<ISessionOccurrence> = 
  mongoose.models.SessionOccurrence || mongoose.model<ISessionOccurrence>('SessionOccurrence', SessionOccurrenceSchema)

export default SessionOccurrence

