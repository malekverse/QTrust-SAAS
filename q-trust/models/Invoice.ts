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
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
)

InvoiceSchema.index({ tenantId: 1, status: 1 })
// Cross-tenant accounts-receivable view (super-admin only)
InvoiceSchema.index({ status: 1, dueDate: 1 })

const Invoice: Model<IInvoice> =
  mongoose.models.Invoice || mongoose.model<IInvoice>('Invoice', InvoiceSchema)

export default Invoice
