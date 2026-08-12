import { NextRequest, NextResponse } from "next/server"
import mongoose from "mongoose"
import dbConnect from "@/lib/db"
import SessionTemplate from "@/models/SessionTemplate"
import SessionOccurrence from "@/models/SessionOccurrence"
import StudentSession from "@/models/StudentSession"
import Attendance from "@/models/Attendance"
import Student from "@/models/Student"
import Room from "@/models/Room"
import { auth } from "@/lib/auth"
import { updateAttendanceSchema } from "@/lib/validations"
import { ATTENDANCE_STATUS, ATTENDANCE_CREATOR, SESSION_STATUS, DEFAULT_QR_SETTINGS, ROLES } from "@/lib/constants"

void SessionTemplate
void SessionOccurrence
void StudentSession
void Attendance
void Student
void Room

// GET /api/sessions/[id]/attendance?date=YYYY-MM-DD
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json(
        { message: "غير مصرح لك بالوصول" },
        { status: 403 }
      )
    }

    // Only staff (admin or teacher) may view session attendance rosters
    if (session.user.role !== ROLES.ADMIN && session.user.role !== ROLES.TEACHER) {
      return NextResponse.json(
        { message: "غير مصرح لك بالوصول" },
        { status: 403 }
      )
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get("date")

    await dbConnect()

    const sessionTemplate = await SessionTemplate.findById(id)
      .populate("teacherId", "fullName")
      .populate("roomId", "name capacity location")
      .lean()

    if (!sessionTemplate) {
      return NextResponse.json(
        { message: "الحصة غير موجودة" },
        { status: 404 }
      )
    }

    // Determine the date
    const targetDate = dateParam ? new Date(dateParam) : new Date()
    targetDate.setHours(0, 0, 0, 0)

    // Get or create session occurrence
    let occurrence = await SessionOccurrence.findOne({
      sessionTemplateId: id,
      date: targetDate,
    }).lean()

    if (!occurrence) {
      // Create occurrence on the fly
      const [startHour, startMin] = sessionTemplate.startTime.split(":").map(Number)
      const [endHour, endMin] = sessionTemplate.endTime.split(":").map(Number)

      const startDateTime = new Date(targetDate)
      startDateTime.setHours(startHour, startMin, 0, 0)

      const endDateTime = new Date(targetDate)
      endDateTime.setHours(endHour, endMin, 0, 0)

      const qrOpenOffset = sessionTemplate.qrOpenOffsetBeforeMin ?? DEFAULT_QR_SETTINGS.openOffsetBeforeMin
      const qrCloseOffset = sessionTemplate.qrCloseOffsetAfterMin ?? DEFAULT_QR_SETTINGS.closeOffsetAfterMin

      const qrOpenDateTime = new Date(startDateTime.getTime() - qrOpenOffset * 60 * 1000)
      const qrCloseDateTime = new Date(endDateTime.getTime() + qrCloseOffset * 60 * 1000)

      const newOccurrence = await SessionOccurrence.create({
        sessionTemplateId: id,
        teacherId: sessionTemplate.teacherId,
        date: targetDate,
        startDateTime,
        endDateTime,
        qrOpenDateTime,
        qrCloseDateTime,
        status: SESSION_STATUS.SCHEDULED,
      })

      occurrence = newOccurrence.toObject()
    }

    // Get students assigned to this session
    const studentSessions = await StudentSession.find({
      sessionTemplateId: id,
      isActive: true,
    })
      .populate("studentId", "fullName parentName qrUuid")
      .lean()

    // Get attendance records for this occurrence
    const attendanceRecords = await Attendance.find({
      sessionOccurrenceId: occurrence._id,
    }).lean()

    // Build attendance list
    const attendanceMap = new Map(
      attendanceRecords.map((a: any) => [a.studentId.toString(), a])
    )

    const students = studentSessions
      .filter(ss => ss.studentId)
      .map((ss: any) => {
        const attendance = attendanceMap.get(ss.studentId._id.toString())
        return {
          _id: ss.studentId._id,
          fullName: ss.studentId.fullName,
          parentName: ss.studentId.parentName,
          status: attendance?.status || ATTENDANCE_STATUS.ABSENT,
          checkInTime: attendance?.checkInTime,
          notes: attendance?.notes,
          attendanceId: attendance?._id,
        }
      })

    return NextResponse.json({
      session: sessionTemplate,
      occurrence,
      students,
      stats: {
        total: students.length,
        present: students.filter(s => s.status === ATTENDANCE_STATUS.PRESENT).length,
        late: students.filter(s => s.status === ATTENDANCE_STATUS.LATE).length,
        absent: students.filter(s => s.status === ATTENDANCE_STATUS.ABSENT).length,
        justified: students.filter(s => s.status === ATTENDANCE_STATUS.JUSTIFIED_ABSENCE).length,
      }
    })
  } catch (error) {
    console.error("Error fetching attendance:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء جلب البيانات" },
      { status: 500 }
    )
  }
}

// PATCH /api/sessions/[id]/attendance - Update student attendance
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json(
        { message: "غير مصرح لك بالوصول" },
        { status: 403 }
      )
    }

    // Only staff (admin or teacher) may modify attendance
    if (session.user.role !== ROLES.ADMIN && session.user.role !== ROLES.TEACHER) {
      return NextResponse.json(
        { message: "غير مصرح لك بالوصول" },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { studentId, occurrenceId, status, notes } = body

    // Validate
    const validationResult = updateAttendanceSchema.safeParse({ status, notes })
    if (!validationResult.success) {
      return NextResponse.json(
        { message: validationResult.error.issues[0].message },
        { status: 400 }
      )
    }

    await dbConnect()

    // Teachers may only modify attendance for their own sessions
    if (session.user.role === ROLES.TEACHER) {
      const template = await SessionTemplate.findById(id).select("teacherId").lean()
      if (!template) {
        return NextResponse.json(
          { message: "الحصة غير موجودة" },
          { status: 404 }
        )
      }
      if (template.teacherId.toString() !== session.user.id) {
        return NextResponse.json(
          { message: "غير مصرح لك بتعديل حضور هذه الحصة" },
          { status: 403 }
        )
      }
    }

    // Find or create attendance record
    let attendance = await Attendance.findOne({
      studentId,
      sessionOccurrenceId: occurrenceId,
    })

    if (attendance) {
      // Update existing
      attendance.status = status
      attendance.notes = notes
      attendance.lastModifiedByUserId = new mongoose.Types.ObjectId(session.user.id)
      attendance.lastModifiedAt = new Date()
      await attendance.save()
    } else {
      // Create new
      attendance = await Attendance.create({
        studentId,
        sessionOccurrenceId: occurrenceId,
        status,
        notes,
        createdBy: session.user.role === "ADMIN" ? ATTENDANCE_CREATOR.ADMIN : ATTENDANCE_CREATOR.TEACHER,
        checkInTime: status === ATTENDANCE_STATUS.PRESENT || status === ATTENDANCE_STATUS.LATE 
          ? new Date() 
          : undefined,
      })
    }

    return NextResponse.json(attendance)
  } catch (error) {
    console.error("Error updating attendance:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء تحديث الحضور" },
      { status: 500 }
    )
  }
}

