import { NextRequest, NextResponse } from "next/server"
import mongoose from "mongoose"
import dbConnect from "@/lib/db"
import Attendance from "@/models/Attendance"
import SessionOccurrence from "@/models/SessionOccurrence"
import SessionTemplate from "@/models/SessionTemplate"
import Student from "@/models/Student"
import StudentSession from "@/models/StudentSession"
import { auth } from "@/lib/auth"
import { ROLES, ATTENDANCE_STATUS, ATTENDANCE_CREATOR, SESSION_STATUS, DEFAULT_QR_SETTINGS } from "@/lib/constants"

// Force model registration (needed for populate in serverless)
void Attendance
void SessionOccurrence
void SessionTemplate
void Student
void StudentSession

/**
 * Calendar day for SessionOccurrence.date — must match GET /api/attendance/by-date
 * (UTC midnight for the YYYY-MM-DD key, not local midnight).
 */
function occurrenceCalendarDateFromKey(dateKey: string): Date {
  const raw = dateKey.includes("T") ? dateKey.split("T")[0] : dateKey.slice(0, 10)
  const [year, month, day] = raw.split("-").map(Number)
  if (!year || !month || !day) {
    throw new Error("Invalid date")
  }
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
}

// Helper to create session occurrence if needed
async function getOrCreateSessionOccurrence(
  sessionTemplateId: string,
  dateKey: string,
  tenantId: string
) {
  const sessionTemplate = await SessionTemplate.findOne({ _id: sessionTemplateId, tenantId })
  if (!sessionTemplate) {
    throw new Error("Session template not found")
  }

  const occurrenceDate = occurrenceCalendarDateFromKey(dateKey)
  const ymd = dateKey.includes("T") ? dateKey.split("T")[0] : dateKey.slice(0, 10)
  const [year, month, day] = ymd.split("-").map(Number)

  // Check if occurrence already exists
  let occurrence = await SessionOccurrence.findOne({
    tenantId,
    sessionTemplateId: sessionTemplate._id,
    date: occurrenceDate,
  })

  if (!occurrence) {
    // Local wall-clock session times (same as by-date auto-create)
    const [startHour, startMin] = sessionTemplate.startTime.split(":").map(Number)
    const [endHour, endMin] = sessionTemplate.endTime.split(":").map(Number)

    const startDateTime = new Date(year, month - 1, day, startHour, startMin, 0, 0)
    const endDateTime = new Date(year, month - 1, day, endHour, endMin, 0, 0)

    const qrOpenOffset = sessionTemplate.qrOpenOffsetBeforeMin ?? DEFAULT_QR_SETTINGS.openOffsetBeforeMin
    const qrCloseOffset = sessionTemplate.qrCloseOffsetAfterMin ?? DEFAULT_QR_SETTINGS.closeOffsetAfterMin

    const qrOpenDateTime = new Date(startDateTime.getTime() - qrOpenOffset * 60 * 1000)
    const qrCloseDateTime = new Date(endDateTime.getTime() + qrCloseOffset * 60 * 1000)

    occurrence = await SessionOccurrence.create({
      tenantId,
      sessionTemplateId: sessionTemplate._id,
      teacherId: sessionTemplate.teacherId,
      date: occurrenceDate,
      startDateTime,
      endDateTime,
      qrOpenDateTime,
      qrCloseDateTime,
      status: SESSION_STATUS.SCHEDULED,
    })
  }

  return occurrence
}

// PATCH /api/attendance/[id] - Update attendance record
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    
    if (!session || (session.user.role !== ROLES.ADMIN && session.user.role !== ROLES.TEACHER)) {
      return NextResponse.json(
        { message: "غير مصرح لك بالوصول" },
        { status: 403 }
      )
    }

    const tenantId = session.user.tenantId
    if (!tenantId) {
      return NextResponse.json({ message: "لا يوجد سياق مؤسسة" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { status, notes } = body

    if (!status || !Object.values(ATTENDANCE_STATUS).includes(status)) {
      return NextResponse.json(
        { message: "حالة الحضور غير صالحة" },
        { status: 400 }
      )
    }

    await dbConnect()

    const attendance = await Attendance.findOneAndUpdate(
      { _id: id, tenantId },
      {
        status,
        notes,
        lastModifiedByUserId: new mongoose.Types.ObjectId(session.user.id),
        lastModifiedAt: new Date()
      },
      { new: true, runValidators: true }
    )

    if (!attendance) {
      return NextResponse.json(
        { message: "سجل الحضور غير موجود" },
        { status: 404 }
      )
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

// POST /api/attendance/[id] - Create or update attendance for a student
// id here is the sessionTemplateId
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    
    if (!session || (session.user.role !== ROLES.ADMIN && session.user.role !== ROLES.TEACHER)) {
      return NextResponse.json(
        { message: "غير مصرح لك بالوصول" },
        { status: 403 }
      )
    }

    const tenantId = session.user.tenantId
    if (!tenantId) {
      return NextResponse.json({ message: "لا يوجد سياق مؤسسة" }, { status: 403 })
    }

    const { id: sessionTemplateId } = await params
    const body = await request.json()
    const { studentId, date, status, notes } = body

    if (!studentId || !date || !status) {
      return NextResponse.json(
        { message: "بيانات ناقصة" },
        { status: 400 }
      )
    }

    if (!Object.values(ATTENDANCE_STATUS).includes(status)) {
      return NextResponse.json(
        { message: "حالة الحضور غير صالحة" },
        { status: 400 }
      )
    }

    await dbConnect()

    // Get or create the session occurrence (date string must match by-date UTC key)
    const occurrence = await getOrCreateSessionOccurrence(sessionTemplateId, date, tenantId)

    // Check if attendance record exists
    let attendance = await Attendance.findOne({
      tenantId,
      studentId,
      sessionOccurrenceId: occurrence._id
    })

    if (attendance) {
      // Update existing
      attendance = await Attendance.findOneAndUpdate(
        { _id: attendance._id, tenantId },
        {
          status,
          notes,
          lastModifiedByUserId: new mongoose.Types.ObjectId(session.user.id),
          lastModifiedAt: new Date()
        },
        { new: true, runValidators: true }
      )
    } else {
      // Create new
      attendance = await Attendance.create({
        tenantId,
        studentId,
        sessionOccurrenceId: occurrence._id,
        status,
        notes,
        createdBy: session.user.role === ROLES.ADMIN ? ATTENDANCE_CREATOR.ADMIN : ATTENDANCE_CREATOR.TEACHER,
        checkInTime: status === ATTENDANCE_STATUS.PRESENT || status === ATTENDANCE_STATUS.LATE 
          ? new Date() 
          : undefined
      })
    }

    return NextResponse.json(attendance)
  } catch (error) {
    console.error("Error creating/updating attendance:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء تحديث الحضور" },
      { status: 500 }
    )
  }
}
