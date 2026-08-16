import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { z } from 'zod'
import dbConnect from '@/lib/db'
import SubstituteAssignment from '@/models/SubstituteAssignment'
import SessionTemplate from '@/models/SessionTemplate'
import User from '@/models/User'
import { requireTenantSession, TenantAuthError } from '@/lib/tenant'
import { ROLES } from '@/lib/constants'
import { parsePagination, buildPaginatedResponse } from '@/lib/pagination'

void SessionTemplate
void User

const createSchema = z.object({
  sessionTemplateId: z.string().min(1),
  substituteUserId: z.string().min(1),
  validFrom: z.string().min(1),
  validTo: z.string().min(1),
  notes: z.string().trim().max(300).optional().or(z.literal('')),
})

// GET /api/substitutes?page=&limit= — list substitute assignments (paginated)
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireTenantSession()
    if (ctx.role !== ROLES.ADMIN) {
      return NextResponse.json({ message: 'غير مصرح' }, { status: 403 })
    }

    await dbConnect()

    const pg = parsePagination(request, { limit: 25 })
    const filter = { tenantId: ctx.tenantId }

    const [rows, total] = await Promise.all([
      SubstituteAssignment.find(filter)
        .sort({ validFrom: -1 })
        .skip(pg.skip)
        .limit(pg.limit)
        .populate('sessionTemplateId', 'name')
        .populate('substituteUserId', 'fullName')
        .lean(),
      SubstituteAssignment.countDocuments(filter),
    ])

    const now = Date.now()
    const data = rows.map((r) => ({
      ...r,
      active:
        new Date(r.validFrom).getTime() <= now && new Date(r.validTo).getTime() >= now,
    }))

    return NextResponse.json(buildPaginatedResponse(data, total, pg))
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('Substitutes list error:', e)
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
    const d = parsed.data

    const from = new Date(d.validFrom)
    from.setHours(0, 0, 0, 0)
    const to = new Date(d.validTo)
    to.setHours(23, 59, 59, 999)
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
      return NextResponse.json({ message: 'نطاق التاريخ غير صالح' }, { status: 400 })
    }

    await dbConnect()

    // Both the session template and the substitute must belong to this tenant.
    const [template, substitute] = await Promise.all([
      SessionTemplate.findOne({ _id: d.sessionTemplateId, tenantId: ctx.tenantId }).select('_id teacherId').lean(),
      User.findOne({ _id: d.substituteUserId, tenantId: ctx.tenantId, role: ROLES.TEACHER, isActive: true }).select('_id').lean(),
    ])
    if (!template) {
      return NextResponse.json({ message: 'الحصة غير موجودة' }, { status: 404 })
    }
    if (!substitute) {
      return NextResponse.json({ message: 'المعلم النائب غير موجود' }, { status: 404 })
    }
    if (String((template as { teacherId: mongoose.Types.ObjectId }).teacherId) === d.substituteUserId) {
      return NextResponse.json(
        { message: 'المعلم الأصلي لا يمكن أن يكون نائباً عن نفسه' },
        { status: 400 }
      )
    }

    const assignment = await SubstituteAssignment.create({
      tenantId: ctx.tenantId,
      sessionTemplateId: d.sessionTemplateId,
      substituteUserId: d.substituteUserId,
      validFrom: from,
      validTo: to,
      assignedByUserId: ctx.userId,
      notes: d.notes || undefined,
    })

    return NextResponse.json(assignment, { status: 201 })
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('Substitute create error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
