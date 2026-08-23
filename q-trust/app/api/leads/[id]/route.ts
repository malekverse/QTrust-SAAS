import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { z } from 'zod'
import { requireSuperAdmin, TenantAuthError } from '@/lib/tenant'
import dbConnect from '@/lib/db'
import Lead, { LEAD_STATUS } from '@/models/Lead'
import { logPlatformAudit } from '@/models/PlatformAuditLog'
import { getClientIp } from '@/lib/rate-limit'

void Lead

// GET /api/leads/[id] — super-admin only. One lead with its notes.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin()
    const { id } = await params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'معرّف غير صالح' }, { status: 400 })
    }
    await dbConnect()
    const lead = await Lead.findById(id).lean<Record<string, unknown> | null>()
    if (!lead) {
      return NextResponse.json({ message: 'الطلب غير موجود' }, { status: 404 })
    }
    // Legacy rows pre-date `notes`, so `.lean()` returns them without the
    // field — normalize to [] so every client can rely on the shape.
    if (!Array.isArray(lead.notes)) lead.notes = []
    return NextResponse.json(lead)
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('Get lead error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}

const patchSchema = z.object({
  status: z.enum(Object.values(LEAD_STATUS) as [string, ...string[]]).optional(),
  followUpAt: z.string().datetime({ offset: true }).nullable().optional(),
  contactedAt: z.string().datetime({ offset: true }).nullable().optional(),
})

// PATCH /api/leads/[id] — status + follow-up scheduling. CONVERTED is
// terminal: the convert flow sets it via the provisioning service, not here.
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
    if (d.status === LEAD_STATUS.CONVERTED) {
      return NextResponse.json(
        { message: 'استخدم إجراء التحويل إلى مؤسسة' },
        { status: 400 }
      )
    }

    await dbConnect()
    const existing = await Lead.findById(id).select('status').lean<{ status: string } | null>()
    if (!existing) {
      return NextResponse.json({ message: 'الطلب غير موجود' }, { status: 404 })
    }
    // Once converted, don't allow flipping the status back or off — the lead
    // is joined to a Tenant and the label needs to reflect that.
    if (existing.status === LEAD_STATUS.CONVERTED && d.status && d.status !== LEAD_STATUS.CONVERTED) {
      return NextResponse.json(
        { message: 'لا يمكن تغيير حالة طلب سبق تحويله' },
        { status: 409 }
      )
    }

    const update: Record<string, unknown> = {}
    if (d.status) update.status = d.status
    if (d.followUpAt !== undefined) update.followUpAt = d.followUpAt ? new Date(d.followUpAt) : null
    if (d.contactedAt !== undefined) update.contactedAt = d.contactedAt ? new Date(d.contactedAt) : null
    if (d.status === LEAD_STATUS.CONTACTED && !d.contactedAt) {
      update.contactedAt = new Date()
    }

    const lead = await Lead.findByIdAndUpdate(id, update, { new: true, runValidators: true })
    if (!lead) {
      return NextResponse.json({ message: 'الطلب غير موجود' }, { status: 404 })
    }
    return NextResponse.json(lead)
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('Patch lead error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}

// DELETE /api/leads/[id] — super-admin only. Refuses to delete a lead that
// has already been converted (its convertedTenantId is the audit trail).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireSuperAdmin()
    const { id } = await params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'معرّف غير صالح' }, { status: 400 })
    }
    await dbConnect()
    const lead = await Lead.findById(id).select('status associationName').lean<
      { _id: mongoose.Types.ObjectId; status: string; associationName: string } | null
    >()
    if (!lead) {
      return NextResponse.json({ message: 'الطلب غير موجود' }, { status: 404 })
    }
    if (lead.status === LEAD_STATUS.CONVERTED) {
      return NextResponse.json(
        { message: 'لا يمكن حذف طلب سبق تحويله' },
        { status: 409 }
      )
    }
    await Lead.deleteOne({ _id: id })

    await logPlatformAudit({
      actorUserId: actor.id,
      actorEmail: actor.email || 'unknown',
      action: 'LEAD_DELETED',
      targetType: 'Lead',
      targetId: id,
      metadata: { associationName: lead.associationName },
      ip: getClientIp(request),
      userAgent: request.headers.get('user-agent') || undefined,
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('Delete lead error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
