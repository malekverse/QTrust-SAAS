import mongoose, { Schema, Document, Model } from 'mongoose'

// Platform-operator audit trail. Deliberately NOT tenant-scoped the way
// ActivityLog is: super-admin actions (provisioning, plan/status changes,
// credential re-issue, impersonation, billing) span tenants or belong to no
// tenant at all, and ActivityLog.tenantId is required + its enum is closed and
// tenant-semantic. `tenantId` here is optional-but-present so "everything that
// happened to tenant X" is still queryable.
export type PlatformAuditAction =
  | 'TENANT_PROVISIONED'
  | 'TENANT_UPDATED'
  | 'TENANT_PLAN_CHANGED'
  | 'TENANT_STATUS_CHANGED'
  | 'TENANT_DELETED'
  | 'TENANT_LIMITS_CHANGED'
  | 'ADMIN_ACCESS_REISSUED'
  | 'ADMIN_ACCESS_REVEALED'
  | 'ADMIN_ACCESS_EMAILED'
  | 'ADMIN_PASSWORD_RESET'
  | 'IMPERSONATION_STARTED'
  | 'IMPERSONATION_ENDED'
  | 'LEAD_CONVERTED'
  | 'LEAD_DELETED'
  | 'INVOICE_CREATED'
  | 'INVOICE_PAID'
  | 'INVOICE_CANCELLED'
  | 'BILLING_SWEEP_RUN'
  | 'SUPER_ADMIN_CREATED'

export interface IPlatformAuditLog extends Document {
  _id: mongoose.Types.ObjectId
  actorUserId?: mongoose.Types.ObjectId
  // Snapshot of the actor's email so the row survives the user being deleted.
  // 'system' for cron/automated actions.
  actorEmail: string
  action: PlatformAuditAction
  targetType?: string
  targetId?: mongoose.Types.ObjectId
  tenantId?: mongoose.Types.ObjectId
  // Set when the action was taken while impersonating a tenant user.
  impersonatedBy?: mongoose.Types.ObjectId
  metadata?: Record<string, unknown>
  ip?: string
  userAgent?: string
  createdAt: Date
}

const PLATFORM_AUDIT_ACTIONS: PlatformAuditAction[] = [
  'TENANT_PROVISIONED',
  'TENANT_UPDATED',
  'TENANT_PLAN_CHANGED',
  'TENANT_STATUS_CHANGED',
  'TENANT_DELETED',
  'TENANT_LIMITS_CHANGED',
  'ADMIN_ACCESS_REISSUED',
  'ADMIN_ACCESS_REVEALED',
  'ADMIN_ACCESS_EMAILED',
  'ADMIN_PASSWORD_RESET',
  'IMPERSONATION_STARTED',
  'IMPERSONATION_ENDED',
  'LEAD_CONVERTED',
  'LEAD_DELETED',
  'INVOICE_CREATED',
  'INVOICE_PAID',
  'INVOICE_CANCELLED',
  'BILLING_SWEEP_RUN',
  'SUPER_ADMIN_CREATED',
]

const PlatformAuditLogSchema = new Schema<IPlatformAuditLog>(
  {
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    actorEmail: { type: String, required: true },
    action: { type: String, required: true, enum: PLATFORM_AUDIT_ACTIONS },
    targetType: { type: String },
    targetId: { type: Schema.Types.ObjectId },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant' },
    impersonatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    metadata: { type: Schema.Types.Mixed },
    ip: { type: String },
    userAgent: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

PlatformAuditLogSchema.index({ createdAt: -1 })
PlatformAuditLogSchema.index({ tenantId: 1, createdAt: -1 })
PlatformAuditLogSchema.index({ actorUserId: 1, createdAt: -1 })
PlatformAuditLogSchema.index({ action: 1, createdAt: -1 })

const PlatformAuditLog: Model<IPlatformAuditLog> =
  mongoose.models.PlatformAuditLog ||
  mongoose.model<IPlatformAuditLog>('PlatformAuditLog', PlatformAuditLogSchema)

export default PlatformAuditLog

export interface PlatformAuditInput {
  actorUserId?: mongoose.Types.ObjectId | string
  actorEmail: string
  action: PlatformAuditAction
  targetType?: string
  targetId?: mongoose.Types.ObjectId | string
  tenantId?: mongoose.Types.ObjectId | string
  impersonatedBy?: mongoose.Types.ObjectId | string
  metadata?: Record<string, unknown>
  ip?: string
  userAgent?: string
}

function toId(v?: mongoose.Types.ObjectId | string) {
  return v ? new mongoose.Types.ObjectId(v) : undefined
}

// Record a platform-operator action.
//
// Best-effort by default (mirrors logActivity): a logging failure never breaks
// the triggering action. For the one case where the audit MUST land before a
// secret is returned to the operator (credential reveal), pass
// `{ throwOnError: true }` so the caller can fail closed.
export async function logPlatformAudit(
  input: PlatformAuditInput,
  options?: { throwOnError?: boolean }
): Promise<void> {
  try {
    await PlatformAuditLog.create({
      actorUserId: toId(input.actorUserId),
      actorEmail: input.actorEmail,
      action: input.action,
      targetType: input.targetType,
      targetId: toId(input.targetId),
      tenantId: toId(input.tenantId),
      impersonatedBy: toId(input.impersonatedBy),
      metadata: input.metadata,
      ip: input.ip,
      userAgent: input.userAgent,
    })
  } catch (error) {
    console.error('Failed to write platform audit log:', error)
    if (options?.throwOnError) throw error
  }
}
