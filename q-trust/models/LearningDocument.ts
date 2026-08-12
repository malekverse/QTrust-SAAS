import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ILearningDocument extends Document {
  _id: mongoose.Types.ObjectId
  tenantId: mongoose.Types.ObjectId
  title: string
  description?: string
  category: string
  fileUrl: string
  fileType: string
  fileSize?: number
  thumbnailUrl?: string
  uploadedBy: mongoose.Types.ObjectId
  isPublic: boolean
  targetStudents: mongoose.Types.ObjectId[]
  targetSessions: mongoose.Types.ObjectId[]
  downloadCount: number
  createdAt: Date
  updatedAt: Date
}

import { DOCUMENT_CATEGORIES as DOC_CATS } from '@/lib/constants'

const DOCUMENT_CATEGORIES = Object.values(DOC_CATS)

const LearningDocumentSchema = new Schema<ILearningDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    title: {
      type: String,
      required: [true, 'عنوان المستند مطلوب'],
      trim: true,
      maxlength: [200, 'العنوان يجب أن لا يتجاوز 200 حرف']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'الوصف يجب أن لا يتجاوز 1000 حرف']
    },
    category: {
      type: String,
      enum: DOCUMENT_CATEGORIES,
      required: [true, 'تصنيف المستند مطلوب']
    },
    fileUrl: {
      type: String,
      required: [true, 'رابط الملف مطلوب'],
      trim: true
    },
    fileType: {
      type: String,
      required: [true, 'نوع الملف مطلوب'],
      trim: true
    },
    fileSize: {
      type: Number
    },
    thumbnailUrl: {
      type: String,
      trim: true
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    isPublic: {
      type: Boolean,
      default: true
    },
    targetStudents: [{
      type: Schema.Types.ObjectId,
      ref: 'Student'
    }],
    targetSessions: [{
      type: Schema.Types.ObjectId,
      ref: 'SessionTemplate'
    }],
    downloadCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
)

LearningDocumentSchema.index({ tenantId: 1, category: 1 })
LearningDocumentSchema.index({ tenantId: 1, isPublic: 1 })
LearningDocumentSchema.index({ tenantId: 1, createdAt: -1 })

const LearningDocument: Model<ILearningDocument> = mongoose.models.LearningDocument || mongoose.model<ILearningDocument>('LearningDocument', LearningDocumentSchema)

export default LearningDocument
