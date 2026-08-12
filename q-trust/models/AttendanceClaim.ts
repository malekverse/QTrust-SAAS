import mongoose, { Schema, Document, Model } from 'mongoose'
import { CLAIM_STATUS } from '@/lib/constants'

export interface IAttendanceClaim extends Document {
  _id: mongoose.Types.ObjectId
  studentId: mongoose.Types.ObjectId
  sessionOccurrenceId: mongoose.Types.ObjectId
  date: Date
  reason: string
  status: string
  reviewedBy?: mongoose.Types.ObjectId
  reviewNotes?: string
  reviewedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const AttendanceClaimSchema = new Schema<IAttendanceClaim>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'الطالب مطلوب'],
      index: true
    },
    sessionOccurrenceId: {
      type: Schema.Types.ObjectId,
      ref: 'SessionOccurrence',
      required: [true, 'الحصة مطلوبة']
    },
    date: {
      type: Date,
      required: [true, 'التاريخ مطلوب']
    },
    reason: {
      type: String,
      required: [true, 'سبب الاعتراض مطلوب'],
      trim: true,
      maxlength: [500, 'السبب يجب أن لا يتجاوز 500 حرف']
    },
    status: {
      type: String,
      enum: Object.values(CLAIM_STATUS),
      default: CLAIM_STATUS.PENDING
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewNotes: {
      type: String,
      trim: true,
      maxlength: [500, 'ملاحظات المراجعة يجب أن لا تتجاوز 500 حرف']
    },
    reviewedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
)

AttendanceClaimSchema.index({ studentId: 1, date: -1 })
AttendanceClaimSchema.index({ status: 1 })
AttendanceClaimSchema.index({ studentId: 1, sessionOccurrenceId: 1 }, { unique: true })

const AttendanceClaim: Model<IAttendanceClaim> = mongoose.models.AttendanceClaim || mongoose.model<IAttendanceClaim>('AttendanceClaim', AttendanceClaimSchema)

export default AttendanceClaim
