import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { z } from 'zod'
import dbConnect from '@/lib/db'
import { requireSuperAdmin, TenantAuthError } from '@/lib/tenant'
import Invoice from '@/models/Invoice'
import Tenant from '@/models/Tenant'
import { clearTenantStatusCache } from '@/lib/tenant-status'
import { INVOICE_STATUS, INVOICE_TYPES, PAYMENT_METHODS, TENANT_STATUS } from '@/lib/constants'
import { logPlatformAudit } from '@/models/PlatformAuditLog'
import { getClientIp } from '@/lib/rate-limit'

void Invoice
void Tenant

const patchSchema = z.object({
  status: z
    .enum([
      INVOICE_STATUS.PENDING,
      INVOICE_STATUS.PAID,
      INVOICE_STATUS.OVERDUE,
      INVOICE_STATUS.CANCELLED,
    ])
    .optional(),
  paymentMethod: z
    .enum([
      PAYMENT_METHODS.BANK_TRANSFER,
      PAYMENT_METHODS.CHECK,
      PAYMENT_METHODS.CASH,
      PAYMENT_METHODS.CARD,
    ])
    .optional(),
  referenceNumber: z.string().max(120).optional(),
  notes: z.string().max(1000).optional(),
  proofUrl: z.string().trim().max(2048).optional().or(z.literal('')),
})

// PATCH /api/super-admin/invoices/[id] — record a payment, change status,
// attach proof, or edit notes. Recording payment on the last outstanding
// invoice of a PAST_DUE tenant auto-promotes the tenant back to ACTIVE —
// that's the missing half of the loop the cron opens by flipping
// tenants to PAST_DUE.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireSuperAdmin()
    const { id } = await params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'معرّف غير صالح' }, { status: 400 })
    }

    const parsed = patchSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
    }
    const d = parsed.data

    await dbConnect()
    const invoice = await Invoice.findById(id)
    if (!invoice) {
      return NextResponse.json({ message: 'الفاتورة غير موجودة' }, { status: 404 })
    }

    const wasPaid = invoice.status === INVOICE_STATUS.PAID
    const willBePaid = d.status ? d.status === INVOICE_STATUS.PAID : wasPaid
    if (d.status !== undefined) invoice.status = d.status
    if (d.status !== undefined) {
      if (willBePaid) {
        invoice.paidAt = invoice.paidAt ?? new Date()
        if (d.paymentMethod) invoice.paymentMethod = d.paymentMethod
      } else {
        // Un-paying clears the settlement timestamp.
        invoice.paidAt = undefined
      }
    }
    if (d.referenceNumber !== undefined) invoice.referenceNumber = d.referenceNumber
    if (d.notes !== undefined) invoice.notes = d.notes
    if (d.proofUrl !== undefined) invoice.proofUrl = d.proofUrl || undefined
    if (d.paymentMethod !== undefined && !willBePaid) invoice.paymentMethod = d.paymentMethod
    await invoice.save()

    // Keep the tenant's setup-fee flag in sync with its SETUP invoice.
    if (invoice.type === INVOICE_TYPES.SETUP && d.status !== undefined) {
      await Tenant.findByIdAndUpdate(invoice.tenantId, {
        'billing.setupFeePaid': willBePaid,
      })
    }

    // Payment recovery loop: if we just marked the tenant's last
    // outstanding invoice paid AND the tenant is currently PAST_DUE,
    // promote it back to ACTIVE. Also clear the per-instance status
    // cache so the tenant's users see the change immediately.
    let tenantReactivated = false
    if (!wasPaid && willBePaid) {
      const tenant = await Tenant.findById(invoice.tenantId)
        .select('_id status')
        .lean<{ _id: mongoose.Types.ObjectId; status: string } | null>()
      if (tenant && tenant.status === TENANT_STATUS.PAST_DUE) {
        const stillOutstanding = await Invoice.countDocuments({
          tenantId: tenant._id,
          status: { $in: [INVOICE_STATUS.PENDING, INVOICE_STATUS.OVERDUE] },
        })
        if (stillOutstanding === 0) {
          await Tenant.updateOne(
            { _id: tenant._id },
            { $set: { status: TENANT_STATUS.ACTIVE } }
          )
          clearTenantStatusCache(String(tenant._id))
          tenantReactivated = true
          await logPlatformAudit({
            actorUserId: actor.id,
            actorEmail: actor.email || 'unknown',
            action: 'TENANT_STATUS_CHANGED',
            targetType: 'Tenant',
            targetId: tenant._id,
            tenantId: tenant._id,
            metadata: { from: TENANT_STATUS.PAST_DUE, to: TENANT_STATUS.ACTIVE, trigger: 'invoice_paid' },
            ip: getClientIp(request),
            userAgent: request.headers.get('user-agent') || undefined,
          })
        }
      }
    }

    // Audit the invoice itself.
    if (d.status !== undefined) {
      await logPlatformAudit({
        actorUserId: actor.id,
        actorEmail: actor.email || 'unknown',
        action:
          d.status === INVOICE_STATUS.PAID
            ? 'INVOICE_PAID'
            : d.status === INVOICE_STATUS.CANCELLED
              ? 'INVOICE_CANCELLED'
              : 'INVOICE_CREATED', // rare: revert-to-PENDING/OVERDUE reuses the generic bucket
        targetType: 'Invoice',
        targetId: invoice._id,
        tenantId: invoice.tenantId,
        metadata: {
          invoiceNumber: invoice.invoiceNumber,
          amountTND: invoice.amountTND,
          status: invoice.status,
        },
        ip: getClientIp(request),
        userAgent: request.headers.get('user-agent') || undefined,
      })
    }

    return NextResponse.json({
      _id: invoice._id,
      status: invoice.status,
      paidAt: invoice.paidAt,
      paymentMethod: invoice.paymentMethod,
      referenceNumber: invoice.referenceNumber,
      proofUrl: invoice.proofUrl,
      notes: invoice.notes,
      tenantReactivated,
    })
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('Update invoice error:', e)
    return NextResponse.json({ message: 'حدث خطأ أثناء تحديث الفاتورة' }, { status: 500 })
  }
}
