import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import dbConnect from '@/lib/db'
import Family from '@/models/Family'
import Student from '@/models/Student'
import { requireTenantSession, TenantAuthError } from '@/lib/tenant'
import { ROLES } from '@/lib/constants'
import { computeFamilyBilling } from '@/lib/family-billing'

void Student

const createSchema = z.object({
  primaryGuardianName: z.string().trim().min(2, 'اسم الولي مطلوب').max(100),
  primaryGuardianPhone: z
    .string()
    .trim()
    .regex(/^\+216\d{8}$/, 'رقم الهاتف يجب أن يكون بصيغة +216XXXXXXXX')
    .optional()
    .or(z.literal('')),
  primaryGuardianEmail: z.string().trim().email('البريد الإلكتروني غير صالح').optional().or(z.literal('')),
  monthlyFeePerChildTND: z.number().min(0).optional(),
  siblingDiscountPercent: z.number().min(0).max(100).optional(),
})

export async function GET() {
  try {
    const ctx = await requireTenantSession()
    if (ctx.role !== ROLES.ADMIN) {
      return NextResponse.json({ message: 'غير مصرح' }, { status: 403 })
    }

    await dbConnect()

    const families = await Family.find({ tenantId: ctx.tenantId })
      .sort({ primaryGuardianName: 1 })
      .lean()

    // Attach members (single source of truth: Student.familyId).
    const members = await Student.find({
      tenantId: ctx.tenantId,
      familyId: { $in: families.map((f) => f._id) },
      isActive: true,
    })
      .select('firstName lastName fullName familyId')
      .lean()

    const byFamily = new Map<string, { _id: string; name: string }[]>()
    for (const s of members) {
      const key = String(s.familyId)
      const name = s.fullName || `${s.firstName || ''} ${s.lastName || ''}`.trim()
      if (!byFamily.has(key)) byFamily.set(key, [])
      byFamily.get(key)!.push({ _id: String(s._id), name })
    }

    const result = families.map((f) => {
      const students = byFamily.get(String(f._id)) || []
      return {
        ...f,
        students,
        billing: computeFamilyBilling(
          f.monthlyFeePerChildTND || 0,
          f.siblingDiscountPercent || 0,
          students.length
        ),
      }
    })

    return NextResponse.json(result)
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('Families list error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireTenantSession()
    if (ctx.role !== ROLES.ADMIN) {
      return NextResponse.json({ message: 'غير مصرح' }, { status: 403 })
    }

    const parsed = createSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
    }

    await dbConnect()

    const d = parsed.data
    const family = await Family.create({
      tenantId: ctx.tenantId,
      primaryGuardianName: d.primaryGuardianName,
      primaryGuardianPhone: d.primaryGuardianPhone || undefined,
      primaryGuardianEmail: d.primaryGuardianEmail || undefined,
      monthlyFeePerChildTND: d.monthlyFeePerChildTND ?? 0,
      siblingDiscountPercent: d.siblingDiscountPercent ?? 0,
    })

    return NextResponse.json(family, { status: 201 })
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('Family create error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
