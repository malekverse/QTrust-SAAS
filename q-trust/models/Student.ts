import mongoose, { Schema, Document, Model } from 'mongoose'

// Activity areas for Section B
export const ACTIVITY_AREAS = {
  QURAN_MEMORIZATION: 'حفظ القرآن',
  TAJWEED_QIRAAT: 'التجويد والقراءات',
  QURAN_SCIENCES: 'علوم القرآن',
  COMPETITIONS: 'المسابقات',
  YEAR_ROUND_ACTIVITY: 'النشاط على مدار السنة',
} as const

export type ActivityArea = keyof typeof ACTIVITY_AREAS

// Gender
export const GENDER = {
  MALE: 'ذكر',
  FEMALE: 'أنثى',
} as const

export type Gender = keyof typeof GENDER

export interface IStudent extends Document {
  _id: mongoose.Types.ObjectId
  
  // Section A — المعلومات الشخصية
  enrollmentNumber?: string      // رقم الانخراط
  cin?: string                   // رقم ب. ت. و (8 digits)
  firstName: string              // الاسم
  lastName: string               // اللقب
  fatherName?: string            // اسم الأب
  gender: 'MALE' | 'FEMALE'      // الجنس
  profession?: string            // المهنة
  dateOfBirth?: Date             // تاريخ الولادة
  placeOfBirth?: string          // مكانها
  educationLevel?: string        // المستوى التعليمي
  address?: string               // العنوان
  phone?: string                 // الهاتف (normalized: +216XXXXXXXX)
  email?: string                 // البريد الإلكتروني
  
  // Section B — اختيار مجال النشاط داخل الجمعية
  activityAreas: ActivityArea[]  // Multi-select checkboxes
  
  // Section C — الإقرار
  declarationAccepted: boolean   // Must be true
  
  // Section D — معلومات الإمضاء
  signatureLocation?: string     // الممضى في
  signatureDate?: Date           // التاريخ
  
  // Section E — المرفقات المطلوبة
  photoUrl?: string              // صورة شمسية
  cinFrontUrl?: string           // نسخة من بطاقة التعريف (الأمامية)
  cinBackUrl?: string            // نسخة من بطاقة التعريف (الخلفية)
  
  // Parent/Guardian info
  parentEmail?: string           // بريد الولي الإلكتروني
  parentPhone?: string           // هاتف الولي
  parentName?: string            // اسم الولي
  
  // System fields
  qrUuid: string                 // Unique QR code
  isActive: boolean              // Account status
  notes?: string                 // Admin notes
  userId?: mongoose.Types.ObjectId // Link to User account (for portal access)
  hasPortalAccess: boolean       // Whether student has a portal account
  
  // Legacy fields (optional for migration)
  fullName?: string              // Will be computed from firstName + lastName
  
  createdAt: Date
  updatedAt: Date
}

const StudentSchema = new Schema<IStudent>(
  {
    // Section A — المعلومات الشخصية
    enrollmentNumber: {
      type: String,
      trim: true,
    },
    cin: {
      type: String,
      trim: true,
      validate: {
        validator: (v: string) => !v || /^\d{8}$/.test(v),
        message: 'رقم بطاقة التعريف يجب أن يكون 8 أرقام'
      }
    },
    firstName: {
      type: String,
      required: [true, 'الاسم مطلوب'],
      trim: true,
      minlength: [2, 'الاسم يجب أن يكون على الأقل حرفين'],
      maxlength: [50, 'الاسم يجب أن لا يتجاوز 50 حرف']
    },
    lastName: {
      type: String,
      required: [true, 'اللقب مطلوب'],
      trim: true,
      minlength: [2, 'اللقب يجب أن يكون على الأقل حرفين'],
      maxlength: [50, 'اللقب يجب أن لا يتجاوز 50 حرف']
    },
    fatherName: {
      type: String,
      trim: true,
      maxlength: [100, 'اسم الأب يجب أن لا يتجاوز 100 حرف']
    },
    gender: {
      type: String,
      enum: ['MALE', 'FEMALE'],
      required: [true, 'الجنس مطلوب']
    },
    profession: {
      type: String,
      trim: true,
      maxlength: [100, 'المهنة يجب أن لا تتجاوز 100 حرف']
    },
    dateOfBirth: {
      type: Date
    },
    placeOfBirth: {
      type: String,
      trim: true,
      maxlength: [100, 'مكان الولادة يجب أن لا يتجاوز 100 حرف']
    },
    educationLevel: {
      type: String,
      trim: true,
      maxlength: [100, 'المستوى التعليمي يجب أن لا يتجاوز 100 حرف']
    },
    address: {
      type: String,
      trim: true,
      maxlength: [200, 'العنوان يجب أن لا يتجاوز 200 حرف']
    },
    phone: {
      type: String,
      trim: true,
      validate: {
        validator: (v: string) => !v || /^\+216\d{8}$/.test(v),
        message: 'رقم الهاتف يجب أن يكون بصيغة +216XXXXXXXX'
      }
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'البريد الإلكتروني غير صالح']
    },
    
    // Section B — اختيار مجال النشاط
    activityAreas: {
      type: [String],
      enum: Object.keys(ACTIVITY_AREAS),
      default: []
    },
    
    // Section C — الإقرار
    declarationAccepted: {
      type: Boolean,
      required: [true, 'يجب الموافقة على الإقرار'],
      validate: {
        validator: (v: boolean) => v === true,
        message: 'يجب الموافقة على الإقرار للتسجيل'
      }
    },
    
    // Section D — معلومات الإمضاء
    signatureLocation: {
      type: String,
      trim: true,
      maxlength: [100, 'مكان الإمضاء يجب أن لا يتجاوز 100 حرف']
    },
    signatureDate: {
      type: Date
    },
    
    // Section E — المرفقات
    photoUrl: {
      type: String,
      trim: true
    },
    cinFrontUrl: {
      type: String,
      trim: true
    },
    cinBackUrl: {
      type: String,
      trim: true
    },
    
    // Parent/Guardian info
    parentEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'البريد الإلكتروني للولي غير صالح']
    },
    parentPhone: {
      type: String,
      trim: true,
      validate: {
        validator: (v: string) => !v || /^\+216\d{8}$/.test(v),
        message: 'رقم هاتف الولي يجب أن يكون بصيغة +216XXXXXXXX'
      }
    },
    parentName: {
      type: String,
      trim: true,
      maxlength: [100, 'اسم الولي يجب أن لا يتجاوز 100 حرف']
    },
    
    // System fields
    qrUuid: {
      type: String,
      required: true,
      unique: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    notes: {
      type: String,
      maxlength: [500, 'الملاحظات يجب أن لا تتجاوز 500 حرف']
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      sparse: true
    },
    hasPortalAccess: {
      type: Boolean,
      default: false
    },
    
    // Legacy fields for backward compatibility
    fullName: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
)

// Virtual for full name (firstName + lastName)
StudentSchema.virtual('displayName').get(function() {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`
  }
  return this.fullName || ''
})

// Pre-save middleware to sync fullName
StudentSchema.pre('save', function() {
  if (this.firstName && this.lastName) {
    this.fullName = `${this.firstName} ${this.lastName}`
  }
})

// Indexes
StudentSchema.index({ firstName: 'text', lastName: 'text', fullName: 'text' })
StudentSchema.index({ isActive: 1 })
StudentSchema.index({ cin: 1 }, { sparse: true })
StudentSchema.index({ enrollmentNumber: 1 }, { sparse: true })

const Student: Model<IStudent> = mongoose.models.Student || mongoose.model<IStudent>('Student', StudentSchema)

export default Student
