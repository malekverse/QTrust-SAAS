import { NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import User from "@/models/User"
import Student from "@/models/Student"
import StudentSession from "@/models/StudentSession"
import SessionTemplate from "@/models/SessionTemplate"
import SessionOccurrence from "@/models/SessionOccurrence"
import Attendance from "@/models/Attendance"
import { auth } from "@/lib/auth"
import { ROLES, ATTENDANCE_STATUS, SESSION_STATUS } from "@/lib/constants"

// Force model registration
void Student; void User; void StudentSession; void SessionTemplate; void SessionOccurrence; void Attendance

// GET /api/student/sessions - Get student's enrolled sessions
export async function GET() {
  try {
    const session = await auth()
    
    if (!session || session.user.role !== ROLES.STUDENT) {
      return NextResponse.json(
        { message: "غير مصرح لك بالوصول" },
        { status: 403 }
      )
    }

    const tenantId = session.user.tenantId
    if (!tenantId) {
      return NextResponse.json({ message: "لا يوجد سياق مؤسسة" }, { status: 403 })
    }

    await dbConnect()

    const user = await User.findOne({ _id: session.user.id, tenantId }).lean()
    if (!user?.studentId) {
      return NextResponse.json({ message: "حساب الطالب غير موجود" }, { status: 404 })
    }

    const studentId = user.studentId

    // Get student sessions
    const studentSessions = await StudentSession.find({
      tenantId,
      studentId,
      isActive: true
    }).lean()

    const sessionTemplateIds = studentSessions.map(ss => ss.sessionTemplateId)

    // Get session templates with teacher info
    const sessionTemplates = await SessionTemplate.find({
      tenantId,
      _id: { $in: sessionTemplateIds }
    }).populate("teacherId", "fullName").lean()

    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

    // Get upcoming occurrences (next 2 weeks)
    const now = new Date()
    const twoWeeksLater = new Date()
    twoWeeksLater.setDate(twoWeeksLater.getDate() + 14)

    const upcomingOccurrences = await SessionOccurrence.find({
      tenantId,
      sessionTemplateId: { $in: sessionTemplateIds },
      date: { $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()), $lte: twoWeeksLater }
    }).sort({ date: 1 }).lean()

    // Get attendance for these occurrences
    const occurrenceIds = upcomingOccurrences.map(o => o._id)
    const attendanceRecords = await Attendance.find({
      tenantId,
      studentId,
      sessionOccurrenceId: { $in: occurrenceIds }
    }).lean()

    // Build sessions data
    const sessions = sessionTemplates.map(template => {
      const templateOccurrences = upcomingOccurrences
        .filter(o => o.sessionTemplateId.toString() === template._id.toString())
        .map(occ => {
          const att = attendanceRecords.find(
            a => a.sessionOccurrenceId.toString() === occ._id.toString()
          )
          return {
            _id: occ._id,
            date: occ.date,
            status: occ.status,
            attendanceStatus: att?.status || null,
            checkInTime: att?.checkInTime || null
          }
        })

      return {
        _id: template._id,
        name: template.name,
        teacher: (template.teacherId as any)?.fullName || '',
        dayOfWeek: template.dayOfWeek,
        dayName: days[template.dayOfWeek],
        startTime: template.startTime,
        endTime: template.endTime,
        isActive: template.isActive,
        description: template.description,
        upcomingOccurrences: templateOccurrences
      }
    })

    // Build weekly calendar view
    const weeklyCalendar = Array.from({ length: 7 }, (_, dayIndex) => {
      const daySessions = sessions.filter(s => s.dayOfWeek === dayIndex)
      return {
        dayOfWeek: dayIndex,
        dayName: days[dayIndex],
        sessions: daySessions
      }
    }).filter(d => d.sessions.length > 0)

    return NextResponse.json({
      sessions,
      weeklyCalendar,
      totalSessions: sessions.length
    })
  } catch (error) {
    console.error("Error fetching student sessions:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء جلب البيانات" },
      { status: 500 }
    )
  }
}
