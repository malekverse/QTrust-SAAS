import mongoose, { Schema, Document, Model } from 'mongoose'

// A time-boxed grant letting one TEACHER cover another teacher's session
// template. It is NOT a new role — just a narrowly-scoped, temporary extension
// of the substitute's existing TEACHER access to a specific session.
export interface ISubstituteAssignment extends Document {
  _id: mongoose.Types.ObjectId
  tenantId: mongoose.Types.ObjectId
  sessionTemplateId: mongoose.Types.ObjectId
  substituteUserId: mongoose.Types.ObjectId
  validFrom: Date
  validTo: Date
  assignedByUserId: mongoose.Types.ObjectId
  notes?: string
  createdAt: Date
  updatedAt: Date
}

const SubstituteAssignmentSchema = new Schema<ISubstituteAssignment>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    sessionTemplateId: {
      type: Schema.Types.ObjectId,
      ref: 'SessionTemplate',
      required: [true, 'الحصة مطلوبة'],
    },
    substituteUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'المعلم النائب مطلوب'],
    },
    validFrom: { type: Date, required: [true, 'تاريخ البداية مطلوب'] },
    validTo: { type: Date, required: [true, 'تاريخ النهاية مطلوب'] },
    assignedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true }
)

SubstituteAssignmentSchema.index({ tenantId: 1, substituteUserId: 1, validFrom: 1, validTo: 1 })
SubstituteAssignmentSchema.index({ tenantId: 1, sessionTemplateId: 1 })

const SubstituteAssignment: Model<ISubstituteAssignment> =
  mongoose.models.SubstituteAssignment ||
  mongoose.model<ISubstituteAssignment>('SubstituteAssignment', SubstituteAssignmentSchema)

export default SubstituteAssignment
