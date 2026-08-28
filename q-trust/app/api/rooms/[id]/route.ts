import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import Room from "@/models/Room"
import SessionTemplate from "@/models/SessionTemplate"
import StudentSession from "@/models/StudentSession"
import { auth } from "@/lib/auth"
import { updateRoomSchema } from "@/lib/validations"
import { ROLES } from "@/lib/constants"
import { invalidObjectId } from "@/lib/object-id"

void Room
void SessionTemplate
void StudentSession

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session || (session.user.role !== ROLES.ADMIN && session.user.role !== ROLES.TEACHER)) {
      return NextResponse.json({ message: "غير مصرح لك بالوصول" }, { status: 403 })
    }

    const tenantId = session.user.tenantId
    if (!tenantId) {
      return NextResponse.json({ message: "لا يوجد سياق مؤسسة" }, { status: 403 })
    }

    const { id } = await params
    const bad = invalidObjectId(id)
    if (bad) return bad
    await dbConnect()

    const room = await Room.findOne({ _id: id, tenantId }).lean()
    if (!room) {
      return NextResponse.json({ message: "القاعة غير موجودة" }, { status: 404 })
    }

    const sessions = await SessionTemplate.find({ tenantId, roomId: id, isActive: true })
      .populate("teacherId", "fullName")
      .sort({ dayOfWeek: 1, startTime: 1 })
      .lean()

    const sessionsWithCount = await Promise.all(
      sessions.map(async (s) => {
        const studentCount = await StudentSession.countDocuments({
          tenantId,
          sessionTemplateId: s._id,
          isActive: true,
        })
        return { ...s, studentCount }
      })
    )

    return NextResponse.json({ ...room, sessions: sessionsWithCount })
  } catch (error) {
    console.error("Error fetching room:", error)
    return NextResponse.json({ message: "حدث خطأ أثناء جلب البيانات" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session || session.user.role !== ROLES.ADMIN) {
      return NextResponse.json({ message: "غير مصرح لك بالوصول" }, { status: 403 })
    }

    const tenantId = session.user.tenantId
    if (!tenantId) {
      return NextResponse.json({ message: "لا يوجد سياق مؤسسة" }, { status: 403 })
    }

    const { id } = await params
    const bad = invalidObjectId(id)
    if (bad) return bad
    const body = await request.json()
    const validationResult = updateRoomSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { message: validationResult.error.issues[0].message },
        { status: 400 }
      )
    }

    await dbConnect()

    if (validationResult.data.name) {
      const existing = await Room.findOne({
        tenantId,
        name: validationResult.data.name,
        _id: { $ne: id },
      })
      if (existing) {
        return NextResponse.json({ message: "يوجد قاعة بهذا الاسم بالفعل" }, { status: 409 })
      }
    }

    const room = await Room.findOneAndUpdate({ _id: id, tenantId }, validationResult.data, { new: true, runValidators: true })
    if (!room) {
      return NextResponse.json({ message: "القاعة غير موجودة" }, { status: 404 })
    }

    return NextResponse.json(room)
  } catch (error) {
    console.error("Error updating room:", error)
    return NextResponse.json({ message: "حدث خطأ أثناء تحديث القاعة" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session || session.user.role !== ROLES.ADMIN) {
      return NextResponse.json({ message: "غير مصرح لك بالوصول" }, { status: 403 })
    }

    const tenantId = session.user.tenantId
    if (!tenantId) {
      return NextResponse.json({ message: "لا يوجد سياق مؤسسة" }, { status: 403 })
    }

    const { id } = await params
    const bad = invalidObjectId(id)
    if (bad) return bad
    await dbConnect()

    const activeSessions = await SessionTemplate.countDocuments({
      tenantId,
      roomId: id,
      isActive: true,
    })

    if (activeSessions > 0) {
      return NextResponse.json(
        { message: `لا يمكن حذف القاعة لأنها مرتبطة بـ ${activeSessions} حصة نشطة` },
        { status: 400 }
      )
    }

    const room = await Room.findOneAndUpdate({ _id: id, tenantId }, { isActive: false }, { new: true, runValidators: true })
    if (!room) {
      return NextResponse.json({ message: "القاعة غير موجودة" }, { status: 404 })
    }

    return NextResponse.json({ message: "تم حذف القاعة بنجاح" })
  } catch (error) {
    console.error("Error deleting room:", error)
    return NextResponse.json({ message: "حدث خطأ أثناء حذف القاعة" }, { status: 500 })
  }
}
