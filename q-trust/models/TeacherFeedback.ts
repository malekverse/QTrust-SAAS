import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ITeacherFeedback extends Document {
  _id: mongoose.Types.ObjectId
  studentId: mongoose.Types.ObjectId
  teacherId: mongoose.Types.ObjectId
  sessionOccurrenceId?: mongoose.Types.ObjectId
  content: string
  isPositive: boolean
  date: Date
  createdAt: Date
  updatedAt: Date
}

const TeacherFeedbackSchema = new Schema<ITeacherFeedback>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'الطالب مطلوب'],
      index: true
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'المعلم مطلوب']
    },
    sessionOccurrenceId: {
      type: Schema.Types.ObjectId,
      ref: 'SessionOccurrence'
    },
    content: {
      type: String,
      required: [true, 'محتوى الملاحظة مطلوب'],
      trim: true,
      maxlength: [1000, 'الملاحظة يجب أن لا تتجاوز 1000 حرف']
    },
    isPositive: {
      type: Boolean,
      default: true
    },
    date: {
      type: Date,
      required: true,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
)

TeacherFeedbackSchema.index({ studentId: 1, date: -1 })
TeacherFeedbackSchema.index({ teacherId: 1 })

const TeacherFeedback: Model<ITeacherFeedback> = mongoose.models.TeacherFeedback || mongoose.model<ITeacherFeedback>('TeacherFeedback', TeacherFeedbackSchema)

export default TeacherFeedback
