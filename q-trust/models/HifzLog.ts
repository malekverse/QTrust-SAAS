import mongoose, { Schema, Document, Model } from 'mongoose'
import {
  HIFZ_TYPE,
  HIFZ_QUALITY,
  type HifzType,
  type HifzQuality,
} from '@/lib/constants'

export interface IHifzLog extends Document {
  _id: mongoose.Types.ObjectId
  tenantId: mongoose.Types.ObjectId
  studentId: mongoose.Types.ObjectId
  teacherId: mongoose.Types.ObjectId
  sessionOccurrenceId?: mongoose.Types.ObjectId
  date: Date
  type: HifzType
  surah: string
  fromVerse: number
  toVerse: number
  quality: HifzQuality
  mistakeCount?: number
  notes?: string
  createdAt: Date
  updatedAt: Date
}

const HifzLogSchema = new Schema<IHifzLog>(
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
      enum: Object.values(HIFZ_TYPE),
      required: [true, 'نوع التسميع مطلوب'],
    },
    surah: {
      type: String,
      required: [true, 'اسم السورة مطلوب'],
      trim: true,
      maxlength: 50,
    },
    fromVerse: {
      type: Number,
      required: [true, 'رقم الآية الأولى مطلوب'],
      min: 1,
    },
    toVerse: {
      type: Number,
      required: [true, 'رقم الآية الأخيرة مطلوب'],
      min: 1,
    },
    quality: {
      type: String,
      enum: Object.values(HIFZ_QUALITY),
      required: [true, 'تقييم الجودة مطلوب'],
    },
    mistakeCount: {
      type: Number,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true }
)

HifzLogSchema.index({ tenantId: 1, studentId: 1, date: -1 })
HifzLogSchema.index({ tenantId: 1, teacherId: 1, date: -1 })
HifzLogSchema.index({ tenantId: 1, studentId: 1, type: 1, date: -1 })

const HifzLog: Model<IHifzLog> =
  mongoose.models.HifzLog || mongoose.model<IHifzLog>('HifzLog', HifzLogSchema)

export default HifzLog
