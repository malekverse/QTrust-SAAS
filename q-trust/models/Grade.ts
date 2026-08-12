import mongoose, { Schema, Document, Model } from 'mongoose'
import { GRADE_TYPE } from '@/lib/constants'

export interface IGrade extends Document {
  _id: mongoose.Types.ObjectId
  tenantId: mongoose.Types.ObjectId
  studentId: mongoose.Types.ObjectId
  sessionTemplateId?: mongoose.Types.ObjectId
  teacherId: mongoose.Types.ObjectId
  type: string
  title: string
  score: number
  maxScore: number
  date: Date
  notes?: string
  surah?: string
  fromVerse?: number
  toVerse?: number
  juz?: number
  createdAt: Date
  updatedAt: Date
}

const GradeSchema = new Schema<IGrade>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'الطالب مطلوب'],
      index: true
    },
    sessionTemplateId: {
      type: Schema.Types.ObjectId,
      ref: 'SessionTemplate'
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'المعلم مطلوب']
    },
    type: {
      type: String,
      enum: Object.values(GRADE_TYPE),
      required: [true, 'نوع التقييم مطلوب']
    },
    title: {
      type: String,
      required: [true, 'عنوان التقييم مطلوب'],
      trim: true,
      maxlength: [200, 'العنوان يجب أن لا يتجاوز 200 حرف']
    },
    score: {
      type: Number,
      required: [true, 'الدرجة مطلوبة'],
      min: [0, 'الدرجة لا يمكن أن تكون سالبة']
    },
    maxScore: {
      type: Number,
      required: [true, 'الدرجة القصوى مطلوبة'],
      min: [1, 'الدرجة القصوى يجب أن تكون على الأقل 1']
    },
    date: {
      type: Date,
      required: [true, 'التاريخ مطلوب']
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'الملاحظات يجب أن لا تتجاوز 500 حرف']
    },
    surah: {
      type: String,
      trim: true
    },
    fromVerse: {
      type: Number,
      min: 1
    },
    toVerse: {
      type: Number,
      min: 1
    },
    juz: {
      type: Number,
      min: 1,
      max: 30
    }
  },
  {
    timestamps: true
  }
)

GradeSchema.index({ tenantId: 1, studentId: 1, date: -1 })
GradeSchema.index({ tenantId: 1, studentId: 1, type: 1 })
GradeSchema.index({ tenantId: 1, teacherId: 1 })

const Grade: Model<IGrade> = mongoose.models.Grade || mongoose.model<IGrade>('Grade', GradeSchema)

export default Grade
