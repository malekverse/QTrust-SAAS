import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { requireSuperAdmin, TenantAuthError } from '@/lib/tenant'
import Invoice from '@/models/Invoice'
import { INVOICE_STATUS } from '@/lib/constants'

void Invoice

// GET /api/super-admin/invoices/summary
// Cross-tenant AR summary: totals per status + aging buckets on the
// outstanding side. Independent of the paginated list so the KPI strip
// stays accurate even when the operator filters/pages the table.
export async function GET(_request: NextRequest) {
  try {
    await requireSuperAdmin()
    await dbConnect()

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [byStatus, agingBuckets, collectedThisMonth] = await Promise.all([
      Invoice.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            total: { $sum: '$amountTND' },
          },
        },
      ]),
      Invoice.aggregate([
        {
          $match: {
            status: { $in: [INVOICE_STATUS.PENDING, INVOICE_STATUS.OVERDUE] },
          },
        },
        {
          $addFields: {
            daysOverdue: {
              $max: [
                0,
                {
                  $divide: [
                    { $subtract: [now, '$dueDate'] },
                    1000 * 60 * 60 * 24,
                  ],
                },
              ],
            },
          },
        },
        {
          $bucket: {
            groupBy: '$daysOverdue',
            boundaries: [0, 1, 31, 61, Number.POSITIVE_INFINITY],
            default: 'other',
            output: {
              count: { $sum: 1 },
              total: { $sum: '$amountTND' },
            },
          },
        },
      ]),
      Invoice.aggregate([
        {
          $match: {
            status: INVOICE_STATUS.PAID,
            paidAt: { $gte: monthStart },
          },
        },
        { $group: { _id: null, total: { $sum: '$amountTND' }, count: { $sum: 1 } } },
      ]),
    ])

    // Reshape the bucket output into stable keys.
    const agingByBucket = new Map<string, { count: number; total: number }>()
    for (const b of agingBuckets as { _id: number | string; count: number; total: number }[]) {
      const key =
        b._id === 0 ? 'notYetDue' : b._id === 1 ? '1_30' : b._id === 31 ? '31_60' : '60_plus'
      agingByBucket.set(key, { count: b.count, total: b.total })
    }

    const statusMap = new Map<string, { count: number; total: number }>()
    for (const s of byStatus as { _id: string; count: number; total: number }[]) {
      statusMap.set(s._id, { count: s.count, total: s.total })
    }

    return NextResponse.json({
      byStatus: Object.fromEntries(statusMap),
      aging: Object.fromEntries(agingByBucket),
      collectedThisMonth: (collectedThisMonth as any[])[0] ?? { total: 0, count: 0 },
    })
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('invoices summary error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
