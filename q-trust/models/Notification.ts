import mongoose, { Schema, Document, Model } from 'mongoose'
import { NOTIFICATION_TYPE, ROLES, type NotificationType } from '@/lib/constants'

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId
  tenantId: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  type: NotificationType
  title: string
  body?: string
  link?: string
  read: boolean
  createdAt: Date
  updatedAt: Date
}

const NotificationSchema = new Schema<INotification>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: Object.values(NOTIFICATION_TYPE), default: NOTIFICATION_TYPE.GENERAL },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, trim: true, maxlength: 500 },
    link: { type: String, trim: true, maxlength: 300 },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
)

NotificationSchema.index({ tenantId: 1, userId: 1, read: 1, createdAt: -1 })

const Notification: Model<INotification> =
  mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema)

export default Notification

interface NotifyPayload {
  type: NotificationType
  title: string
  body?: string
  link?: string
}

// Best-effort: never let a notification failure break the triggering action.
export async function notifyUsers(
  tenantId: mongoose.Types.ObjectId | string,
  userIds: (mongoose.Types.ObjectId | string)[],
  payload: NotifyPayload
) {
  if (userIds.length === 0) return
  try {
    const tid = new mongoose.Types.ObjectId(tenantId)
    await Notification.insertMany(
      userIds.map((uid) => ({
        tenantId: tid,
        userId: new mongoose.Types.ObjectId(uid),
        type: payload.type,
        title: payload.title,
        body: payload.body,
        link: payload.link,
        read: false,
      }))
    )
  } catch (error) {
    console.error('Failed to create notifications:', error)
  }
}

// Fan a notification out to every ADMIN of a tenant (claim, admission, etc.).
export async function notifyTenantAdmins(
  tenantId: mongoose.Types.ObjectId | string,
  payload: NotifyPayload
) {
  try {
    // Imported lazily to avoid a model import cycle at module load.
    const User = (await import('@/models/User')).default
    const admins = await User.find({ tenantId, role: ROLES.ADMIN, isActive: true })
      .select('_id')
      .lean<{ _id: mongoose.Types.ObjectId }[]>()
    await notifyUsers(
      tenantId,
      admins.map((a) => a._id),
      payload
    )
  } catch (error) {
    console.error('Failed to notify tenant admins:', error)
  }
}
