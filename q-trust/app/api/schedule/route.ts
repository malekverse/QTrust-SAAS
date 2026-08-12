import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import SessionTemplate from "@/models/SessionTemplate"
import StudentSession from "@/models/StudentSession"
import Room from "@/models/Room"
import User from "@/models/User"
import { auth } from "@/lib/auth"
import { ROLES } from "@/lib/constants"

void SessionTemplate
void StudentSession
void Room
void User

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || (session.user.role !== ROLES.ADMIN && session.user.role !== ROLES.TEACHER)) {
      return NextResponse.json({ message: "غير مصرح لك بالوصول" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get("roomId")
    const teacherId = searchParams.get("teacherId")

    await dbConnect()

    const query: any = { isActive: true }
    if (roomId) query.roomId = roomId
    if (teacherId) query.teacherId = teacherId

    const sessions = await SessionTemplate.find(query)
      .populate("teacherId", "fullName")
      .populate("roomId", "name capacity")
      .sort({ dayOfWeek: 1, startTime: 1 })
      .lean()

    const sessionsWithCount = await Promise.all(
      sessions.map(async (s) => {
        const studentCount = await StudentSession.countDocuments({
          sessionTemplateId: s._id,
          isActive: true,
        })
        return { ...s, studentCount }
      })
    )

    // Group by day of week
    const byDay: Record<number, typeof sessionsWithCount> = {}
    for (let d = 0; d <= 6; d++) {
      byDay[d] = sessionsWithCount.filter((s) => s.dayOfWeek === d)
    }

    const rooms = await Room.find({ isActive: true }).sort({ name: 1 }).lean()
    const teachers = await User.find({ role: "TEACHER", isActive: true })
      .select("fullName")
      .sort({ fullName: 1 })
      .lean()

    return NextResponse.json({
      sessions: sessionsWithCount,
      byDay,
      rooms,
      teachers,
    })
  } catch (error) {
    console.error("Error fetching schedule:", error)
    return NextResponse.json({ message: "حدث خطأ أثناء جلب البيانات" }, { status: 500 })
  }
}
