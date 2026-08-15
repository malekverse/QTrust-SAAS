import mongoose, { Schema, Document, Model } from 'mongoose'
import { ADMISSION_STATUS, type AdmissionStatus } from '@/lib/constants'

// A public enrollment request. Created unauthenticated via the tenant's public
// enroll page; reviewed by a tenant ADMIN who can approve it into a real Student.
export interface IAdmissionApplication extends Document {
  _id: mongoose.Types.ObjectId
  tenantId: mongoose.Types.ObjectId
  firstName: string
  lastName: string
  gender: 'MALE' | 'FEMALE'
  cin?: string
  dateOfBirth?: Date
  educationLevel?: string
  address?: string
  parentName?: string
  parentPhone?: string
  parentEmail?: string
  medicalNotes?: string
  status: AdmissionStatus
  reviewNotes?: string
  reviewedByUserId?: mongoose.Types.ObjectId
  reviewedAt?: Date
  convertedStudentId?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const AdmissionApplicationSchema = new Schema<IAdmissionApplication>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    firstName: { type: String, required: [true, 'الاسم مطلوب'], trim: true, maxlength: 50 },
    lastName: { type: String, required: [true, 'اللقب مطلوب'], trim: true, maxlength: 50 },
    gender: { type: String, enum: ['MALE', 'FEMALE'], required: [true, 'الجنس مطلوب'] },
    cin: {
      type: String,
      trim: true,
      validate: {
        validator: (v: string) => !v || /^\d{8}$/.test(v),
        message: 'رقم بطاقة التعريف يجب أن يكون 8 أرقام',
      },
    },
    dateOfBirth: { type: Date },
    educationLevel: { type: String, trim: true, maxlength: 100 },
    address: { type: String, trim: true, maxlength: 200 },
    parentName: { type: String, trim: true, maxlength: 100 },
    parentPhone: {
      type: String,
      trim: true,
      validate: {
        validator: (v: string) => !v || /^\+216\d{8}$/.test(v),
        message: 'رقم الهاتف يجب أن يكون بصيغة +216XXXXXXXX',
      },
    },
    parentEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'البريد الإلكتروني غير صالح'],
    },
    medicalNotes: { type: String, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: Object.values(ADMISSION_STATUS),
      default: ADMISSION_STATUS.PENDING,
    },
    reviewNotes: { type: String, trim: true, maxlength: 500 },
    reviewedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    convertedStudentId: { type: Schema.Types.ObjectId, ref: 'Student' },
  },
  { timestamps: true }
)

AdmissionApplicationSchema.index({ tenantId: 1, status: 1, createdAt: -1 })

const AdmissionApplication: Model<IAdmissionApplication> =
  mongoose.models.AdmissionApplication ||
  mongoose.model<IAdmissionApplication>('AdmissionApplication', AdmissionApplicationSchema)

export default AdmissionApplication
