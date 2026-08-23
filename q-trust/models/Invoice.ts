import mongoose, { Schema, Document, Model } from 'mongoose'
import {
  INVOICE_TYPES,
  INVOICE_STATUS,
  PAYMENT_METHODS,
  type InvoiceType,
  type InvoiceStatus,
  type PaymentMethod,
} from '@/lib/constants'

// A platform Invoice: the super-admin billing a Tenant (setup fee, annual
// renewal, add-on). Recorded/settled manually (bank transfer / cheque / cash),
// matching the Tunisia-first go-to-market. Distinct from MonthlyPayment, which
// is a tenant tracking its own families' tuition.
export interface IInvoice extends Document {
  _id: mongoose.Types.ObjectId
  tenantId: mongoose.Types.ObjectId
  type: InvoiceType
  amountTND: number
  status: InvoiceStatus
  dueDate: Date
  paidAt?: Date
  paymentMethod?: PaymentMethod
  referenceNumber?: string
  proofUrl?: string
  notes?: string
  // Human-readable invoice number stamped at creation ("QT-2026-0042").
  // Unique per tenant via a partial index (partial so legacy rows without
  // a number continue to coexist during the backfill window).
  invoiceNumber?: string
  // Period-key idempotency guard for renewal generation ("2027-03"). The
  // partial unique index {tenantId, type, periodKey} guarantees the
  // billing cron never double-generates a renewal, even under concurrent
  // invocation.
  periodKey?: string
  createdBy: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const InvoiceSchema = new Schema<IInvoice>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    type: { type: String, enum: Object.values(INVOICE_TYPES), required: true },
    amountTND: { type: Number, required: true, min: 0 },
    status: { type: String, enum: Object.values(INVOICE_STATUS), default: INVOICE_STATUS.PENDING },
    dueDate: { type: Date, required: true },
    paidAt: { type: Date },
    paymentMethod: { type: String, enum: Object.values(PAYMENT_METHODS) },
    referenceNumber: { type: String, trim: true },
    proofUrl: { type: String, trim: true },
    notes: { type: String, trim: true, maxlength: 1000 },
    invoiceNumber: { type: String, trim: true, index: true },
    periodKey: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
)

InvoiceSchema.index({ tenantId: 1, status: 1 })
// Cross-tenant accounts-receivable view (super-admin only)
InvoiceSchema.index({ status: 1, dueDate: 1 })
// Partial unique so the billing cron cannot generate the same period
// twice even under concurrent invocation. Legacy rows without a
// periodKey are skipped by the partial filter and stay coexistent.
InvoiceSchema.index(
  { tenantId: 1, type: 1, periodKey: 1 },
  { unique: true, partialFilterExpression: { periodKey: { $exists: true } } }
)
// Unique per tenant when a number is present. Legacy rows without a
// number are skipped.
InvoiceSchema.index(
  { tenantId: 1, invoiceNumber: 1 },
  { unique: true, partialFilterExpression: { invoiceNumber: { $exists: true } } }
)

const Invoice: Model<IInvoice> =
  mongoose.models.Invoice || mongoose.model<IInvoice>('Invoice', InvoiceSchema)

export default Invoice
