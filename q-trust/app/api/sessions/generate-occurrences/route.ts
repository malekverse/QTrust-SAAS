import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import SessionTemplate from "@/models/SessionTemplate"
import SessionOccurrence from "@/models/SessionOccurrence"
import { auth } from "@/lib/auth"
import { ROLES, SESSION_STATUS, DEFAULT_QR_SETTINGS } from "@/lib/constants"

// POST /api/sessions/generate-occurrences - Generate session occurrences
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session || session.user.role !== ROLES.ADMIN) {
      return NextResponse.json(
        { message: "غير مصرح لك بالوصول" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { startDate, endDate, sessionTemplateId } = body

    if (!startDate || !endDate) {
      return NextResponse.json(
        { message: "تاريخ البداية والنهاية مطلوبان" },
        { status: 400 }
      )
    }

    await dbConnect()

    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)

    // Get session templates
    const query: Record<string, unknown> = { isActive: true }
    if (sessionTemplateId) {
      query._id = sessionTemplateId
    }

    const templates = await SessionTemplate.find(query).lean()

    let created = 0
    let skipped = 0

    for (const template of templates) {
      const current = new Date(start)
      
      while (current <= end) {
        if (current.getDay() === template.dayOfWeek) {
          const dayStart = new Date(current)
          dayStart.setHours(0, 0, 0, 0)
          const dayEnd = new Date(current)
          dayEnd.setHours(23, 59, 59, 999)

          const exists = await SessionOccurrence.findOne({
            sessionTemplateId: template._id,
            date: { $gte: dayStart, $lt: dayEnd }
          })

          if (!exists) {
            const [startHour, startMin] = template.startTime.split(":").map(Number)
            const [endHour, endMin] = template.endTime.split(":").map(Number)

            const occDate = new Date(current)
            occDate.setHours(0, 0, 0, 0)

            const startDT = new Date(current)
            startDT.setHours(startHour, startMin, 0, 0)

            const endDT = new Date(current)
            endDT.setHours(endHour, endMin, 0, 0)

            const qrOpen = template.qrOpenOffsetBeforeMin ?? DEFAULT_QR_SETTINGS.openOffsetBeforeMin
            const qrClose = template.qrCloseOffsetAfterMin ?? DEFAULT_QR_SETTINGS.closeOffsetAfterMin

            await SessionOccurrence.create({
              sessionTemplateId: template._id,
              teacherId: template.teacherId,
              date: occDate,
              startDateTime: startDT,
              endDateTime: endDT,
              qrOpenDateTime: new Date(startDT.getTime() - qrOpen * 60 * 1000),
              qrCloseDateTime: new Date(endDT.getTime() + qrClose * 60 * 1000),
              status: SESSION_STATUS.SCHEDULED,
            })
            created++
          } else {
            skipped++
          }
        }
        current.setDate(current.getDate() + 1)
      }
    }

    return NextResponse.json({
      message: `تم إنشاء ${created} حصة، تخطي ${skipped}`,
      created,
      skipped,
    })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ message: "خطأ" }, { status: 500 })
  }
}

