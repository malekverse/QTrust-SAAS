import mongoose, { Schema, Document, Model } from 'mongoose'
import {
  PLANS,
  TENANT_STATUS,
  PAYMENT_METHODS,
  type Plan,
  type TenantStatus,
  type PaymentMethod,
  type Locale,
} from '@/lib/constants'

// A Tenant is one paying customer organization (association / school / institute).
// It is the root of multi-tenant data isolation: every tenant-scoped document
// carries a `tenantId` referencing one of these.
export interface ITenant extends Document {
  _id: mongoose.Types.ObjectId
  name: string
  slug: string
  plan: Plan
  status: TenantStatus
  trialEndsAt?: Date
  maxStudents: number
  aiQuotaMonthly: number
  aiUsageCurrentMonth: number
  aiUsageResetAt: Date
  isDemo: boolean
  branding: {
    displayName?: string
    logoUrl?: string
    primaryColor: string
    secondaryColor: string
    locale: Locale
  }
  contact: {
    email?: string
    phone?: string
    address?: string
  }
  billing: {
    setupFeePaid: boolean
    setupFeeAmountTND: number
    annualFeeAmountTND: number
    currentPeriodStart?: Date
    currentPeriodEnd?: Date
    paymentMethod: PaymentMethod
  }
  // Multi-step provisioning gate. READY means the Tenant + its first admin +
  // enrollment settings + opening invoices are all persisted. PROVISIONING is
  // set on Tenant.create and only flipped to READY at the end; login and
  // requireTenantSession reject anything not READY, so a half-created tenant
  // is invisible instead of a soft brick.
  provisioningState: 'PROVISIONING' | 'READY'
  createdAt: Date
  updatedAt: Date
}

const TenantSchema = new Schema<ITenant>(
  {
    name: {
      type: String,
      required: [true, 'اسم الجمعية مطلوب'],
      trim: true,
      maxlength: [200, 'الاسم يجب أن لا يتجاوز 200 حرف'],
    },
    // URL-safe identifier used for tenant login routing (e.g. app.q-trust.tn/{slug}).
    slug: {
      type: String,
      required: [true, 'المعرّف مطلوب'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'المعرّف يجب أن يحتوي على أحرف لاتينية صغيرة وأرقام وشرطات فقط'],
    },
    plan: { type: String, enum: Object.values(PLANS), default: PLANS.STARTER },
    status: { type: String, enum: Object.values(TENANT_STATUS), default: TENANT_STATUS.TRIAL },
    trialEndsAt: { type: Date },
    maxStudents: { type: Number, default: 50 },
    aiQuotaMonthly: { type: Number, default: 0 },
    aiUsageCurrentMonth: { type: Number, default: 0 },
    aiUsageResetAt: { type: Date, default: () => new Date() },
    isDemo: { type: Boolean, default: false },
    branding: {
      displayName: { type: String, trim: true },
      logoUrl: { type: String },
      primaryColor: { type: String, default: '#136F4E' },
      secondaryColor: { type: String, default: '#F4C76C' },
      locale: { type: String, enum: ['ar', 'fr', 'en'], default: 'ar' },
    },
    contact: {
      email: { type: String, trim: true, lowercase: true },
      phone: { type: String, trim: true },
      address: { type: String, trim: true },
    },
    billing: {
      setupFeePaid: { type: Boolean, default: false },
      setupFeeAmountTND: { type: Number, default: 0 },
      annualFeeAmountTND: { type: Number, default: 0 },
      currentPeriodStart: { type: Date },
      currentPeriodEnd: { type: Date },
      paymentMethod: {
        type: String,
        enum: Object.values(PAYMENT_METHODS),
        default: PAYMENT_METHODS.BANK_TRANSFER,
      },
    },
    // Defaults to READY so every pre-existing tenant continues to work
    // unchanged; provisionTenant() writes 'PROVISIONING' on Tenant.create and
    // flips to 'READY' after the last dependent write succeeds.
    provisioningState: {
      type: String,
      enum: ['PROVISIONING', 'READY'],
      default: 'READY',
    },
  },
  { timestamps: true }
)

TenantSchema.index({ status: 1 })

const Tenant: Model<ITenant> =
  mongoose.models.Tenant || mongoose.model<ITenant>('Tenant', TenantSchema)

export default Tenant
