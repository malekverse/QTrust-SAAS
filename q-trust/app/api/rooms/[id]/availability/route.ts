import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import Room from "@/models/Room"
import SessionTemplate from "@/models/SessionTemplate"
import StudentSession from "@/models/StudentSession"
import { auth } from "@/lib/auth"
import { ROLES } from "@/lib/constants"
import { invalidObjectId } from "@/lib/object-id"

void Room
void SessionTemplate
void StudentSession

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session || (session.user.role !== ROLES.ADMIN && session.user.role !== ROLES.TEACHER)) {
      return NextResponse.json({ message: "غير مصرح لك بالوصول" }, { status: 403 })
    }

    const tenantId = session.user.tenantId
    if (!tenantId) {
      return NextResponse.json({ message: "لا يوجد سياق مؤسسة" }, { status: 403 })
    }

    const { id } = await params
    const bad = invalidObjectId(id)
    if (bad) return bad
    await dbConnect()

    const room = await Room.findOne({ _id: id, tenantId }).lean()
    if (!room) {
      return NextResponse.json({ message: "القاعة غير موجودة" }, { status: 404 })
    }

    const sessions = await SessionTemplate.find({ tenantId, roomId: id, isActive: true })
      .populate("teacherId", "fullName")
      .sort({ dayOfWeek: 1, startTime: 1 })
      .lean()

    const sessionsWithCount = await Promise.all(
      sessions.map(async (s) => {
        const studentCount = await StudentSession.countDocuments({
          tenantId,
          sessionTemplateId: s._id,
          isActive: true,
        })
        return { ...s, studentCount }
      })
    )

    // Group by day of week for grid rendering
    const weeklyGrid: Record<number, typeof sessionsWithCount> = {}
    for (let day = 0; day <= 6; day++) {
      weeklyGrid[day] = sessionsWithCount.filter((s) => s.dayOfWeek === day)
    }

    return NextResponse.json({
      room,
      weeklyGrid,
    })
  } catch (error) {
    console.error("Error fetching room availability:", error)
    return NextResponse.json({ message: "حدث خطأ أثناء جلب البيانات" }, { status: 500 })
  }
}
