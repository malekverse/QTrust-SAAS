import mongoose, { Schema, Document, Model } from 'mongoose'

// A household grouping several enrolled siblings under one guardian, used to
// apply a sibling discount when computing what the family owes and (later) to
// power a unified guardian view. Tenant-scoped like every domain model.
export interface IFamily extends Document {
  _id: mongoose.Types.ObjectId
  tenantId: mongoose.Types.ObjectId
  primaryGuardianName: string
  primaryGuardianPhone?: string
  primaryGuardianEmail?: string
  // Agreed base monthly fee per child for this family (TND). Kept per-family so
  // field sales can negotiate it; the discount below is applied on top.
  monthlyFeePerChildTND: number
  // Percentage off each child's fee, applied when the family has ≥2 siblings.
  siblingDiscountPercent: number
  createdAt: Date
  updatedAt: Date
}

const FamilySchema = new Schema<IFamily>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    primaryGuardianName: {
      type: String,
      required: [true, 'اسم الولي مطلوب'],
      trim: true,
      maxlength: 100,
    },
    primaryGuardianPhone: {
      type: String,
      trim: true,
      validate: {
        validator: (v: string) => !v || /^\+216\d{8}$/.test(v),
        message: 'رقم الهاتف يجب أن يكون بصيغة +216XXXXXXXX',
      },
    },
    primaryGuardianEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'البريد الإلكتروني غير صالح'],
    },
    monthlyFeePerChildTND: { type: Number, default: 0, min: 0 },
    siblingDiscountPercent: { type: Number, default: 0, min: 0, max: 100 },
  },
  { timestamps: true }
)

FamilySchema.index({ tenantId: 1, primaryGuardianName: 1 })

const Family: Model<IFamily> =
  mongoose.models.Family || mongoose.model<IFamily>('Family', FamilySchema)

export default Family
