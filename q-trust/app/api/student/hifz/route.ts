import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import dbConnect from '@/lib/db'
import HifzLog from '@/models/HifzLog'
import { ROLES } from '@/lib/constants'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== ROLES.STUDENT) {
      return NextResponse.json({ message: 'غير مصرح' }, { status: 403 })
    }
    const tenantId = session.user.tenantId
    const studentId = session.user.studentId
    if (!tenantId || !studentId) {
      return NextResponse.json({ message: 'لا يوجد سياق' }, { status: 403 })
    }

    await dbConnect()

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit') || 50), 200)

    const logs = await HifzLog.find({ tenantId, studentId })
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .populate('teacherId', 'fullName')
      .lean()

    return NextResponse.json(logs)
  } catch (e) {
    console.error('Student hifz error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
