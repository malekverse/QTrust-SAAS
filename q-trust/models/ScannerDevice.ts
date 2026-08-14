import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IScannerDevice extends Document {
  _id: mongoose.Types.ObjectId
  deviceId: string
  // The global scanner token carries no tenant context, so a device is bound
  // to a tenant by its first successful check-in (tenant derived from the
  // scanned student). Until then the device is unassigned and not shown in
  // any tenant's dashboard.
  tenantId?: mongoose.Types.ObjectId
  appVersion?: string
  platform?: string
  batteryLevel?: number // 0..1
  batteryCharging?: boolean
  pendingScans?: number // offline backlog reported by the device
  lastSeenAt: Date
  lastCheckInAt?: Date
  createdAt: Date
  updatedAt: Date
}

const ScannerDeviceSchema = new Schema<IScannerDevice>(
  {
    deviceId: { type: String, required: true, unique: true, index: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', index: true },
    appVersion: String,
    platform: String,
    batteryLevel: Number,
    batteryCharging: Boolean,
    pendingScans: Number,
    lastSeenAt: { type: Date, required: true, default: Date.now },
    lastCheckInAt: Date,
  },
  {
    timestamps: true,
  }
)

// Tenant dashboard query: devices by recency
ScannerDeviceSchema.index({ tenantId: 1, lastSeenAt: -1 })

const ScannerDevice: Model<IScannerDevice> =
  mongoose.models.ScannerDevice || mongoose.model<IScannerDevice>('ScannerDevice', ScannerDeviceSchema)

export default ScannerDevice
