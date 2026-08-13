import mongoose, { Schema, Document, Model } from 'mongoose'

export const LEAD_STATUS = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  CONVERTED: 'CONVERTED',
  CLOSED: 'CLOSED',
} as const
export type LeadStatus = typeof LEAD_STATUS[keyof typeof LEAD_STATUS]

// A demo-request lead from the public marketing site. Platform-level (no
// tenantId — a lead is a *prospective* tenant), surfaced in the super-admin
// console as the digital complement to the in-person sales motion.
export interface ILead extends Document {
  _id: mongoose.Types.ObjectId
  name: string
  associationName: string
  city?: string
  phone: string
  email?: string
  studentCount?: string
  message?: string
  status: LeadStatus
  locale: string
  createdAt: Date
  updatedAt: Date
}

const LeadSchema = new Schema<ILead>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    associationName: { type: String, required: true, trim: true, maxlength: 200 },
    city: { type: String, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    email: { type: String, trim: true, lowercase: true, maxlength: 200 },
    studentCount: { type: String, trim: true, maxlength: 30 },
    message: { type: String, trim: true, maxlength: 2000 },
    status: { type: String, enum: Object.values(LEAD_STATUS), default: LEAD_STATUS.NEW },
    locale: { type: String, default: 'ar', maxlength: 5 },
  },
  { timestamps: true }
)

LeadSchema.index({ status: 1, createdAt: -1 })

const Lead: Model<ILead> = mongoose.models.Lead || mongoose.model<ILead>('Lead', LeadSchema)

export default Lead
