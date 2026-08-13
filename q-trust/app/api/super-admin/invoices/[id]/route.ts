import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { z } from 'zod'
import dbConnect from '@/lib/db'
import { requireSuperAdmin, TenantAuthError } from '@/lib/tenant'
import Invoice from '@/models/Invoice'
import Tenant from '@/models/Tenant'
import { INVOICE_STATUS, INVOICE_TYPES, PAYMENT_METHODS } from '@/lib/constants'

void Invoice
void Tenant

const patchSchema = z.object({
  status: z.enum([
    INVOICE_STATUS.PENDING,
    INVOICE_STATUS.PAID,
    INVOICE_STATUS.OVERDUE,
    INVOICE_STATUS.CANCELLED,
  ]),
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
})

// PATCH /api/super-admin/invoices/[id] — record a payment / change invoice status.
// Marking a SETUP invoice PAID also flips the tenant's billing.setupFeePaid flag.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin()
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

    const becomingPaid = d.status === INVOICE_STATUS.PAID
    invoice.status = d.status
    if (becomingPaid) {
      invoice.paidAt = invoice.paidAt ?? new Date()
      if (d.paymentMethod) invoice.paymentMethod = d.paymentMethod
    } else {
      // Un-paying clears the settlement timestamp.
      invoice.paidAt = undefined
    }
    if (d.referenceNumber !== undefined) invoice.referenceNumber = d.referenceNumber
    if (d.notes !== undefined) invoice.notes = d.notes
    await invoice.save()

    // Keep the tenant's setup-fee flag in sync with its SETUP invoice.
    if (invoice.type === INVOICE_TYPES.SETUP) {
      await Tenant.findByIdAndUpdate(invoice.tenantId, {
        'billing.setupFeePaid': becomingPaid,
      })
    }

    return NextResponse.json({
      _id: invoice._id,
      status: invoice.status,
      paidAt: invoice.paidAt,
      paymentMethod: invoice.paymentMethod,
      referenceNumber: invoice.referenceNumber,
    })
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('Update invoice error:', e)
    return NextResponse.json({ message: 'حدث خطأ أثناء تحديث الفاتورة' }, { status: 500 })
  }
}
