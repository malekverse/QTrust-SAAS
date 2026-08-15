import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { z } from 'zod'
import dbConnect from '@/lib/db'
import Family from '@/models/Family'
import Student from '@/models/Student'
import { requireTenantSession, TenantAuthError } from '@/lib/tenant'
import { ROLES } from '@/lib/constants'
import { computeFamilyBilling } from '@/lib/family-billing'

void Student

const patchSchema = z.object({
  primaryGuardianName: z.string().trim().min(2).max(100).optional(),
  primaryGuardianPhone: z
    .string()
    .trim()
    .regex(/^\+216\d{8}$/, 'رقم الهاتف يجب أن يكون بصيغة +216XXXXXXXX')
    .optional()
    .or(z.literal('')),
  primaryGuardianEmail: z.string().trim().email('البريد الإلكتروني غير صالح').optional().or(z.literal('')),
  monthlyFeePerChildTND: z.number().min(0).optional(),
  siblingDiscountPercent: z.number().min(0).max(100).optional(),
  // Full desired membership; server reconciles Student.familyId to match.
  studentIds: z.array(z.string()).optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireTenantSession()
    if (ctx.role !== ROLES.ADMIN) {
      return NextResponse.json({ message: 'غير مصرح' }, { status: 403 })
    }
    const { id } = await params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'معرّف غير صالح' }, { status: 400 })
    }

    await dbConnect()
    const family = await Family.findOne({ _id: id, tenantId: ctx.tenantId }).lean()
    if (!family) return NextResponse.json({ message: 'العائلة غير موجودة' }, { status: 404 })

    const students = await Student.find({ tenantId: ctx.tenantId, familyId: id, isActive: true })
      .select('firstName lastName fullName')
      .lean()

    return NextResponse.json({
      ...family,
      students: students.map((s) => ({
        _id: String(s._id),
        name: s.fullName || `${s.firstName || ''} ${s.lastName || ''}`.trim(),
      })),
      billing: computeFamilyBilling(
        family.monthlyFeePerChildTND || 0,
        family.siblingDiscountPercent || 0,
        students.length
      ),
    })
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('Family get error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireTenantSession()
    if (ctx.role !== ROLES.ADMIN) {
      return NextResponse.json({ message: 'غير مصرح' }, { status: 403 })
    }
    const { id } = await params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'معرّف غير صالح' }, { status: 400 })
    }

    const parsed = patchSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
    }

    await dbConnect()
    const family = await Family.findOne({ _id: id, tenantId: ctx.tenantId })
    if (!family) return NextResponse.json({ message: 'العائلة غير موجودة' }, { status: 404 })

    const d = parsed.data
    if (d.primaryGuardianName !== undefined) family.primaryGuardianName = d.primaryGuardianName
    if (d.primaryGuardianPhone !== undefined) family.primaryGuardianPhone = d.primaryGuardianPhone || undefined
    if (d.primaryGuardianEmail !== undefined) family.primaryGuardianEmail = d.primaryGuardianEmail || undefined
    if (d.monthlyFeePerChildTND !== undefined) family.monthlyFeePerChildTND = d.monthlyFeePerChildTND
    if (d.siblingDiscountPercent !== undefined) family.siblingDiscountPercent = d.siblingDiscountPercent
    await family.save({ validateModifiedOnly: true })

    // Reconcile membership if provided: only touch students within this tenant.
    if (d.studentIds) {
      const validIds = d.studentIds.filter((sid) => mongoose.Types.ObjectId.isValid(sid))
      // Assign the requested students to this family.
      await Student.updateMany(
        { _id: { $in: validIds }, tenantId: ctx.tenantId },
        { $set: { familyId: family._id } }
      )
      // Detach any student currently in this family but no longer selected.
      await Student.updateMany(
        { tenantId: ctx.tenantId, familyId: family._id, _id: { $nin: validIds } },
        { $unset: { familyId: '' } }
      )
    }

    return NextResponse.json(family)
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    if (e instanceof Error && e.name === 'ValidationError') {
      const errors = (e as unknown as { errors: Record<string, { message: string }> }).errors
      const msg = Object.values(errors).map((err) => err.message).join(', ')
      return NextResponse.json({ message: msg }, { status: 400 })
    }
    console.error('Family update error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireTenantSession()
    if (ctx.role !== ROLES.ADMIN) {
      return NextResponse.json({ message: 'غير مصرح' }, { status: 403 })
    }
    const { id } = await params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'معرّف غير صالح' }, { status: 400 })
    }

    await dbConnect()
    const family = await Family.findOneAndDelete({ _id: id, tenantId: ctx.tenantId })
    if (!family) return NextResponse.json({ message: 'العائلة غير موجودة' }, { status: 404 })

    // Detach members so no student points at a deleted family.
    await Student.updateMany(
      { tenantId: ctx.tenantId, familyId: id },
      { $unset: { familyId: '' } }
    )

    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('Family delete error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
