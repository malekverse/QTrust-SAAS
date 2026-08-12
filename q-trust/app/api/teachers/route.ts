import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import User from "@/models/User"
import { logActivity } from "@/models/ActivityLog"
import { hashPassword, auth } from "@/lib/auth"
import { createUserSchema } from "@/lib/validations"
import { ROLES } from "@/lib/constants"

// Force model registration (needed for populate in serverless)
void User

// GET /api/teachers - List all teachers
export async function GET() {
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

    await dbConnect()

    const teachers = await User.find({ role: ROLES.TEACHER, tenantId })
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .lean()

    return NextResponse.json(teachers)
  } catch (error) {
    console.error("Error fetching teachers:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء جلب البيانات" },
      { status: 500 }
    )
  }
}

// POST /api/teachers - Create a new teacher
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
    const validationResult = createUserSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { message: validationResult.error.issues[0].message },
        { status: 400 }
      )
    }

    const { fullName, email, password } = validationResult.data

    await dbConnect()

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase(), tenantId })
    if (existingUser) {
      return NextResponse.json(
        { message: "البريد الإلكتروني مستخدم بالفعل" },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Create teacher
    const teacher = await User.create({
      tenantId,
      fullName,
      email: email.toLowerCase(),
      role: ROLES.TEACHER,
      passwordHash,
      isEmailVerified: false,
      isActive: true,
    })

    // Log activity
    await logActivity(
      'TEACHER_CREATED',
      teacher.fullName,
      {
        tenantId,
        userId: teacher._id,
        metadata: { email: teacher.email }
      }
    )

    // Return without password hash
    const { passwordHash: _, ...teacherData } = teacher.toObject()

    return NextResponse.json(teacherData, { status: 201 })
  } catch (error) {
    console.error("Error creating teacher:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء إنشاء الحساب" },
      { status: 500 }
    )
  }
}

