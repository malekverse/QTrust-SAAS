import mongoose, { Schema, Document, Model } from 'mongoose'
import { ROLES, type Role } from '@/lib/constants'

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId
  fullName: string
  email: string
  phone?: string
  role: Role
  passwordHash: string
  isEmailVerified: boolean
  isActive: boolean
  mustChangePassword: boolean
  studentId?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    fullName: {
      type: String,
      required: [true, 'الاسم الكامل مطلوب'],
      trim: true,
      minlength: [2, 'الاسم يجب أن يكون على الأقل حرفين'],
      maxlength: [100, 'الاسم يجب أن لا يتجاوز 100 حرف']
    },
    email: {
      type: String,
      required: [true, 'البريد الإلكتروني مطلوب'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'البريد الإلكتروني غير صالح']
    },
    phone: {
      type: String,
      trim: true,
      sparse: true,
      validate: {
        validator: (v: string) => !v || /^\+216\d{8}$/.test(v),
        message: 'رقم الهاتف يجب أن يكون بصيغة +216XXXXXXXX'
      }
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.TEACHER
    },
    passwordHash: {
      type: String,
      required: [true, 'كلمة المرور مطلوبة']
    },
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true
    },
    mustChangePassword: {
      type: Boolean,
      default: false
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      sparse: true
    }
  },
  {
    timestamps: true
  }
)

// Index for faster queries
UserSchema.index({ role: 1, isActive: 1 })

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema)

export default User
