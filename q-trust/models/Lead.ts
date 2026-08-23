import mongoose, { Schema, Document, Model } from 'mongoose'

export const LEAD_STATUS = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  CONVERTED: 'CONVERTED',
  CLOSED: 'CLOSED',
} as const
export type LeadStatus = typeof LEAD_STATUS[keyof typeof LEAD_STATUS]

export interface ILeadNote {
  _id: mongoose.Types.ObjectId
  body: string
  authorId: mongoose.Types.ObjectId
  authorName: string
  createdAt: Date
}

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
  // Free-text for legacy rows; new submissions carry a stable STUDENT_RANGES
  // key. Both shapes are readable — do not assume this parses to a number.
  studentCount?: string
  message?: string
  status: LeadStatus
  locale: string
  // Set at conversion time (findOneAndUpdate guarded on status !== 'CONVERTED'
  // so a second operator gets a 409, not a double-convert).
  convertedTenantId?: mongoose.Types.ObjectId
  convertedAt?: Date
  contactedAt?: Date
  followUpAt?: Date
  source?: string
  notes: ILeadNote[]
  createdAt: Date
  updatedAt: Date
}

const LeadNoteSchema = new Schema<ILeadNote>(
  {
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, required: true, trim: true, maxlength: 200 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
)

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
    convertedTenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', sparse: true },
    convertedAt: { type: Date },
    contactedAt: { type: Date },
    followUpAt: { type: Date },
    source: { type: String, trim: true, maxlength: 60, default: 'marketing_demo_form' },
    notes: { type: [LeadNoteSchema], default: [] },
  },
  { timestamps: true }
)

LeadSchema.index({ status: 1, createdAt: -1 })
// Serves the "leads due for follow-up" queue.
LeadSchema.index({ status: 1, followUpAt: 1 })

const Lead: Model<ILead> = mongoose.models.Lead || mongoose.model<ILead>('Lead', LeadSchema)

export default Lead
