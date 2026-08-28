import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import SessionTemplate from "@/models/SessionTemplate"
import StudentSession from "@/models/StudentSession"
import Student from "@/models/Student"
import Room from "@/models/Room"
import { auth } from "@/lib/auth"
import { ROLES } from "@/lib/constants"
import { invalidObjectId } from "@/lib/object-id"

void SessionTemplate
void StudentSession
void Student
void Room

// POST /api/sessions/[id]/students - Add students to session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const bad = invalidObjectId(id)
    if (bad) return bad
    const body = await request.json()
    const { studentIds, forceOverCapacity } = body

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json(
        { message: "اختر طالباً واحداً على الأقل" },
        { status: 400 }
      )
    }

    for (const candidateId of studentIds) {
      const bad2 = invalidObjectId(candidateId)
      if (bad2) return bad2
    }

    await dbConnect()

    const sessionTemplate = await SessionTemplate.findOne({ _id: id, tenantId })
    if (!sessionTemplate) {
      return NextResponse.json(
        { message: "الحصة غير موجودة" },
        { status: 404 }
      )
    }

    // Capacity check if room is assigned
    if (sessionTemplate.roomId && !forceOverCapacity) {
      const room = await Room.findOne({ _id: sessionTemplate.roomId, tenantId }).lean()
      if (room) {
        const currentCount = await StudentSession.countDocuments({
          tenantId,
          sessionTemplateId: id,
          isActive: true,
        })
        const newTotal = currentCount + studentIds.length
        if (newTotal > room.capacity) {
          return NextResponse.json({
            capacityExceeded: true,
            currentCount,
            capacity: room.capacity,
            availableSlots: Math.max(0, room.capacity - currentCount),
            roomName: room.name,
            message: `القاعة "${room.name}" ممتلئة (${currentCount}/${room.capacity}). هل تريد الإضافة رغم ذلك؟`,
          }, { status: 200 })
        }
      }
    }

    // Check for time conflicts for each student
    const conflicts: string[] = []
    const validAssignments: { studentId: string; sessionTemplateId: string }[] = []

    for (const studentId of studentIds) {
      // Check if already assigned
      const existing = await StudentSession.findOne({
        tenantId,
        studentId,
        sessionTemplateId: id,
      })
      
      if (existing) {
        if (!existing.isActive) {
          // Reactivate
          existing.isActive = true
          await existing.save()
        }
        continue
      }

      // Check for overlapping sessions on the same day
      const studentSessions = await StudentSession.find({
        tenantId,
        studentId,
        isActive: true,
      }).populate("sessionTemplateId")

      let hasConflict = false
      for (const ss of studentSessions) {
        const existingSession = ss.sessionTemplateId as any
        if (!existingSession) continue

        // Same day check
        if (existingSession.dayOfWeek === sessionTemplate.dayOfWeek) {
          // Check time overlap
          const newStart = timeToMinutes(sessionTemplate.startTime)
          const newEnd = timeToMinutes(sessionTemplate.endTime)
          const existingStart = timeToMinutes(existingSession.startTime)
          const existingEnd = timeToMinutes(existingSession.endTime)

          if (
            (newStart >= existingStart && newStart < existingEnd) ||
            (newEnd > existingStart && newEnd <= existingEnd) ||
            (newStart <= existingStart && newEnd >= existingEnd)
          ) {
            const student = await Student.findOne({ _id: studentId, tenantId }).select("fullName")
            conflicts.push(
              `${student?.fullName}: تعارض مع حصة "${existingSession.name}"`
            )
            hasConflict = true
            break
          }
        }
      }

      if (!hasConflict) {
        validAssignments.push({
          studentId,
          sessionTemplateId: id,
        })
      }
    }

    // Create valid assignments
    if (validAssignments.length > 0) {
      await StudentSession.insertMany(
        validAssignments.map(a => ({
          ...a,
          tenantId,
          isActive: true,
        }))
      )
    }

    return NextResponse.json({
      added: validAssignments.length,
      conflicts,
      message: conflicts.length > 0
        ? `تم إضافة ${validAssignments.length} طالب. ${conflicts.length} تعارضات.`
        : `تم إضافة ${validAssignments.length} طالب بنجاح`,
    })
  } catch (error) {
    console.error("Error adding students to session:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء إضافة الطلاب" },
      { status: 500 }
    )
  }
}

// DELETE /api/sessions/[id]/students - Remove student from session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const bad = invalidObjectId(id)
    if (bad) return bad
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")

    if (!studentId) {
      return NextResponse.json(
        { message: "معرف الطالب مطلوب" },
        { status: 400 }
      )
    }

    const bad2 = invalidObjectId(studentId)
    if (bad2) return bad2

    await dbConnect()

    const result = await StudentSession.findOneAndUpdate(
      { tenantId, sessionTemplateId: id, studentId },
      { isActive: false },
      { new: true, runValidators: true }
    )

    if (!result) {
      return NextResponse.json(
        { message: "الطالب غير مسجل في هذه الحصة" },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: "تم إزالة الطالب من الحصة" })
  } catch (error) {
    console.error("Error removing student from session:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء إزالة الطالب" },
      { status: 500 }
    )
  }
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

