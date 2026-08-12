import { NextResponse } from "next/server"
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

interface Conflict {
  type: "room_double_booking" | "teacher_double_booking" | "over_capacity"
  severity: "error" | "warning"
  message: string
  sessions: string[]
  details: Record<string, unknown>
}

export async function GET() {
  try {
    const session = await auth()
    if (!session || session.user.role !== ROLES.ADMIN) {
      return NextResponse.json({ message: "غير مصرح لك بالوصول" }, { status: 403 })
    }

    const tenantId = session.user.tenantId
    if (!tenantId) {
      return NextResponse.json({ message: "لا يوجد سياق مؤسسة" }, { status: 403 })
    }

    await dbConnect()

    const sessions = await SessionTemplate.find({ tenantId, isActive: true })
      .populate("teacherId", "fullName")
      .populate("roomId", "name capacity")
      .lean()

    const conflicts: Conflict[] = []

    // Check room double-bookings
    const roomGroups: Record<string, typeof sessions> = {}
    for (const s of sessions) {
      if (!s.roomId) continue
      const key = `${(s.roomId as any)._id}-${s.dayOfWeek}`
      if (!roomGroups[key]) roomGroups[key] = []
      roomGroups[key].push(s)
    }

    for (const [, group] of Object.entries(roomGroups)) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          if (hasTimeOverlap(group[i].startTime, group[i].endTime, group[j].startTime, group[j].endTime)) {
            const room = group[i].roomId as any
            conflicts.push({
              type: "room_double_booking",
              severity: "error",
              message: `تعارض في القاعة "${room.name}": "${group[i].name}" و "${group[j].name}" في نفس الوقت`,
              sessions: [group[i]._id.toString(), group[j]._id.toString()],
              details: { roomName: room.name, day: group[i].dayOfWeek },
            })
          }
        }
      }
    }

    // Check teacher double-bookings
    const teacherGroups: Record<string, typeof sessions> = {}
    for (const s of sessions) {
      const tid = (s.teacherId as any)?._id?.toString()
      if (!tid) continue
      const key = `${tid}-${s.dayOfWeek}`
      if (!teacherGroups[key]) teacherGroups[key] = []
      teacherGroups[key].push(s)
    }

    for (const [, group] of Object.entries(teacherGroups)) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          if (hasTimeOverlap(group[i].startTime, group[i].endTime, group[j].startTime, group[j].endTime)) {
            const teacher = group[i].teacherId as any
            conflicts.push({
              type: "teacher_double_booking",
              severity: "error",
              message: `تعارض للمعلم "${teacher.fullName}": "${group[i].name}" و "${group[j].name}" في نفس الوقت`,
              sessions: [group[i]._id.toString(), group[j]._id.toString()],
              details: { teacherName: teacher.fullName, day: group[i].dayOfWeek },
            })
          }
        }
      }
    }

    // Check over-capacity
    for (const s of sessions) {
      if (!s.roomId) continue
      const room = s.roomId as any
      const studentCount = await StudentSession.countDocuments({
        tenantId,
        sessionTemplateId: s._id,
        isActive: true,
      })
      if (studentCount > room.capacity) {
        conflicts.push({
          type: "over_capacity",
          severity: "warning",
          message: `الحصة "${s.name}" تتجاوز سعة القاعة "${room.name}" (${studentCount}/${room.capacity})`,
          sessions: [s._id.toString()],
          details: { studentCount, capacity: room.capacity, roomName: room.name },
        })
      }
    }

    return NextResponse.json({
      conflicts,
      summary: {
        roomConflicts: conflicts.filter((c) => c.type === "room_double_booking").length,
        teacherConflicts: conflicts.filter((c) => c.type === "teacher_double_booking").length,
        overCapacity: conflicts.filter((c) => c.type === "over_capacity").length,
        total: conflicts.length,
      },
    })
  } catch (error) {
    console.error("Error checking conflicts:", error)
    return NextResponse.json({ message: "حدث خطأ أثناء فحص التعارضات" }, { status: 500 })
  }
}
