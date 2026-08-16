import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import dbConnect from '@/lib/db'
import Student from '@/models/Student'
import Tenant from '@/models/Tenant'
import { requireTier } from '@/lib/entitlements'
import { TenantAuthError } from '@/lib/tenant'
import { ROLES, PLANS, MESSAGE_TYPE, MONTH_LABELS } from '@/lib/constants'
import { sendMessage } from '@/lib/notifications/messaging'

void Student
void Tenant

const schema = z.object({
  studentId: z.string().min(1),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020),
})

// POST /api/payments/remind — send a payment reminder to a student's guardian
// via the tenant's configured messaging provider (STANDARD+). No-ops (records
// SKIPPED) if messaging isn't configured yet.
export async function POST(request: NextRequest) {
  try {
    const { session, tenant } = await requireTier(PLANS.STANDARD)
    if (session.role !== ROLES.ADMIN) {
      return NextResponse.json({ message: 'غير مصرح' }, { status: 403 })
    }

    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
    }
    const { studentId, month, year } = parsed.data

    await dbConnect()
    const student = await Student.findOne({ _id: studentId, tenantId: session.tenantId })
      .select('firstName lastName fullName parentPhone phone')
      .lean<{ firstName?: string; lastName?: string; fullName?: string; parentPhone?: string; phone?: string }>()
    if (!student) {
      return NextResponse.json({ message: 'الطالب غير موجود' }, { status: 404 })
    }

    const to = student.parentPhone || student.phone
    if (!to) {
      return NextResponse.json({ message: 'لا يوجد رقم هاتف لوليّ الطالب' }, { status: 400 })
    }

    const studentName = student.fullName || `${student.firstName || ''} ${student.lastName || ''}`.trim()
    const monthLabel = MONTH_LABELS[month as keyof typeof MONTH_LABELS] || String(month)
    const assoc = tenant.branding?.displayName || tenant.name
    const body =
      `السلام عليكم ورحمة الله،\n` +
      `نذكّركم بخصوص اشتراك ${studentName} لشهر ${monthLabel} ${year} في ${assoc}.\n` +
      `جزاكم الله خيراً.`

    const result = await sendMessage({
      tenantId: session.tenantId,
      to,
      body,
      type: MESSAGE_TYPE.PAYMENT_REMINDER,
      studentId,
      createdByUserId: session.userId,
    })

    return NextResponse.json(result)
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('Payment reminder error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
