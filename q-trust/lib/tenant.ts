import { auth } from '@/lib/auth'
import dbConnect from '@/lib/db'
import Tenant, { type ITenant } from '@/models/Tenant'
import { ROLES } from '@/lib/constants'

// Thrown by the tenant/entitlement guards; callers map `.status` to an HTTP response.
export class TenantAuthError extends Error {
  status: number
  constructor(message = 'غير مصرح لك بالوصول', status = 403) {
    super(message)
    this.name = 'TenantAuthError'
    this.status = status
  }
}

export interface TenantContext {
  userId: string
  role: string
  tenantId: string
  tenantSlug?: string
  tenantPlan?: string
  fullName: string
}

// Resolve the authenticated session and require a tenant context. Every
// tenant-scoped API route should call this instead of bare auth(), then merge
// `{ tenantId: ctx.tenantId }` into each Mongoose query.
export async function requireTenantSession(): Promise<TenantContext> {
  const session = await auth()
  if (!session?.user) throw new TenantAuthError('يجب تسجيل الدخول', 401)
  const user = session.user
  if (!user.tenantId) throw new TenantAuthError('لا يوجد سياق مؤسسة', 403)
  return {
    userId: user.id,
    role: user.role,
    tenantId: user.tenantId,
    tenantSlug: user.tenantSlug,
    tenantPlan: user.tenantPlan,
    fullName: user.fullName,
  }
}

// Require the caller to be a platform SUPER_ADMIN (cross-tenant, no tenant context).
// Used by the super-admin console; its queries are intentionally NOT tenant-scoped.
export async function requireSuperAdmin() {
  const session = await auth()
  if (!session?.user) throw new TenantAuthError('يجب تسجيل الدخول', 401)
  if (session.user.role !== ROLES.SUPER_ADMIN) {
    throw new TenantAuthError('غير مصرح — هذه الصفحة لمدير المنصة فقط', 403)
  }
  return session.user
}

// Look up a tenant by its URL slug (used at login time to scope the credential check).
export async function resolveTenantBySlug(slug: string): Promise<ITenant | null> {
  if (!slug) return null
  await dbConnect()
  return Tenant.findOne({ slug: slug.toLowerCase().trim() }).lean<ITenant>()
}
