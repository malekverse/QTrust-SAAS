import { requireTenantSession, TenantAuthError, type TenantContext } from '@/lib/tenant'
import dbConnect from '@/lib/db'
import Tenant, { type ITenant } from '@/models/Tenant'
import { PLAN_HIERARCHY, PLAN_LIMITS, type Plan } from '@/lib/constants'

// True when `current` is at least as high a tier as `required`.
export function hasPlanAccess(current: Plan, required: Plan): boolean {
  return PLAN_HIERARCHY.indexOf(current) >= PLAN_HIERARCHY.indexOf(required)
}

// Lightweight tier check for a known tenantId (no session lookup). Reads the
// plan fresh from the DB so a downgrade takes effect immediately. Returns false
// if the tenant is missing. Handy for streaming routes (e.g. the AI assistant)
// that want to return their own Response instead of catching a thrown error.
export async function tenantHasTier(tenantId: string, minTier: Plan): Promise<boolean> {
  await dbConnect()
  const tenant = await Tenant.findById(tenantId).select('plan').lean<{ plan: Plan }>()
  if (!tenant) return false
  return hasPlanAccess(tenant.plan, minTier)
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

// Effective per-tenant limits. Per-field overrides on Tenant.limits win over
// the plan defaults — so a tenant can be sold a bespoke seat count without
// its aiQuotaMonthly being frozen by the same override, and vice versa.
//
// maxStudents = null means "unlimited". Callers must treat null as
// "skip the check" (see enforceStudentLimit below) rather than coercing to a
// large number like Number.MAX_SAFE_INTEGER — that sentinel round-trips
// through BSON as a double and breaks display formatters.
export interface EffectiveLimits {
  maxStudents: number | null
  aiQuotaMonthly: number
}
export function getEffectiveLimits(
  tenant: Pick<ITenant, 'plan' | 'limits'> | { plan: Plan; limits?: ITenant['limits'] }
): EffectiveLimits {
  const planDefaults = PLAN_LIMITS[tenant.plan]
  const ov = tenant.limits ?? {}
  // PREMIUM's default is currently Number.MAX_SAFE_INTEGER (legacy sentinel).
  // Normalize it to `null` so unlimited is one thing everywhere.
  const planMax =
    planDefaults.maxStudents >= Number.MAX_SAFE_INTEGER / 2
      ? null
      : planDefaults.maxStudents
  const maxStudents =
    ov.maxStudents === undefined
      ? planMax
      : ov.maxStudents === null
        ? null
        : ov.maxStudents
  // null on aiQuotaMonthly means "inherit" (same as undefined). We do NOT
  // model "unlimited AI" because AI costs money and someone always owns
  // that cost; a per-tenant number is always required.
  const aiQuotaMonthly =
    ov.aiQuotaMonthly === undefined || ov.aiQuotaMonthly === null
      ? planDefaults.aiQuotaMonthly
      : ov.aiQuotaMonthly
  return { maxStudents, aiQuotaMonthly }
}

// Returns true when a new student would exceed the effective seat limit.
// `null` maxStudents means "no cap".
export function wouldExceedStudentLimit(
  tenant: Pick<ITenant, 'plan' | 'limits'>,
  currentActiveCount: number
): boolean {
  const { maxStudents } = getEffectiveLimits(tenant)
  if (maxStudents === null) return false
  return currentActiveCount >= maxStudents
}
