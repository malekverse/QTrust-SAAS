import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import dbConnect from '@/lib/db'
import { resolveTenantBySlug } from '@/lib/tenant'
import { computeLeaderboard } from '@/lib/leaderboard'
import { PLANS } from '@/lib/constants'

export const dynamic = 'force-dynamic'

// Cache the (relatively heavy) aggregation per tenant for 60s so a wall-mounted
// TV polling every 30s doesn't re-run it on every request.
const getCachedLeaderboard = (tenantId: string) =>
  unstable_cache(
    () => computeLeaderboard(tenantId, 20),
    ['leaderboard', tenantId],
    { revalidate: 60, tags: [`leaderboard:${tenantId}`] }
  )()

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  try {
    const { tenantSlug } = await params
    const tenant = await resolveTenantBySlug(tenantSlug)
    if (!tenant) {
      return NextResponse.json({ message: 'المؤسسة غير موجودة' }, { status: 404 })
    }

    // Gamification / TV leaderboard is a Premium-tier feature (see pricing).
    if (tenant.plan !== PLANS.PREMIUM) {
      return NextResponse.json(
        { message: 'لوحة الشرف متاحة في الباقة المتقدّمة', code: 'UPGRADE_REQUIRED' },
        { status: 403 }
      )
    }

    await dbConnect()
    const entries = await getCachedLeaderboard(String(tenant._id))

    return NextResponse.json({
      tenant: {
        name: tenant.branding?.displayName || tenant.name,
        primaryColor: tenant.branding?.primaryColor || '#136F4E',
        secondaryColor: tenant.branding?.secondaryColor || '#F4C76C',
      },
      entries,
      updatedAt: new Date().toISOString(),
    })
  } catch (e) {
    console.error('Leaderboard error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
