import { NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import StudentSession from "@/models/StudentSession"
import SessionTemplate from "@/models/SessionTemplate"
import Student from "@/models/Student"
import Room from "@/models/Room"
import User from "@/models/User"
import { auth } from "@/lib/auth"
import { ROLES } from "@/lib/constants"

void StudentSession
void SessionTemplate
void Student
void Room
void User

export async function GET() {
  try {
    const session = await auth()
    if (!session || session.user.role !== ROLES.STUDENT) {
      return NextResponse.json({ message: "غير مصرح لك بالوصول" }, { status: 403 })
    }

    await dbConnect()

    const student = await Student.findOne({ userId: session.user.id }).lean()
    if (!student) {
      return NextResponse.json({ message: "الطالب غير موجود" }, { status: 404 })
    }

    const enrollments = await StudentSession.find({
      studentId: student._id,
      isActive: true,
    })
      .populate({
        path: "sessionTemplateId",
        populate: [
          { path: "teacherId", select: "fullName" },
          { path: "roomId", select: "name capacity location" },
        ],
      })
      .lean()

    const sessions = enrollments
      .filter((e) => e.sessionTemplateId)
      .map((e) => {
        const tmpl = e.sessionTemplateId as any
        return {
          _id: tmpl._id,
          name: tmpl.name,
          dayOfWeek: tmpl.dayOfWeek,
          startTime: tmpl.startTime,
          endTime: tmpl.endTime,
          teacher: tmpl.teacherId?.fullName || "",
          room: tmpl.roomId ? { name: tmpl.roomId.name, location: tmpl.roomId.location } : null,
          isActive: tmpl.isActive,
        }
      })
      .sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
        return a.startTime.localeCompare(b.startTime)
      })

    // Group by day
    const byDay: Record<number, typeof sessions> = {}
    for (let d = 0; d <= 6; d++) {
      byDay[d] = sessions.filter((s) => s.dayOfWeek === d)
    }

    return NextResponse.json({ sessions, byDay })
  } catch (error) {
    console.error("Error fetching student schedule:", error)
    return NextResponse.json({ message: "حدث خطأ أثناء جلب البيانات" }, { status: 500 })
  }
}
