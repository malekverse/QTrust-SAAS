import mongoose, { Schema, Document, Model } from 'mongoose'

// A Branch is a physical location/campus within a Tenant. Billing, plan, and
// admin ownership stay at the Tenant level; single-location tenants simply never
// create one (queries treat "no branch selected" as "all of this tenant's branches").
export interface IBranch extends Document {
  _id: mongoose.Types.ObjectId
  tenantId: mongoose.Types.ObjectId
  name: string
  address?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const BranchSchema = new Schema<IBranch>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: {
      type: String,
      required: [true, 'اسم الفرع مطلوب'],
      trim: true,
      maxlength: [200, 'اسم الفرع يجب أن لا يتجاوز 200 حرف'],
    },
    address: { type: String, trim: true, maxlength: [300, 'العنوان يجب أن لا يتجاوز 300 حرف'] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

BranchSchema.index({ tenantId: 1, isActive: 1 })

const Branch: Model<IBranch> =
  mongoose.models.Branch || mongoose.model<IBranch>('Branch', BranchSchema)

export default Branch
