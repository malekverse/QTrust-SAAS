import { requireTenantSession, TenantAuthError, type TenantContext } from '@/lib/tenant'
import dbConnect from '@/lib/db'
import Tenant, { type ITenant } from '@/models/Tenant'
import { PLAN_HIERARCHY, type Plan } from '@/lib/constants'

// True when `current` is at least as high a tier as `required`.
export function hasPlanAccess(current: Plan, required: Plan): boolean {
  return PLAN_HIERARCHY.indexOf(current) >= PLAN_HIERARCHY.indexOf(required)
}

// Require the calling tenant to be on at least `minTier`. Reads the plan fresh
// from the DB (so a downgrade takes effect immediately, unlike the JWT copy).
// Throws TenantAuthError(402) when the tier is insufficient.
export async function requireTier(
  minTier: Plan
): Promise<{ session: TenantContext; tenant: ITenant }> {
  const session = await requireTenantSession()
  await dbConnect()
  const tenant = await Tenant.findById(session.tenantId).lean<ITenant>()
  if (!tenant) throw new TenantAuthError('المؤسسة غير موجودة', 403)
  if (!hasPlanAccess(tenant.plan, minTier)) {
    throw new TenantAuthError(`هذه الميزة تتطلب ترقية الاشتراك إلى ${minTier}`, 402)
  }
  return { session, tenant }
}
