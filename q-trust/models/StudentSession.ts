import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IStudentSession extends Document {
  _id: mongoose.Types.ObjectId
  studentId: mongoose.Types.ObjectId
  sessionTemplateId: mongoose.Types.ObjectId
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const StudentSessionSchema = new Schema<IStudentSession>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'الطالب مطلوب']
    },
    sessionTemplateId: {
      type: Schema.Types.ObjectId,
      ref: 'SessionTemplate',
      required: [true, 'الحصة مطلوبة']
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

// Compound unique index to prevent duplicate assignments
StudentSessionSchema.index(
  { studentId: 1, sessionTemplateId: 1 }, 
  { unique: true }
)

// Index for finding students in a session
StudentSessionSchema.index({ sessionTemplateId: 1, isActive: 1 })

// Index for finding sessions for a student
StudentSessionSchema.index({ studentId: 1, isActive: 1 })

const StudentSession: Model<IStudentSession> = 
  mongoose.models.StudentSession || mongoose.model<IStudentSession>('StudentSession', StudentSessionSchema)

export default StudentSession

