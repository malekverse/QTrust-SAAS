import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import dbConnect from '@/lib/db'
import HifzLog from '@/models/HifzLog'
import { ROLES, HIFZ_TYPE, HIFZ_QUALITY } from '@/lib/constants'
import { teacherCanAccessStudent } from '@/lib/substitutes'

const createSchema = z.object({
  studentId: z.string().min(1),
  sessionOccurrenceId: z.string().optional(),
  date: z.string().min(1),
  type: z.enum([HIFZ_TYPE.SABAQ, HIFZ_TYPE.SABQI, HIFZ_TYPE.MANZIL]),
  surah: z.string().min(1).max(50),
  fromVerse: z.number().int().min(1),
  toVerse: z.number().int().min(1),
  quality: z.enum([HIFZ_QUALITY.EXCELLENT, HIFZ_QUALITY.GOOD, HIFZ_QUALITY.NEEDS_REVIEW, HIFZ_QUALITY.WEAK]),
  mistakeCount: z.number().int().min(0).optional(),
  notes: z.string().max(500).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== ROLES.ADMIN && session.user.role !== ROLES.TEACHER)) {
      return NextResponse.json({ message: 'غير مصرح' }, { status: 403 })
    }
    const tenantId = session.user.tenantId
    if (!tenantId) {
      return NextResponse.json({ message: 'لا يوجد سياق مؤسسة' }, { status: 403 })
    }

    const parsed = createSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
    }

    await dbConnect()

    // A teacher may only log memorization for students in their own halaqa.
    if (session.user.role === ROLES.TEACHER) {
      const allowed = await teacherCanAccessStudent(tenantId, session.user.id, parsed.data.studentId)
      if (!allowed) {
        return NextResponse.json(
          { message: 'غير مصرح لك بتسجيل بيانات لهذا الطالب' },
          { status: 403 }
        )
      }
    }

    const log = await HifzLog.create({
      tenantId,
      teacherId: session.user.id,
      ...parsed.data,
    })

    return NextResponse.json(log, { status: 201 })
  } catch (e) {
    if (e instanceof Error && e.name === 'ValidationError') {
      const errors = (e as unknown as { errors: Record<string, { message: string }> }).errors
      const msg = Object.values(errors).map((err) => err.message).join(', ')
      return NextResponse.json({ message: msg }, { status: 400 })
    }
    console.error('Hifz create error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || (session.user.role !== ROLES.ADMIN && session.user.role !== ROLES.TEACHER)) {
      return NextResponse.json({ message: 'غير مصرح' }, { status: 403 })
    }
    const tenantId = session.user.tenantId
    if (!tenantId) {
      return NextResponse.json({ message: 'لا يوجد سياق مؤسسة' }, { status: 403 })
    }

    await dbConnect()

    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')
    const occurrenceId = searchParams.get('occurrenceId')
    const limit = Math.min(Number(searchParams.get('limit') || 50), 200)

    const filter: Record<string, unknown> = { tenantId }
    if (studentId) filter.studentId = studentId
    if (occurrenceId) filter.sessionOccurrenceId = occurrenceId

    if (session.user.role === ROLES.TEACHER) {
      filter.teacherId = session.user.id
    }

    const logs = await HifzLog.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .populate('studentId', 'firstName lastName fullName')
      .lean()

    return NextResponse.json(logs)
  } catch (e) {
    console.error('Hifz list error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
