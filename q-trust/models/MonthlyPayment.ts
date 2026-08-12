import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IMonthlyPayment extends Document {
  _id: mongoose.Types.ObjectId
  studentId: mongoose.Types.ObjectId
  month: number
  year: number
  isPaid: boolean
  paidAt?: Date
  markedByUserId?: mongoose.Types.ObjectId
  amount?: number
  notes?: string
  createdAt: Date
  updatedAt: Date
}

const MonthlyPaymentSchema = new Schema<IMonthlyPayment>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'الطالب مطلوب'],
    },
    month: {
      type: Number,
      required: [true, 'الشهر مطلوب'],
      min: [1, 'الشهر يجب أن يكون بين 1 و 12'],
      max: [12, 'الشهر يجب أن يكون بين 1 و 12'],
    },
    year: {
      type: Number,
      required: [true, 'السنة مطلوبة'],
      min: [2020, 'السنة غير صالحة'],
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    paidAt: {
      type: Date,
    },
    markedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    amount: {
      type: Number,
      min: [0, 'المبلغ يجب أن يكون موجبًا'],
    },
    notes: {
      type: String,
      maxlength: [500, 'الملاحظات يجب أن لا تتجاوز 500 حرف'],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
)

MonthlyPaymentSchema.index({ studentId: 1, month: 1, year: 1 }, { unique: true })
MonthlyPaymentSchema.index({ month: 1, year: 1, isPaid: 1 })
MonthlyPaymentSchema.index({ studentId: 1, isPaid: 1 })

const MonthlyPayment: Model<IMonthlyPayment> =
  mongoose.models.MonthlyPayment ||
  mongoose.model<IMonthlyPayment>('MonthlyPayment', MonthlyPaymentSchema)

export default MonthlyPayment
