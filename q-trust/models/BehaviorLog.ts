import mongoose, { Schema, Document, Model } from 'mongoose'
import { BEHAVIOR_TYPE, type BehaviorType } from '@/lib/constants'

export interface IBehaviorLog extends Document {
  _id: mongoose.Types.ObjectId
  tenantId: mongoose.Types.ObjectId
  studentId: mongoose.Types.ObjectId
  teacherId: mongoose.Types.ObjectId
  sessionOccurrenceId?: mongoose.Types.ObjectId
  date: Date
  type: BehaviorType
  description: string
  createdAt: Date
  updatedAt: Date
}

const BehaviorLogSchema = new Schema<IBehaviorLog>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'الطالب مطلوب'],
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'المعلم مطلوب'],
    },
    sessionOccurrenceId: {
      type: Schema.Types.ObjectId,
      ref: 'SessionOccurrence',
    },
    date: {
      type: Date,
      required: [true, 'التاريخ مطلوب'],
    },
    type: {
      type: String,
      enum: Object.values(BEHAVIOR_TYPE),
      required: [true, 'نوع الملاحظة مطلوب'],
    },
    description: {
      type: String,
      required: [true, 'الوصف مطلوب'],
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true }
)

BehaviorLogSchema.index({ tenantId: 1, studentId: 1, date: -1 })
BehaviorLogSchema.index({ tenantId: 1, teacherId: 1, date: -1 })

const BehaviorLog: Model<IBehaviorLog> =
  mongoose.models.BehaviorLog || mongoose.model<IBehaviorLog>('BehaviorLog', BehaviorLogSchema)

export default BehaviorLog
