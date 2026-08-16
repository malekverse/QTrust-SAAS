import { NextRequest, NextResponse } from "next/server"
import mongoose from "mongoose"
import dbConnect from "@/lib/db"
import SessionTemplate from "@/models/SessionTemplate"
import SessionOccurrence from "@/models/SessionOccurrence"
import StudentSession from "@/models/StudentSession"
import Room from "@/models/Room"
import User from "@/models/User"
import { logActivity } from "@/models/ActivityLog"
import { auth } from "@/lib/auth"
import { createSessionTemplateSchema } from "@/lib/validations"
import { ROLES, SESSION_STATUS, DEFAULT_QR_SETTINGS } from "@/lib/constants"
import { getActiveSubstituteTemplateIds } from "@/lib/substitutes"

void SessionTemplate
void SessionOccurrence
void StudentSession
void Room
void User

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

function hasTimeOverlap(
  start1: string, end1: string, start2: string, end2: string
): boolean {
  const s1 = timeToMinutes(start1), e1 = timeToMinutes(end1)
  const s2 = timeToMinutes(start2), e2 = timeToMinutes(end2)
  return (s1 < e2 && e1 > s2)
}

interface OccurrenceTemplate {
  _id: mongoose.Types.ObjectId
  tenantId: mongoose.Types.ObjectId
  teacherId: mongoose.Types.ObjectId
  dayOfWeek: number
  effectiveFromDate: string | Date
  startTime: string
  endTime: string
  qrOpenOffsetBeforeMin?: number
  qrCloseOffsetAfterMin?: number
}

// Helper function to generate session occurrences for a template
async function generateOccurrencesForTemplate(
  template: OccurrenceTemplate,
  weeksAhead: number = 4
) {
  const created: string[] = []
  const now = new Date()
  
  // Use local date for day calculation
  const todayYear = now.getFullYear()
  const todayMonth = now.getMonth()
  const todayDay = now.getDate()

  // Calculate dates for the next N weeks that match the dayOfWeek
  const dates: { utcDate: Date; localDate: Date }[] = []
  
  // Start from today
  const currentDate = new Date(todayYear, todayMonth, todayDay)
  
  // Find the first occurrence (could be today or in the future)
  for (let i = 0; i < weeksAhead * 7; i++) {
    if (currentDate.getDay() === template.dayOfWeek) {
      // Check if this date is within the effective period
      const effectiveFrom = new Date(template.effectiveFromDate)
      // Compare dates only (ignore time)
      const effectiveFromDate = new Date(effectiveFrom.getFullYear(), effectiveFrom.getMonth(), effectiveFrom.getDate())
      
      if (currentDate >= effectiveFromDate) {
        // Create UTC date for storage
        const utcDate = new Date(Date.UTC(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate(),
          0, 0, 0, 0
        ))
        // Keep local date for session times
        const localDate = new Date(currentDate)
        dates.push({ utcDate, localDate })
      }
    }
    currentDate.setDate(currentDate.getDate() + 1)
  }

  // Create occurrences for each date
  for (const { utcDate, localDate } of dates) {
    // Check if occurrence already exists
    const exists = await SessionOccurrence.findOne({
      tenantId: template.tenantId,
      sessionTemplateId: template._id,
      date: utcDate,
    })

    if (!exists) {
      const [startHour, startMin] = template.startTime.split(":").map(Number)
      const [endHour, endMin] = template.endTime.split(":").map(Number)

      // Use local time for session start/end
      const startDateTime = new Date(localDate)
      startDateTime.setHours(startHour, startMin, 0, 0)

      const endDateTime = new Date(localDate)
      endDateTime.setHours(endHour, endMin, 0, 0)

      const qrOpenOffset = template.qrOpenOffsetBeforeMin ?? DEFAULT_QR_SETTINGS.openOffsetBeforeMin
      const qrCloseOffset = template.qrCloseOffsetAfterMin ?? DEFAULT_QR_SETTINGS.closeOffsetAfterMin

      const qrOpenDateTime = new Date(startDateTime.getTime() - qrOpenOffset * 60 * 1000)
      const qrCloseDateTime = new Date(endDateTime.getTime() + qrCloseOffset * 60 * 1000)

      await SessionOccurrence.create({
        tenantId: template.tenantId,
        sessionTemplateId: template._id,
        teacherId: template.teacherId,
        date: utcDate,
        startDateTime,
        endDateTime,
        qrOpenDateTime,
        qrCloseDateTime,
        status: SESSION_STATUS.SCHEDULED,
      })

      created.push(utcDate.toISOString().split('T')[0])
    }
  }

  return created
}

// GET /api/sessions - List all session templates
export async function GET() {
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

    await dbConnect()

    let query: Record<string, unknown> = { tenantId }
    let substituteIds: string[] = []

    // Teachers see their own sessions plus any they're actively substituting for.
    if (session.user.role === ROLES.TEACHER) {
      substituteIds = await getActiveSubstituteTemplateIds(tenantId, session.user.id)
      query = substituteIds.length
        ? { tenantId, $or: [{ teacherId: session.user.id }, { _id: { $in: substituteIds } }] }
        : { tenantId, teacherId: session.user.id }
    }

    const sessions = await SessionTemplate.find(query)
      .populate("teacherId", "fullName")
      .populate("roomId", "name capacity")
      .sort({ dayOfWeek: 1, startTime: 1 })
      .lean()

    const substituteSet = new Set(substituteIds)

    // Add student count for each session
    const sessionsWithCount = await Promise.all(
      sessions.map(async (s) => {
        const studentCount = await StudentSession.countDocuments({
          tenantId,
          sessionTemplateId: s._id,
          isActive: true,
        })
        // Flag sessions the caller only sees because they're substituting.
        const isSubstitute =
          session.user.role === ROLES.TEACHER &&
          substituteSet.has(String(s._id)) &&
          String((s.teacherId as { _id?: unknown })?._id ?? s.teacherId) !== session.user.id
        return { ...s, studentCount, isSubstitute }
      })
    )

    return NextResponse.json(sessionsWithCount)
  } catch (error) {
    console.error("Error fetching sessions:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء جلب البيانات" },
      { status: 500 }
    )
  }
}

// POST /api/sessions - Create a new session template
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session || session.user.role !== ROLES.ADMIN) {
      return NextResponse.json(
        { message: "غير مصرح لك بالوصول" },
        { status: 403 }
      )
    }

    const tenantId = session.user.tenantId
    if (!tenantId) {
      return NextResponse.json({ message: "لا يوجد سياق مؤسسة" }, { status: 403 })
    }

    const body = await request.json()

    // Validate input
    const validationResult = createSessionTemplateSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { message: validationResult.error.issues[0].message },
        { status: 400 }
      )
    }

    await dbConnect()

    const data = validationResult.data

    // Check room time conflicts if roomId is provided
    if (data.roomId) {
      const conflicting = await SessionTemplate.find({
        tenantId,
        roomId: data.roomId,
        dayOfWeek: data.dayOfWeek,
        isActive: true,
      }).lean()

      for (const existing of conflicting) {
        if (hasTimeOverlap(data.startTime, data.endTime, existing.startTime, existing.endTime)) {
          return NextResponse.json(
            {
              message: `تعارض في القاعة: الحصة "${existing.name}" تستخدم نفس القاعة في نفس الوقت`,
              conflict: { sessionName: existing.name, startTime: existing.startTime, endTime: existing.endTime },
            },
            { status: 409 }
          )
        }
      }
    }

    // Create session template
    const sessionTemplate = await SessionTemplate.create({
      ...data,
      tenantId,
      isActive: true,
    })

    // Auto-generate session occurrences for the next 4 weeks
    let occurrencesCreated: string[] = []
    try {
      occurrencesCreated = await generateOccurrencesForTemplate(sessionTemplate, 4)
      console.log(`[Session] Created ${occurrencesCreated.length} occurrences for session "${sessionTemplate.name}"`)
    } catch (occError) {
      console.error("[Session] Error generating occurrences (non-fatal):", occError)
    }

    // Log activity
    await logActivity(
      'SESSION_CREATED',
      sessionTemplate.name,
      {
        tenantId,
        sessionId: sessionTemplate._id,
        userId: session.user.id,
        metadata: { occurrencesCreated: occurrencesCreated.length }
      }
    )

    return NextResponse.json({
      ...sessionTemplate.toObject(),
      occurrencesCreated: occurrencesCreated.length
    }, { status: 201 })
  } catch (error) {
    console.error("Error creating session:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء إنشاء الحصة" },
      { status: 500 }
    )
  }
}

