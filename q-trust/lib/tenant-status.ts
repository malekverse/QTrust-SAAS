import Tenant from '@/models/Tenant'
import dbConnect from '@/lib/db'
import { TENANT_STATUS } from '@/lib/constants'

void Tenant

// Statuses that cut off access. PAST_DUE is intentionally NOT here — it's a
// grace/reminder state (see plan §6.6); only an explicit suspend/cancel blocks.
const BLOCKED = new Set<string>([TENANT_STATUS.SUSPENDED, TENANT_STATUS.CANCELLED])

// Tiny per-instance cache so the status check doesn't hit the DB on every
// request. A change (suspend/reactivate) takes effect within TTL.
const TTL_MS = 60_000
const cache = new Map<string, { status: string | null; expires: number }>()

export async function getTenantStatus(tenantId: string): Promise<string | null> {
  const now = Date.now()
  const hit = cache.get(tenantId)
  if (hit && hit.expires > now) return hit.status
  await dbConnect()
  const t = await Tenant.findById(tenantId).select('status').lean<{ status?: string }>()
  const status = t?.status ?? null
  cache.set(tenantId, { status, expires: now + TTL_MS })
  return status
}

export function isBlockedStatus(status: string | null | undefined): boolean {
  return !!status && BLOCKED.has(status)
}

// Best-effort: drop the cache for a tenant so a status change is reflected
// immediately on the same instance (e.g. right after a super-admin suspends).
export function clearTenantStatusCache(tenantId: string): void {
  cache.delete(tenantId)
}
