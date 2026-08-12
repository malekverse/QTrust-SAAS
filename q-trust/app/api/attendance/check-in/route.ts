import { ATTENDANCE_CREATOR, ATTENDANCE_STATUS, DEFAULT_QR_SETTINGS, SESSION_STATUS } from "@/lib/constants"
import dbConnect from "@/lib/db"
import { checkInSchema } from "@/lib/validations"
import { logActivity } from "@/models/ActivityLog"
import Attendance from "@/models/Attendance"
import SessionOccurrence from "@/models/SessionOccurrence"
import SessionTemplate from "@/models/SessionTemplate"
import Student from "@/models/Student"
import StudentSession from "@/models/StudentSession"
import { NextRequest, NextResponse } from "next/server"
import { checkInLimiter, enforceRateLimit, getClientIp } from "@/lib/rate-limit"

// Force model registration (needed for populate in serverless)
void Attendance
void SessionOccurrence
void SessionTemplate
void Student
void StudentSession

// Tunisia timezone offset (UTC+1, Tunisia doesn't use DST anymore)
const TUNISIA_TIMEZONE_OFFSET_HOURS = 1

// Get current time in Tunisia timezone
function getTunisiaTime(date?: Date): Date {
  const d = date ? new Date(date) : new Date()
  // Add Tunisia's UTC offset
  return new Date(d.getTime() + TUNISIA_TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000)
}

// Get day of week in Tunisia timezone
function getTunisiaDayOfWeek(date: Date): number {
  const tunisiaTime = getTunisiaTime(date)
  return tunisiaTime.getUTCDay()
}

// Verify scanner token. Fails closed in production if no token is configured,
// rather than silently accepting the well-known development default.
function verifyScannerToken(request: NextRequest): boolean {
  const token = request.headers.get("x-scanner-token")
  const validToken = process.env.SCANNER_DEVICE_TOKEN
  if (!validToken) {
    if (process.env.NODE_ENV === "production") return false
    return token === "dev-scanner-token"
  }
  return token === validToken
}

// Helper to create session occurrence if it doesn't exist
async function getOrCreateSessionOccurrence(
  sessionTemplate: any,
  date: Date
) {
  // Normalize date to start of day in Tunisia timezone
  const tunisiaTime = getTunisiaTime(date)
  const occurrenceDate = new Date(Date.UTC(
    tunisiaTime.getUTCFullYear(),
    tunisiaTime.getUTCMonth(),
    tunisiaTime.getUTCDate(),
    0, 0, 0, 0
  ))

  console.log(`[Occurrence] Looking for occurrence on ${occurrenceDate.toISOString()} for session ${sessionTemplate._id}`)

  // Check if occurrence already exists
  let occurrence = await SessionOccurrence.findOne({
    sessionTemplateId: sessionTemplate._id,
    date: occurrenceDate,
  })

  if (!occurrence) {
    console.log(`[Occurrence] No existing occurrence, creating new one...`)
    
    // Parse start and end times
    const [startHour, startMin] = sessionTemplate.startTime.split(":").map(Number)
    const [endHour, endMin] = sessionTemplate.endTime.split(":").map(Number)
    
    console.log(`[Occurrence] Session times: ${startHour}:${startMin} - ${endHour}:${endMin} (Tunisia time)`)

    // Create start time in Tunisia timezone, then convert to UTC
    // Start with the occurrence date at midnight UTC
    const startDateTime = new Date(occurrenceDate.getTime())
    // Add hours and minutes for Tunisia time, then subtract timezone offset to get UTC
    startDateTime.setUTCHours(startHour - TUNISIA_TIMEZONE_OFFSET_HOURS, startMin, 0, 0)

    const endDateTime = new Date(occurrenceDate.getTime())
    endDateTime.setUTCHours(endHour - TUNISIA_TIMEZONE_OFFSET_HOURS, endMin, 0, 0)

    // Calculate QR window times
    const qrOpenOffset = sessionTemplate.qrOpenOffsetBeforeMin ?? DEFAULT_QR_SETTINGS.openOffsetBeforeMin
    const qrCloseOffset = sessionTemplate.qrCloseOffsetAfterMin ?? DEFAULT_QR_SETTINGS.closeOffsetAfterMin

    const qrOpenDateTime = new Date(startDateTime.getTime() - qrOpenOffset * 60 * 1000)
    const qrCloseDateTime = new Date(endDateTime.getTime() + qrCloseOffset * 60 * 1000)

    console.log(`[Occurrence] Creating with times:`, {
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString(),
      qrOpen: qrOpenDateTime.toISOString(),
      qrClose: qrCloseDateTime.toISOString(),
    })

    occurrence = await SessionOccurrence.create({
      sessionTemplateId: sessionTemplate._id,
      teacherId: sessionTemplate.teacherId,
      date: occurrenceDate,
      startDateTime,
      endDateTime,
      qrOpenDateTime,
      qrCloseDateTime,
      status: SESSION_STATUS.SCHEDULED,
    })
    
    console.log(`[Check-in] Created new occurrence for ${sessionTemplate.name}:`, {
      id: occurrence._id,
      date: occurrenceDate.toISOString(),
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString(),
      qrOpen: qrOpenDateTime.toISOString(),
      qrClose: qrCloseDateTime.toISOString(),
    })
  } else {
    console.log(`[Occurrence] Found existing occurrence: ${occurrence._id}`)
  }

  return occurrence
}

export async function POST(request: NextRequest) {
  try {
    console.log("[Check-in] Starting check-in process...")

    const limited = await enforceRateLimit(checkInLimiter, `checkin:${getClientIp(request)}`)
    if (limited) return limited

    // Verify scanner token
    if (!verifyScannerToken(request)) {
      console.log("[Check-in] Token verification failed")
      return NextResponse.json(
        { message: "غير مصرح بالوصول" },
        { status: 401 }
      )
    }
    console.log("[Check-in] Token verified")

    let body
    try {
      body = await request.json()
      console.log("[Check-in] Request body:", JSON.stringify(body))
    } catch (parseError) {
      console.error("[Check-in] Failed to parse request body:", parseError)
      return NextResponse.json(
        { message: "بيانات الطلب غير صالحة" },
        { status: 400 }
      )
    }
    
    // Validate input
    const validationResult = checkInSchema.safeParse(body)
    if (!validationResult.success) {
      console.log("[Check-in] Validation failed:", validationResult.error.issues)
      return NextResponse.json(
        { message: validationResult.error.issues[0].message },
        { status: 400 }
      )
    }

    const { qrUuid, scannedAt } = validationResult.data
    const scanTime = scannedAt ? new Date(scannedAt) : new Date()
    console.log("[Check-in] QR UUID:", qrUuid, "Scan time:", scanTime.toISOString())

    try {
      await dbConnect()
      console.log("[Check-in] Database connected")
    } catch (dbError) {
      console.error("[Check-in] Database connection failed:", dbError)
      return NextResponse.json(
        { message: "خطأ في الاتصال بقاعدة البيانات" },
        { status: 500 }
      )
    }

    // Find student by QR UUID
    let student
    try {
      student = await Student.findOne({ qrUuid, isActive: true })
      console.log("[Check-in] Student found:", student ? student._id : "NOT FOUND")
    } catch (studentError) {
      console.error("[Check-in] Error finding student:", studentError)
      return NextResponse.json(
        { message: "خطأ في البحث عن الطالب" },
        { status: 500 }
      )
    }
    
    if (!student) {
      return NextResponse.json(
        { message: "رمز QR غير صالح أو الطالب غير مسجل" },
        { status: 404 }
      )
    }

    // Get student's session assignments
    let studentSessions
    try {
      studentSessions = await StudentSession.find({
        studentId: student._id,
        isActive: true,
      }).populate("sessionTemplateId")
      console.log("[Check-in] Sessions found:", studentSessions.length)
    } catch (sessionError) {
      console.error("[Check-in] Error finding sessions:", sessionError)
      return NextResponse.json(
        { message: "خطأ في البحث عن الحصص" },
        { status: 500 }
      )
    }

    if (studentSessions.length === 0) {
      return NextResponse.json(
        { message: "لم يتم تسجيلك في أي حصة. يرجى مراجعة الإدارة" },
        { status: 400 }
      )
    }

    // Get current day of week in Tunisia timezone
    const currentDay = getTunisiaDayOfWeek(scanTime)
    const tunisiaTimeNow = getTunisiaTime(scanTime)

    // Find active session for this student at this time
    let activeSession: any = null
    let sessionTemplate: any = null
    let debugInfo: string[] = []

    console.log(`[Check-in Debug] Student: ${student.fullName || student.firstName}, Sessions assigned: ${studentSessions.length}`)
    console.log(`[Check-in Debug] Scan time (UTC): ${scanTime.toISOString()}`)
    console.log(`[Check-in Debug] Tunisia time: ${tunisiaTimeNow.toISOString()}, Day of week: ${currentDay}`)

    for (const ss of studentSessions) {
      const template = ss.sessionTemplateId as any
      
      if (!template) {
        debugInfo.push(`Session template not found (may have been deleted)`)
        continue
      }
      
      if (!template.isActive) {
        debugInfo.push(`Session "${template.name}" is inactive`)
        continue
      }

      console.log(`[Check-in Debug] Checking session: ${template.name}, Day: ${template.dayOfWeek}, Current day: ${currentDay}`)

      // Check if it's the right day
      if (template.dayOfWeek !== currentDay) {
        const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
        debugInfo.push(`الحصة "${template.name}" في يوم ${dayNames[template.dayOfWeek]} وليس اليوم`)
        continue
      }

      // Check if within effective dates
      const effectiveFrom = new Date(template.effectiveFromDate)
      if (scanTime < effectiveFrom) {
        debugInfo.push(`الحصة "${template.name}" تبدأ في ${effectiveFrom.toLocaleDateString('ar-SA')}`)
        continue
      }
      if (template.effectiveToDate && scanTime > new Date(template.effectiveToDate)) {
        debugInfo.push(`الحصة "${template.name}" انتهت`)
        continue
      }

      // Get or create session occurrence for today
      let occurrence
      try {
        occurrence = await getOrCreateSessionOccurrence(template, scanTime)
        console.log(`[Check-in Debug] QR Window: ${occurrence.qrOpenDateTime.toISOString()} - ${occurrence.qrCloseDateTime.toISOString()}`)
        console.log(`[Check-in Debug] Scan time: ${scanTime.toISOString()}`)
      } catch (occurrenceError) {
        console.error(`[Check-in] Error creating occurrence for ${template.name}:`, occurrenceError)
        debugInfo.push(`خطأ في إنشاء الحصة "${template.name}"`)
        continue
      }

      // Check if within QR window
      if (scanTime >= occurrence.qrOpenDateTime && scanTime <= occurrence.qrCloseDateTime) {
        activeSession = occurrence
        sessionTemplate = template
        console.log(`[Check-in Debug] Found active session: ${template.name}`)
        break
      } else {
        // Provide specific timing information in Tunisia timezone
        const qrOpenTunisia = getTunisiaTime(occurrence.qrOpenDateTime)
        const qrCloseTunisia = getTunisiaTime(occurrence.qrCloseDateTime)
        const currentTunisia = getTunisiaTime(scanTime)
        
        const formatTime = (d: Date) => {
          const hours = d.getUTCHours().toString().padStart(2, '0')
          const minutes = d.getUTCMinutes().toString().padStart(2, '0')
          return `${hours}:${minutes}`
        }
        
        const qrOpenTime = formatTime(qrOpenTunisia)
        const qrCloseTime = formatTime(qrCloseTunisia)
        const currentTime = formatTime(currentTunisia)
        
        if (scanTime < occurrence.qrOpenDateTime) {
          debugInfo.push(`الحصة "${template.name}" تفتح في ${qrOpenTime} (الوقت الحالي: ${currentTime})`)
        } else {
          debugInfo.push(`الحصة "${template.name}" أُغلقت في ${qrCloseTime} (الوقت الحالي: ${currentTime})`)
        }
      }
    }

    if (!activeSession) {
      console.log(`[Check-in Debug] No active session found. Debug info:`, debugInfo)
      
      // Return a more helpful error message
      let errorMessage = "لا توجد حصة نشطة لك في هذا الوقت"
      if (debugInfo.length > 0) {
        errorMessage = debugInfo[0] // Show the most relevant reason
      }
      errorMessage += ". يرجى مراجعة الإدارة"
      
      return NextResponse.json(
        { message: errorMessage },
        { status: 400 }
      )
    }

    // Get student display name (handle both old and new schema)
    const studentDisplayName = student.fullName || 
      (student.firstName && student.lastName 
        ? `${student.firstName} ${student.lastName}` 
        : student.firstName || 'طالب')

    // Check if already checked in
    let existingAttendance
    try {
      existingAttendance = await Attendance.findOne({
        studentId: student._id,
        sessionOccurrenceId: activeSession._id,
      })
      console.log("[Check-in] Existing attendance check:", existingAttendance ? "FOUND" : "NOT FOUND")
    } catch (attendanceError) {
      console.error("[Check-in] Error checking existing attendance:", attendanceError)
      return NextResponse.json(
        { message: "خطأ في التحقق من الحضور السابق" },
        { status: 500 }
      )
    }

    if (existingAttendance) {
      return NextResponse.json({
        success: true,
        studentName: studentDisplayName,
        sessionName: sessionTemplate.name,
        message: "تم تسجيل حضورك مسبقاً",
        alreadyCheckedIn: true,
      })
    }

    // Determine attendance status (PRESENT or LATE)
    const lateThreshold = DEFAULT_QR_SETTINGS.lateThresholdMin * 60 * 1000
    const isLate = scanTime.getTime() > activeSession.startDateTime.getTime() + lateThreshold
    const status = isLate ? ATTENDANCE_STATUS.LATE : ATTENDANCE_STATUS.PRESENT
    console.log("[Check-in] Attendance status:", status, "isLate:", isLate)

    // Create attendance record
    try {
      await Attendance.create({
        studentId: student._id,
        sessionOccurrenceId: activeSession._id,
        status,
        checkInTime: scanTime,
        createdBy: ATTENDANCE_CREATOR.SYSTEM,
      })
      console.log("[Check-in] Attendance record created successfully")
    } catch (createError: any) {
      console.error("[Check-in] Error creating attendance:", createError)
      // Check for duplicate key error (already checked in)
      if (createError.code === 11000) {
        return NextResponse.json({
          success: true,
          studentName: studentDisplayName,
          sessionName: sessionTemplate.name,
          message: "تم تسجيل حضورك مسبقاً",
          alreadyCheckedIn: true,
        })
      }
      return NextResponse.json(
        { message: "خطأ في إنشاء سجل الحضور" },
        { status: 500 }
      )
    }

    // Log activity (non-blocking, don't fail if this errors)
    try {
      await logActivity(
        'ATTENDANCE_CHECK_IN',
        studentDisplayName,
        {
          details: sessionTemplate.name,
          studentId: student._id,
          sessionId: sessionTemplate._id,
          metadata: { status, isLate }
        }
      )
    } catch (logError) {
      console.error("[Check-in] Error logging activity (non-fatal):", logError)
    }

    // Update session status if needed (non-blocking)
    try {
      if (activeSession.status === SESSION_STATUS.SCHEDULED) {
        await SessionOccurrence.findByIdAndUpdate(activeSession._id, {
          status: SESSION_STATUS.IN_PROGRESS,
        })
      }
    } catch (updateError) {
      console.error("[Check-in] Error updating session status (non-fatal):", updateError)
    }

    console.log("[Check-in] SUCCESS - Student:", studentDisplayName, "Session:", sessionTemplate.name)
    
    return NextResponse.json({
      success: true,
      studentName: studentDisplayName,
      sessionName: sessionTemplate.name,
      status,
      message: `تم تسجيل حضورك بنجاح${isLate ? " (متأخر)" : ""}`,
    })
  } catch (error: any) {
    console.error("[Check-in] Unhandled error:", error)
    console.error("[Check-in] Error stack:", error?.stack)
    console.error("[Check-in] Error name:", error?.name)
    console.error("[Check-in] Error message:", error?.message)
    
    return NextResponse.json(
      { message: `حدث خطأ أثناء تسجيل الحضور: ${error?.message || 'خطأ غير معروف'}` },
      { status: 500 }
    )
  }
}

