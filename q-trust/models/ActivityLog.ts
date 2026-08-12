import mongoose, { Schema, Document, Model } from 'mongoose'

export type ActivityType = 
  | 'ATTENDANCE_CHECK_IN'
  | 'STUDENT_CREATED'
  | 'STUDENT_UPDATED'
  | 'TEACHER_CREATED'
  | 'TEACHER_UPDATED'
  | 'SESSION_CREATED'
  | 'SESSION_UPDATED'
  | 'ATTENDANCE_UPDATED'

export interface IActivityLog extends Document {
  _id: mongoose.Types.ObjectId
  tenantId: mongoose.Types.ObjectId
  type: ActivityType
  description: string
  details?: string
  userId?: mongoose.Types.ObjectId
  studentId?: mongoose.Types.ObjectId
  sessionId?: mongoose.Types.ObjectId
  metadata?: Record<string, unknown>
  createdAt: Date
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: [
        'ATTENDANCE_CHECK_IN',
        'STUDENT_CREATED',
        'STUDENT_UPDATED',
        'TEACHER_CREATED',
        'TEACHER_UPDATED',
        'SESSION_CREATED',
        'SESSION_UPDATED',
        'ATTENDANCE_UPDATED'
      ]
    },
    description: {
      type: String,
      required: true
    },
    details: String,
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student'
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'SessionTemplate'
    },
    metadata: {
      type: Schema.Types.Mixed
    }
  },
  {
    timestamps: true
  }
)

// Index for recent activities query (tenant-scoped)
ActivityLogSchema.index({ tenantId: 1, createdAt: -1 })
ActivityLogSchema.index({ tenantId: 1, type: 1, createdAt: -1 })

const ActivityLog: Model<IActivityLog> = 
  mongoose.models.ActivityLog || mongoose.model<IActivityLog>('ActivityLog', ActivityLogSchema)

export default ActivityLog

// Helper function to log activities
export async function logActivity(
  type: ActivityType,
  description: string,
  options?: {
    tenantId?: mongoose.Types.ObjectId | string
    details?: string
    userId?: mongoose.Types.ObjectId | string
    studentId?: mongoose.Types.ObjectId | string
    sessionId?: mongoose.Types.ObjectId | string
    metadata?: Record<string, unknown>
  }
) {
  try {
    await ActivityLog.create({
      type,
      description,
      tenantId: options?.tenantId ? new mongoose.Types.ObjectId(options.tenantId) : undefined,
      details: options?.details,
      userId: options?.userId ? new mongoose.Types.ObjectId(options.userId) : undefined,
      studentId: options?.studentId ? new mongoose.Types.ObjectId(options.studentId) : undefined,
      sessionId: options?.sessionId ? new mongoose.Types.ObjectId(options.sessionId) : undefined,
      metadata: options?.metadata
    })
  } catch (error) {
    console.error('Failed to log activity:', error)
  }
}

