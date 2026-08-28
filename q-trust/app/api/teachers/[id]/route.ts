import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import User from "@/models/User"
import SessionTemplate from "@/models/SessionTemplate"
import StudentSession from "@/models/StudentSession"
import Student from "@/models/Student"
import { auth } from "@/lib/auth"
import { updateUserSchema } from "@/lib/validations"
import { ROLES } from "@/lib/constants"
import { invalidObjectId } from "@/lib/object-id"

// Force model registration (needed for populate in serverless)
void User
void SessionTemplate
void StudentSession
void Student

// GET /api/teachers/[id] - Get a single teacher with stats
export async function GET(
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

    await dbConnect()

    const teacher = await User.findOne({ _id: id, role: ROLES.TEACHER, tenantId })
      .select("-passwordHash")
      .lean()

    if (!teacher) {
      return NextResponse.json(
        { message: "المعلم غير موجود" },
        { status: 404 }
      )
    }

    // Get sessions count
    const sessionsCount = await SessionTemplate.countDocuments({
      teacherId: id,
      isActive: true,
      tenantId,
    })

    // Get unique students count across all sessions
    const sessionIds = await SessionTemplate.find({ teacherId: id, isActive: true, tenantId })
      .select("_id")
      .lean()
    
    const studentsCount = await StudentSession.distinct("studentId", {
      sessionTemplateId: { $in: sessionIds.map(s => s._id) },
      isActive: true,
      tenantId,
    }).then(ids => ids.length)

    return NextResponse.json({
      ...teacher,
      sessionsCount,
      studentsCount,
    })
  } catch (error) {
    console.error("Error fetching teacher:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء جلب البيانات" },
      { status: 500 }
    )
  }
}

// PATCH /api/teachers/[id] - Update a teacher
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

    const tenantId = session.user.tenantId
    if (!tenantId) {
      return NextResponse.json({ message: "لا يوجد سياق مؤسسة" }, { status: 403 })
    }

    const { id } = await params
    const bad = invalidObjectId(id)
    if (bad) return bad
    const body = await request.json()

    // Validate input
    const validationResult = updateUserSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { message: validationResult.error.issues[0].message },
        { status: 400 }
      )
    }

    await dbConnect()

    // Check if email already exists (if updating email)
    if (validationResult.data.email) {
      const existingUser = await User.findOne({
        email: validationResult.data.email.toLowerCase(),
        _id: { $ne: id },
        tenantId,
      })
      if (existingUser) {
        return NextResponse.json(
          { message: "البريد الإلكتروني مستخدم بالفعل" },
          { status: 400 }
        )
      }
    }

    const teacher = await User.findOneAndUpdate(
      { _id: id, role: ROLES.TEACHER, tenantId },
      { $set: validationResult.data },
      { new: true, runValidators: true }
    ).select("-passwordHash")

    if (!teacher) {
      return NextResponse.json(
        { message: "المعلم غير موجود" },
        { status: 404 }
      )
    }

    return NextResponse.json(teacher)
  } catch (error) {
    console.error("Error updating teacher:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء تحديث البيانات" },
      { status: 500 }
    )
  }
}

// DELETE /api/teachers/[id] - Delete a teacher
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

    await dbConnect()

    const teacher = await User.findOneAndDelete({ _id: id, role: ROLES.TEACHER, tenantId })

    if (!teacher) {
      return NextResponse.json(
        { message: "المعلم غير موجود" },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: "تم حذف المعلم بنجاح" })
  } catch (error) {
    console.error("Error deleting teacher:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء حذف البيانات" },
      { status: 500 }
    )
  }
}

