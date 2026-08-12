import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import SessionTemplate from "@/models/SessionTemplate"
import StudentSession from "@/models/StudentSession"
import Room from "@/models/Room"
import { auth } from "@/lib/auth"
import { ROLES } from "@/lib/constants"

void SessionTemplate
void StudentSession
void Room

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

function hasTimeOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  return timeToMinutes(s1) < timeToMinutes(e2) && timeToMinutes(e1) > timeToMinutes(s2)
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || session.user.role !== ROLES.ADMIN) {
      return NextResponse.json({ message: "غير مصرح لك بالوصول" }, { status: 403 })
    }

    const body = await request.json()
    const confirm = body.confirm === true

    await dbConnect()

    // Find sessions without rooms
    const unassigned = await SessionTemplate.find({ isActive: true, $or: [{ roomId: null }, { roomId: { $exists: false } }] })
      .populate("teacherId", "fullName")
      .lean()

    if (unassigned.length === 0) {
      return NextResponse.json({
        message: "جميع الحصص مرتبطة بقاعات",
        assignments: [],
      })
    }

    const rooms = await Room.find({ isActive: true }).sort({ capacity: 1 }).lean()
    if (rooms.length === 0) {
      return NextResponse.json({ message: "لا توجد قاعات متاحة" }, { status: 400 })
    }

    // Get all sessions with rooms for conflict checking
    const assignedSessions = await SessionTemplate.find({ isActive: true, roomId: { $ne: null } }).lean()

    // Build occupation map: roomId-day -> [{startTime, endTime}]
    const occupation: Record<string, Array<{ startTime: string; endTime: string }>> = {}
    for (const s of assignedSessions) {
      const key = `${s.roomId}-${s.dayOfWeek}`
      if (!occupation[key]) occupation[key] = []
      occupation[key].push({ startTime: s.startTime, endTime: s.endTime })
    }

    // Track new assignments during planning
    const newOccupation: Record<string, Array<{ startTime: string; endTime: string }>> = {}

    const assignments: Array<{
      sessionId: string
      sessionName: string
      roomId: string
      roomName: string
      reason: string
    }> = []

    const unassignable: Array<{ sessionId: string; sessionName: string; reason: string }> = []

    for (const s of unassigned) {
      const studentCount = await StudentSession.countDocuments({
        sessionTemplateId: s._id,
        isActive: true,
      })

      // Best-fit: smallest room that fits
      let bestRoom = null
      for (const room of rooms) {
        if (room.capacity < studentCount) continue

        const key = `${room._id}-${s.dayOfWeek}`
        const existingSlots = [...(occupation[key] || []), ...(newOccupation[key] || [])]

        const hasConflict = existingSlots.some((slot) =>
          hasTimeOverlap(s.startTime, s.endTime, slot.startTime, slot.endTime)
        )

        if (!hasConflict) {
          bestRoom = room
          break
        }
      }

      if (bestRoom) {
        const key = `${bestRoom._id}-${s.dayOfWeek}`
        if (!newOccupation[key]) newOccupation[key] = []
        newOccupation[key].push({ startTime: s.startTime, endTime: s.endTime })

        assignments.push({
          sessionId: s._id.toString(),
          sessionName: s.name,
          roomId: bestRoom._id.toString(),
          roomName: bestRoom.name,
          reason: `أصغر قاعة مناسبة (${bestRoom.capacity} مقعد لـ ${studentCount} طالب)`,
        })
      } else {
        unassignable.push({
          sessionId: s._id.toString(),
          sessionName: s.name,
          reason: "لا توجد قاعة متاحة بالسعة الكافية في هذا الوقت",
        })
      }
    }

    // Apply if confirmed
    if (confirm && assignments.length > 0) {
      for (const a of assignments) {
        await SessionTemplate.findByIdAndUpdate(a.sessionId, { roomId: a.roomId })
      }
    }

    return NextResponse.json({
      assignments,
      unassignable,
      applied: confirm,
      message: confirm
        ? `تم تعيين ${assignments.length} قاعة بنجاح`
        : `${assignments.length} تعيين مقترح، ${unassignable.length} لا يمكن تعيينهم`,
    })
  } catch (error) {
    console.error("Error auto-assigning rooms:", error)
    return NextResponse.json({ message: "حدث خطأ أثناء التعيين التلقائي" }, { status: 500 })
  }
}
