import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import SessionOccurrence from "@/models/SessionOccurrence"
import SessionTemplate from "@/models/SessionTemplate"
import StudentSession from "@/models/StudentSession"
import Attendance from "@/models/Attendance"
import Student from "@/models/Student"
import User from "@/models/User"
import { auth } from "@/lib/auth"
import { ATTENDANCE_STATUS, SESSION_STATUS, DEFAULT_QR_SETTINGS, ROLES } from "@/lib/constants"

// Force model registration (needed for populate in serverless)
void SessionOccurrence
void SessionTemplate
void StudentSession
void Attendance
void Student
void User

// GET /api/attendance/by-date?date=2024-12-09
// Returns all sessions for that date with their students and attendance
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session || (session.user.role !== ROLES.ADMIN && session.user.role !== ROLES.TEACHER)) {
      return NextResponse.json(
        { message: "غير مصرح لك بالوصول" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const dateStr = searchParams.get("date")

    if (!dateStr) {
      return NextResponse.json(
        { message: "التاريخ مطلوب" },
        { status: 400 }
      )
    }

    await dbConnect()

    // Parse date and get day of week
    // Use UTC-consistent date handling to avoid timezone issues
    const [year, month, day] = dateStr.split('-').map(Number)
    const targetDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
    const dayOfWeek = targetDate.getUTCDay()

    // For effectiveFromDate comparison, we need to include sessions that start today
    // Add a buffer to the end of the day to ensure same-day sessions are included
    const targetDateEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999))

    // Find session templates for this day of week
    const sessionTemplates = await SessionTemplate.find({
      dayOfWeek,
      isActive: true,
      effectiveFromDate: { $lte: targetDateEnd },
      $or: [
        { effectiveToDate: { $exists: false } },
        { effectiveToDate: null },
        { effectiveToDate: { $gte: targetDate } }
      ]
    })
      .populate("teacherId", "fullName email")
      .lean()

    // For each session template, get or create the occurrence and students with attendance
    const sessionsWithAttendance = await Promise.all(
      sessionTemplates.map(async (template) => {
        // Find or CREATE occurrence for this date (auto-create if it doesn't exist)
        let occurrence = await SessionOccurrence.findOne({
          sessionTemplateId: template._id,
          date: targetDate
        }).lean()

        // Auto-create occurrence if it doesn't exist
        if (!occurrence) {
          try {
            const [startHour, startMin] = template.startTime.split(":").map(Number)
            const [endHour, endMin] = template.endTime.split(":").map(Number)

            // Use local time for session start/end (sessions are in local time)
            const startDateTime = new Date(year, month - 1, day, startHour, startMin, 0, 0)
            const endDateTime = new Date(year, month - 1, day, endHour, endMin, 0, 0)

            const qrOpenOffset = template.qrOpenOffsetBeforeMin ?? DEFAULT_QR_SETTINGS.openOffsetBeforeMin
            const qrCloseOffset = template.qrCloseOffsetAfterMin ?? DEFAULT_QR_SETTINGS.closeOffsetAfterMin

            const qrOpenDateTime = new Date(startDateTime.getTime() - qrOpenOffset * 60 * 1000)
            const qrCloseDateTime = new Date(endDateTime.getTime() + qrCloseOffset * 60 * 1000)

            const newOccurrence = await SessionOccurrence.create({
              sessionTemplateId: template._id,
              teacherId: template.teacherId,
              date: targetDate,
              startDateTime,
              endDateTime,
              qrOpenDateTime,
              qrCloseDateTime,
              status: SESSION_STATUS.SCHEDULED,
            })
            occurrence = newOccurrence.toObject()
            console.log(`[Attendance] Auto-created occurrence for session "${template.name}" on ${targetDate.toISOString().split('T')[0]}`)
          } catch (occError) {
            console.error(`[Attendance] Error creating occurrence for ${template.name}:`, occError)
          }
        }

        // Get students assigned to this session
        const studentSessions = await StudentSession.find({
          sessionTemplateId: template._id,
          isActive: true
        }).populate({
          path: "studentId",
          select: "fullName firstName lastName fatherName gender phone isActive qrUuid"
        }).lean()

        const students = studentSessions
          .map(ss => ss.studentId)
          .filter(s => s && (s as any).isActive)

        // Get attendance records if occurrence exists
        let attendanceRecords: any[] = []
        if (occurrence) {
          attendanceRecords = await Attendance.find({
            sessionOccurrenceId: occurrence._id
          }).lean()
        }

        // Map students with their attendance
        const studentsWithAttendance = students.map((student: any) => {
          const attendance = attendanceRecords.find(
            a => a.studentId.toString() === student._id.toString()
          )
          const displayName = student.firstName && student.lastName 
            ? `${student.firstName} ${student.lastName}`
            : student.fullName || ''
          return {
            _id: student._id,
            firstName: student.firstName,
            lastName: student.lastName,
            fullName: student.fullName,
            displayName,
            gender: student.gender,
            phone: student.phone,
            status: attendance?.status || ATTENDANCE_STATUS.ABSENT,
            checkInTime: attendance?.checkInTime,
            attendanceId: attendance?._id,
            notes: attendance?.notes
          }
        })

        // Calculate stats
        const presentCount = studentsWithAttendance.filter(
          s => s.status === ATTENDANCE_STATUS.PRESENT || s.status === ATTENDANCE_STATUS.LATE
        ).length
        const lateCount = studentsWithAttendance.filter(
          s => s.status === ATTENDANCE_STATUS.LATE
        ).length
        const absentCount = studentsWithAttendance.filter(
          s => s.status === ATTENDANCE_STATUS.ABSENT
        ).length
        const justifiedCount = studentsWithAttendance.filter(
          s => s.status === ATTENDANCE_STATUS.JUSTIFIED_ABSENCE
        ).length

        return {
          _id: template._id,
          name: template.name,
          teacher: template.teacherId,
          startTime: template.startTime,
          endTime: template.endTime,
          occurrenceId: occurrence?._id,
          occurrenceStatus: occurrence?.status,
          students: studentsWithAttendance,
          stats: {
            total: studentsWithAttendance.length,
            present: presentCount,
            late: lateCount,
            absent: absentCount,
            justified: justifiedCount
          }
        }
      })
    )

    return NextResponse.json({
      date: dateStr,
      dayOfWeek,
      sessions: sessionsWithAttendance
    })
  } catch (error) {
    console.error("Error fetching attendance by date:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء جلب البيانات" },
      { status: 500 }
    )
  }
}
