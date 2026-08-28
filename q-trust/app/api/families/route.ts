import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { z } from 'zod'
import dbConnect from '@/lib/db'
import Family from '@/models/Family'
import Student from '@/models/Student'
import { requireTenantSession, TenantAuthError } from '@/lib/tenant'
import { ROLES } from '@/lib/constants'
import { computeFamilyBilling } from '@/lib/family-billing'
import { parsePagination, buildPaginatedResponse } from '@/lib/pagination'

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
  // Optional initial membership, mirroring PATCH. Previously accepted and
  // silently dropped, so callers had to make a second request to link siblings.
  studentIds: z.array(z.string()).optional(),
})

// GET /api/families?page=&limit= — list families (paginated)
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireTenantSession()
    if (ctx.role !== ROLES.ADMIN) {
      return NextResponse.json({ message: 'غير مصرح' }, { status: 403 })
    }

    await dbConnect()

    const pg = parsePagination(request, { limit: 25 })
    const filter = { tenantId: ctx.tenantId }

    const [families, total] = await Promise.all([
      Family.find(filter).sort({ primaryGuardianName: 1 }).skip(pg.skip).limit(pg.limit).lean(),
      Family.countDocuments(filter),
    ])

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

    const data = families.map((f) => {
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

    return NextResponse.json(buildPaginatedResponse(data, total, pg))
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

    // Link the initial members, tenant-scoped so a caller cannot attach
    // students belonging to another association.
    if (d.studentIds?.length) {
      const validIds = d.studentIds.filter((sid) => mongoose.Types.ObjectId.isValid(sid))
      if (validIds.length > 0) {
        await Student.updateMany(
          { tenantId: ctx.tenantId, _id: { $in: validIds } },
          { $set: { familyId: family._id } }
        )
      }
    }

    return NextResponse.json(family, { status: 201 })
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('Family create error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
