import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import Room from "@/models/Room"
import SessionTemplate from "@/models/SessionTemplate"
import StudentSession from "@/models/StudentSession"
import { auth } from "@/lib/auth"
import { createRoomSchema } from "@/lib/validations"
import { ROLES } from "@/lib/constants"

void Room
void SessionTemplate
void StudentSession

export async function GET() {
  try {
    const session = await auth()

    if (!session || (session.user.role !== ROLES.ADMIN && session.user.role !== ROLES.TEACHER)) {
      return NextResponse.json(
        { message: "غير مصرح لك بالوصول" },
        { status: 403 }
      )
    }

    await dbConnect()

    const rooms = await Room.find().sort({ name: 1 }).lean()

    const roomsWithStats = await Promise.all(
      rooms.map(async (room) => {
        const sessions = await SessionTemplate.find({
          roomId: room._id,
          isActive: true,
        }).lean()

        let totalEnrolled = 0
        for (const s of sessions) {
          const count = await StudentSession.countDocuments({
            sessionTemplateId: s._id,
            isActive: true,
          })
          totalEnrolled += count
        }

        const maxOccupancy = sessions.length > 0
          ? Math.max(
              ...await Promise.all(
                sessions.map((s) =>
                  StudentSession.countDocuments({
                    sessionTemplateId: s._id,
                    isActive: true,
                  })
                )
              )
            )
          : 0

        return {
          ...room,
          sessionCount: sessions.length,
          maxOccupancy,
          utilizationRate: room.capacity > 0 ? Math.round((maxOccupancy / room.capacity) * 100) : 0,
        }
      })
    )

    return NextResponse.json(roomsWithStats)
  } catch (error) {
    console.error("Error fetching rooms:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء جلب البيانات" },
      { status: 500 }
    )
  }
}

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
    const validationResult = createRoomSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { message: validationResult.error.issues[0].message },
        { status: 400 }
      )
    }

    await dbConnect()

    const existing = await Room.findOne({ name: validationResult.data.name })
    if (existing) {
      return NextResponse.json(
        { message: "يوجد قاعة بهذا الاسم بالفعل" },
        { status: 409 }
      )
    }

    const room = await Room.create(validationResult.data)

    return NextResponse.json(room, { status: 201 })
  } catch (error) {
    console.error("Error creating room:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء إنشاء القاعة" },
      { status: 500 }
    )
  }
}
