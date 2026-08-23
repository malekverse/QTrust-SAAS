import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import dbConnect from '@/lib/db'
import Tenant from '@/models/Tenant'
import Invoice from '@/models/Invoice'
import ActivationToken from '@/models/ActivationToken'
import { INVOICE_STATUS, INVOICE_TYPES, TENANT_STATUS } from '@/lib/constants'
import { logPlatformAudit } from '@/models/PlatformAuditLog'
import { generateInvoiceNumber } from '@/lib/invoice-numbering'

void Tenant
void Invoice
void ActivationToken

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

// Grace between the due date and the OVERDUE flip. Bank transfers land
// with a lag; day-boundary math is also messier without this because
// dueDate is a UTC instant, not a calendar day. 7 days is generous.
const OVERDUE_GRACE_DAYS = 7

// Comparing HMAC/tokens with `===` leaks length via early-return. Use a
// constant-time compare, padding both sides to equal length so mismatched
// lengths don't short-circuit either.
function safeEqual(a: string, b: string): boolean {
  const A = Buffer.from(a)
  const B = Buffer.from(b)
  if (A.length !== B.length) return false
  return timingSafeEqual(A, B)
}

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Falls back to
// checking a `x-cron-secret` header when the cron is invoked from
// somewhere other than Vercel's dispatcher.
function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false // fail closed
  const bearer = request.headers.get('authorization')
  if (bearer && bearer.startsWith('Bearer ')) {
    return safeEqual(bearer.slice(7), secret)
  }
  const header = request.headers.get('x-cron-secret')
  return header ? safeEqual(header, secret) : false
}

// POST /api/cron/billing
//
// Idempotent daily sweep:
//   • PENDING invoices past due+grace           → OVERDUE
//   • TRIAL tenants past trialEndsAt            → PAST_DUE
//   • ANNUAL_RENEWAL renewals for tenants whose
//     currentPeriodEnd has arrived              → new invoice + advance
//     the tenant's period. Guarded by the unique
//     {tenantId, type, periodKey} index — a
//     second invocation returns a no-op.
//   • Sweep any ActivationTokens whose TTL
//     Mongo hasn't yet expired (cheap belt-
//     and-braces, mostly for local Mongo where
//     the TTL monitor is minute-grained).
//
// GET is accepted with the same auth for smoke tests.
export async function GET(request: NextRequest) {
  return handle(request)
}
export async function POST(request: NextRequest) {
  return handle(request)
}

async function handle(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  await dbConnect()
  const now = new Date()

  // ── (1) PENDING → OVERDUE (past due + grace) ─────────────────────────
  const overdueBefore = new Date(now.getTime() - OVERDUE_GRACE_DAYS * 24 * 60 * 60 * 1000)
  const overdueResult = await Invoice.updateMany(
    {
      status: INVOICE_STATUS.PENDING,
      dueDate: { $lt: overdueBefore },
    },
    { $set: { status: INVOICE_STATUS.OVERDUE } }
  )
  const overdueMarked = overdueResult.modifiedCount ?? 0

  // ── (2) TRIAL past trialEndsAt → PAST_DUE ─────────────────────────────
  const trialLapsedResult = await Tenant.updateMany(
    {
      status: TENANT_STATUS.TRIAL,
      trialEndsAt: { $lte: now },
    },
    { $set: { status: TENANT_STATUS.PAST_DUE } }
  )
  const trialsLapsed = trialLapsedResult.modifiedCount ?? 0

  // ── (3) Generate ANNUAL_RENEWAL for tenants at end of period ─────────
  //
  // Read fresh: this list is small (bounded by tenants renewing today).
  // For each, try to insert a renewal invoice with the period key. If
  // the unique index rejects (E11000), that period already has a
  // renewal — either from a prior cron run or a manual creation — and
  // we skip. This is the idempotency guarantee.
  const renewalDue = await Tenant.find({
    provisioningState: { $ne: 'PROVISIONING' },
    'billing.currentPeriodEnd': { $lte: now },
    'billing.annualFeeAmountTND': { $gt: 0 },
    status: { $in: [TENANT_STATUS.ACTIVE, TENANT_STATUS.PAST_DUE, TENANT_STATUS.TRIAL] },
  })
    .select('_id billing.annualFeeAmountTND billing.currentPeriodEnd billing.currentPeriodStart')
    .lean<
      {
        _id: import('mongoose').Types.ObjectId
        billing?: {
          annualFeeAmountTND?: number
          currentPeriodEnd?: Date
          currentPeriodStart?: Date
        }
      }[]
    >()

  let renewalsGenerated = 0
  const errors: string[] = []
  for (const t of renewalDue) {
    const currentEnd = t.billing?.currentPeriodEnd ?? now
    // Advance to the next period. Always compute from currentPeriodEnd,
    // never from `now`, so a delayed cron doesn't skip a period.
    const nextStart = new Date(currentEnd)
    const nextEnd = new Date(currentEnd)
    nextEnd.setUTCFullYear(nextEnd.getUTCFullYear() + 1)
    const periodKey = `${nextEnd.getUTCFullYear()}-${String(nextEnd.getUTCMonth() + 1).padStart(2, '0')}`

    try {
      const invoiceNumber = await generateInvoiceNumber(now)
      await Invoice.create({
        tenantId: t._id,
        type: INVOICE_TYPES.ANNUAL_RENEWAL,
        amountTND: t.billing?.annualFeeAmountTND ?? 0,
        status: INVOICE_STATUS.PENDING,
        dueDate: nextEnd,
        invoiceNumber,
        periodKey,
        // Actor: use a sentinel "system" user id so audits are honest
        // about who ran this. Any 24-hex ObjectId works; the audit row
        // captures actorEmail='system' as the readable label.
        createdBy: t._id, // any id — createdBy is required and non-audited
      })

      // Advance the tenant's own current period *after* the successful
      // insert, so a mid-loop failure doesn't leave the tenant on the
      // next period without a matching invoice.
      await Tenant.updateOne(
        { _id: t._id },
        {
          $set: {
            'billing.currentPeriodStart': nextStart,
            'billing.currentPeriodEnd': nextEnd,
          },
        }
      )
      renewalsGenerated++
    } catch (err: any) {
      if (err?.code === 11000) {
        // Already invoiced for this period — that's the whole point of
        // the unique index. Not an error.
        continue
      }
      errors.push(`${t._id.toString()}: ${(err as Error).message}`)
    }
  }

  // ── (4) Sweep expired ActivationTokens ────────────────────────────────
  const tokenSweep = await ActivationToken.deleteMany({ expiresAt: { $lt: now } })
  const tokensSwept = tokenSweep.deletedCount ?? 0

  await logPlatformAudit({
    actorEmail: 'system',
    action: 'BILLING_SWEEP_RUN',
    metadata: {
      overdueMarked,
      trialsLapsed,
      renewalsGenerated,
      tokensSwept,
      errorCount: errors.length,
      graceDays: OVERDUE_GRACE_DAYS,
    },
  })

  return NextResponse.json({
    ok: true,
    overdueMarked,
    trialsLapsed,
    renewalsGenerated,
    tokensSwept,
    errors,
  })
}
