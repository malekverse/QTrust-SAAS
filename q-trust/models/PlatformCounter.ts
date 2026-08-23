import mongoose, { Schema, Document, Model } from 'mongoose'

// Tiny platform-global (no tenantId) counter store. Used by the invoice
// numbering helper so we get a monotone QT-YYYY-#### sequence across
// every tenant. Settings.tenantId is required, so it can't host this.
export interface IPlatformCounter extends Document {
  _id: mongoose.Types.ObjectId
  // Composite key such as `invoice_number:2026`.
  key: string
  seq: number
  updatedAt: Date
}

const PlatformCounterSchema = new Schema<IPlatformCounter>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
)

const PlatformCounter: Model<IPlatformCounter> =
  mongoose.models.PlatformCounter ||
  mongoose.model<IPlatformCounter>('PlatformCounter', PlatformCounterSchema)

export default PlatformCounter
