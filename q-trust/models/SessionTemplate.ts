import mongoose, { Schema, Document, Model } from 'mongoose'
import { DEFAULT_QR_SETTINGS } from '@/lib/constants'

export interface ISessionTemplate extends Document {
  _id: mongoose.Types.ObjectId
  name: string
  teacherId: mongoose.Types.ObjectId
  roomId?: mongoose.Types.ObjectId
  dayOfWeek: number // 0-6 (Sunday to Saturday)
  startTime: string // "HH:mm" format
  endTime: string // "HH:mm" format
  qrOpenOffsetBeforeMin: number
  qrCloseOffsetAfterMin: number
  isActive: boolean
  effectiveFromDate: Date
  effectiveToDate?: Date
  description?: string
  createdAt: Date
  updatedAt: Date
}

const SessionTemplateSchema = new Schema<ISessionTemplate>(
  {
    name: {
      type: String,
      required: [true, 'اسم الحصة مطلوب'],
      trim: true,
      minlength: [2, 'اسم الحصة يجب أن يكون على الأقل حرفين'],
      maxlength: [100, 'اسم الحصة يجب أن لا يتجاوز 100 حرف']
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'المعلم مطلوب']
    },
    roomId: {
      type: Schema.Types.ObjectId,
      ref: 'Room'
    },
    dayOfWeek: {
      type: Number,
      required: [true, 'يوم الأسبوع مطلوب'],
      min: [0, 'يوم الأسبوع يجب أن يكون بين 0 و 6'],
      max: [6, 'يوم الأسبوع يجب أن يكون بين 0 و 6']
    },
    startTime: {
      type: String,
      required: [true, 'وقت البداية مطلوب'],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'صيغة الوقت غير صالحة (HH:mm)']
    },
    endTime: {
      type: String,
      required: [true, 'وقت النهاية مطلوب'],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'صيغة الوقت غير صالحة (HH:mm)']
    },
    qrOpenOffsetBeforeMin: {
      type: Number,
      default: DEFAULT_QR_SETTINGS.openOffsetBeforeMin,
      min: [0, 'لا يمكن أن تكون القيمة سالبة'],
      max: [60, 'لا يمكن أن تتجاوز 60 دقيقة']
    },
    qrCloseOffsetAfterMin: {
      type: Number,
      default: DEFAULT_QR_SETTINGS.closeOffsetAfterMin,
      min: [0, 'لا يمكن أن تكون القيمة سالبة'],
      max: [120, 'لا يمكن أن تتجاوز 120 دقيقة']
    },
    isActive: {
      type: Boolean,
      default: true
    },
    effectiveFromDate: {
      type: Date,
      required: [true, 'تاريخ البداية مطلوب']
    },
    effectiveToDate: {
      type: Date
    },
    description: {
      type: String,
      maxlength: [500, 'الوصف يجب أن لا يتجاوز 500 حرف']
    }
  },
  {
    timestamps: true
  }
)

// Indexes
SessionTemplateSchema.index({ teacherId: 1, isActive: 1 })
SessionTemplateSchema.index({ dayOfWeek: 1, isActive: 1 })
SessionTemplateSchema.index({ effectiveFromDate: 1, effectiveToDate: 1 })
SessionTemplateSchema.index({ roomId: 1, dayOfWeek: 1, isActive: 1 })

const SessionTemplate: Model<ISessionTemplate> = 
  mongoose.models.SessionTemplate || mongoose.model<ISessionTemplate>('SessionTemplate', SessionTemplateSchema)

export default SessionTemplate

