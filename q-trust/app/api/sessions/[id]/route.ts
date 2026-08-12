import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import SessionTemplate from "@/models/SessionTemplate"
import StudentSession from "@/models/StudentSession"
import Student from "@/models/Student"
import Room from "@/models/Room"
import User from "@/models/User"
import { auth } from "@/lib/auth"
import { updateSessionTemplateSchema } from "@/lib/validations"
import { ROLES } from "@/lib/constants"

void SessionTemplate
void StudentSession
void Student
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

// GET /api/sessions/[id] - Get session details with students
export async function GET(
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

    const { id } = await params

    await dbConnect()

    const sessionTemplate = await SessionTemplate.findById(id)
      .populate("teacherId", "fullName email")
      .populate("roomId", "name capacity features location")
      .lean()

    if (!sessionTemplate) {
      return NextResponse.json(
        { message: "الحصة غير موجودة" },
        { status: 404 }
      )
    }

    // Get students assigned to this session
    const studentSessions = await StudentSession.find({
      sessionTemplateId: id,
      isActive: true,
    })
      .populate("studentId", "fullName parentName phone qrUuid isActive")
      .lean()

    const students = studentSessions
      .filter(ss => ss.studentId)
      .map(ss => ({
        ...ss.studentId,
        assignedAt: ss.createdAt,
      }))

    return NextResponse.json({
      ...sessionTemplate,
      students,
    })
  } catch (error) {
    console.error("Error fetching session:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء جلب البيانات" },
      { status: 500 }
    )
  }
}

// PATCH /api/sessions/[id] - Update session
export async function PATCH(
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

    const { id } = await params
    const body = await request.json()

    const validationResult = updateSessionTemplateSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { message: validationResult.error.issues[0].message },
        { status: 400 }
      )
    }

    await dbConnect()

    const updateData = validationResult.data

    // Check room time conflicts if roomId, dayOfWeek, or times are changing
    if (updateData.roomId || updateData.dayOfWeek !== undefined || updateData.startTime || updateData.endTime) {
      const current = await SessionTemplate.findById(id).lean()
      if (current) {
        const checkRoomId = updateData.roomId || current.roomId?.toString()
        const checkDay = updateData.dayOfWeek ?? current.dayOfWeek
        const checkStart = updateData.startTime || current.startTime
        const checkEnd = updateData.endTime || current.endTime

        if (checkRoomId) {
          const conflicting = await SessionTemplate.find({
            roomId: checkRoomId,
            dayOfWeek: checkDay,
            isActive: true,
            _id: { $ne: id },
          }).lean()

          for (const existing of conflicting) {
            if (hasTimeOverlap(checkStart, checkEnd, existing.startTime, existing.endTime)) {
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
      }
    }

    const sessionTemplate = await SessionTemplate.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    ).populate("teacherId", "fullName")
     .populate("roomId", "name capacity")

    if (!sessionTemplate) {
      return NextResponse.json(
        { message: "الحصة غير موجودة" },
        { status: 404 }
      )
    }

    return NextResponse.json(sessionTemplate)
  } catch (error) {
    console.error("Error updating session:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء تحديث البيانات" },
      { status: 500 }
    )
  }
}

// DELETE /api/sessions/[id] - Delete session
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

    const { id } = await params

    await dbConnect()

    const sessionTemplate = await SessionTemplate.findByIdAndDelete(id)

    if (!sessionTemplate) {
      return NextResponse.json(
        { message: "الحصة غير موجودة" },
        { status: 404 }
      )
    }

    // Remove all student assignments
    await StudentSession.deleteMany({ sessionTemplateId: id })

    return NextResponse.json({ message: "تم حذف الحصة بنجاح" })
  } catch (error) {
    console.error("Error deleting session:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء حذف البيانات" },
      { status: 500 }
    )
  }
}

