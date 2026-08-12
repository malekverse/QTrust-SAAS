import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IRoom extends Document {
  _id: mongoose.Types.ObjectId
  tenantId: mongoose.Types.ObjectId
  branchId?: mongoose.Types.ObjectId
  name: string
  capacity: number
  description?: string
  location?: string
  features: string[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const RoomSchema = new Schema<IRoom>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
    name: {
      type: String,
      required: [true, 'اسم القاعة مطلوب'],
      trim: true,
      minlength: [2, 'اسم القاعة يجب أن يكون على الأقل حرفين'],
      maxlength: [100, 'اسم القاعة يجب أن لا يتجاوز 100 حرف']
    },
    capacity: {
      type: Number,
      required: [true, 'سعة القاعة مطلوبة'],
      min: [1, 'السعة يجب أن تكون 1 على الأقل'],
      max: [500, 'السعة يجب أن لا تتجاوز 500']
    },
    description: {
      type: String,
      maxlength: [500, 'الوصف يجب أن لا يتجاوز 500 حرف']
    },
    location: {
      type: String,
      maxlength: [200, 'الموقع يجب أن لا يتجاوز 200 حرف']
    },
    features: {
      type: [String],
      default: []
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
)

// Room name is unique per tenant (different associations can reuse a room name).
RoomSchema.index({ tenantId: 1, name: 1 }, { unique: true })
RoomSchema.index({ tenantId: 1, isActive: 1, capacity: 1 })

const Room: Model<IRoom> =
  mongoose.models.Room || mongoose.model<IRoom>('Room', RoomSchema)

export default Room
