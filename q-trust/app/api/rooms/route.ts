import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import Room from "@/models/Room"
import SessionTemplate from "@/models/SessionTemplate"
import StudentSession from "@/models/StudentSession"
import { auth } from "@/lib/auth"
import { createRoomSchema } from "@/lib/validations"
import { ROLES } from "@/lib/constants"
import { parsePagination, buildPaginatedResponse } from "@/lib/pagination"

void Room
void SessionTemplate
void StudentSession

// GET /api/rooms?page=&limit= — list rooms (paginated)
export async function GET(request: NextRequest) {
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

    const pg = parsePagination(request, { limit: 50 })
    const filter = { tenantId }

    const [rooms, total] = await Promise.all([
      Room.find(filter).sort({ name: 1 }).skip(pg.skip).limit(pg.limit).lean(),
      Room.countDocuments(filter),
    ])

    const roomsWithStats = await Promise.all(
      rooms.map(async (room) => {
        const sessions = await SessionTemplate.find({
          tenantId,
          roomId: room._id,
          isActive: true,
        }).lean()

        const maxOccupancy = sessions.length > 0
          ? Math.max(
              ...await Promise.all(
                sessions.map((s) =>
                  StudentSession.countDocuments({
                    tenantId,
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

    return NextResponse.json(buildPaginatedResponse(roomsWithStats, total, pg))
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

    const tenantId = session.user.tenantId
    if (!tenantId) {
      return NextResponse.json({ message: "لا يوجد سياق مؤسسة" }, { status: 403 })
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

    const existing = await Room.findOne({ tenantId, name: validationResult.data.name })
    if (existing) {
      return NextResponse.json(
        { message: "يوجد قاعة بهذا الاسم بالفعل" },
        { status: 409 }
      )
    }

    const room = await Room.create({ ...validationResult.data, tenantId })

    return NextResponse.json(room, { status: 201 })
  } catch (error) {
    console.error("Error creating room:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء إنشاء القاعة" },
      { status: 500 }
    )
  }
}
