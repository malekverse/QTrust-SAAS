import mongoose, { Schema, Document, Model } from 'mongoose'
import { ATTENDANCE_STATUS, ATTENDANCE_CREATOR, type AttendanceStatus, type AttendanceCreator } from '@/lib/constants'

export interface IAttendance extends Document {
  _id: mongoose.Types.ObjectId
  studentId: mongoose.Types.ObjectId
  sessionOccurrenceId: mongoose.Types.ObjectId
  status: AttendanceStatus
  checkInTime?: Date
  createdBy: AttendanceCreator
  lastModifiedByUserId?: mongoose.Types.ObjectId
  lastModifiedAt?: Date
  notes?: string
  createdAt: Date
  updatedAt: Date
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'الطالب مطلوب']
    },
    sessionOccurrenceId: {
      type: Schema.Types.ObjectId,
      ref: 'SessionOccurrence',
      required: [true, 'الحصة مطلوبة']
    },
    status: {
      type: String,
      enum: Object.values(ATTENDANCE_STATUS),
      default: ATTENDANCE_STATUS.ABSENT
    },
    checkInTime: {
      type: Date
    },
    createdBy: {
      type: String,
      enum: Object.values(ATTENDANCE_CREATOR),
      required: true
    },
    lastModifiedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    lastModifiedAt: {
      type: Date
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

// Compound unique index to prevent duplicate attendance records
AttendanceSchema.index(
  { studentId: 1, sessionOccurrenceId: 1 }, 
  { unique: true }
)

// Index for session attendance reports
AttendanceSchema.index({ sessionOccurrenceId: 1, status: 1 })

// Index for student attendance history
AttendanceSchema.index({ studentId: 1, createdAt: -1 })

// Index for date-based reports
AttendanceSchema.index({ createdAt: 1, status: 1 })

const Attendance: Model<IAttendance> = 
  mongoose.models.Attendance || mongoose.model<IAttendance>('Attendance', AttendanceSchema)

export default Attendance

