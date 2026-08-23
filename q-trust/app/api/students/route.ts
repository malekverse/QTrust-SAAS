import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import Student from "@/models/Student"
import Tenant from "@/models/Tenant"
import { logActivity } from "@/models/ActivityLog"
import { auth } from "@/lib/auth"
import { createStudentSchema } from "@/lib/validations"
import { ROLES } from "@/lib/constants"
import { generateQrUuid } from "@/lib/utils"
import { generateEnrollmentNumber } from "@/lib/enrollment"
import { parsePagination, buildPaginatedResponse } from "@/lib/pagination"

// Force model registration (needed for populate in serverless)
void Student

// GET /api/students?page=&limit=&search=&status= - List students (paginated)
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

    const { searchParams } = new URL(request.url)
    const pg = parsePagination(request, { limit: 25 })
    const search = searchParams.get("search")?.trim()
    const status = searchParams.get("status")

    const filter: Record<string, unknown> = { tenantId }
    if (status === "active") filter.isActive = true
    else if (status === "inactive") filter.isActive = false
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { fullName: { $regex: search, $options: "i" } },
        { enrollmentNumber: { $regex: search, $options: "i" } },
      ]
    }

    const [students, total] = await Promise.all([
      Student.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit).lean(),
      Student.countDocuments(filter),
    ])

    const data = students.map(student => ({
      ...student,
      displayName: student.firstName && student.lastName
        ? `${student.firstName} ${student.lastName}`
        : student.fullName || '',
    }))

    return NextResponse.json(buildPaginatedResponse(data, total, pg))
  } catch (error) {
    console.error("Error fetching students:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء جلب البيانات" },
      { status: 500 }
    )
  }
}

// POST /api/students - Create a new student
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
    const validationResult = createStudentSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { message: validationResult.error.issues[0].message },
        { status: 400 }
      )
    }

    await dbConnect()

    // Enforce the tenant's effective seat limit (plan defaults OR per-tenant
    // override on Tenant.limits.maxStudents; null = unlimited).
    const tenant = await Tenant.findById(tenantId)
      .select("plan limits")
      .lean<{ plan: string; limits?: { maxStudents?: number | null } }>()
    if (!tenant) {
      return NextResponse.json({ message: "المؤسسة غير موجودة" }, { status: 403 })
    }
    const { getEffectiveLimits } = await import("@/lib/entitlements")
    const { maxStudents } = getEffectiveLimits(tenant as any)
    if (maxStudents !== null) {
      const activeCount = await Student.countDocuments({ tenantId, isActive: true })
      if (activeCount >= maxStudents) {
        return NextResponse.json(
          {
            message: `لقد بلغت الحدّ الأقصى لعدد الطلاب في باقتك (${maxStudents} طالب). يرجى ترقية الاشتراك لإضافة المزيد.`,
          },
          { status: 403 }
        )
      }
    }

    // Generate unique QR UUID
    const qrUuid = generateQrUuid()

    // Auto-generate enrollment number if not provided
    let enrollmentNumber = validationResult.data.enrollmentNumber
    if (!enrollmentNumber || enrollmentNumber.trim() === '') {
      enrollmentNumber = await generateEnrollmentNumber(tenantId)
    }

    // Prepare student data
    const studentData = {
      ...validationResult.data,
      tenantId,
      enrollmentNumber,
      qrUuid,
      isActive: true,
      // Set fullName for backward compatibility
      fullName: `${validationResult.data.firstName} ${validationResult.data.lastName}`,
      // Map fatherName to parentName for backward compatibility
      parentName: validationResult.data.fatherName,
    }

    // Create student
    const student = await Student.create(studentData)

    // Log activity
    await logActivity(
      'STUDENT_CREATED',
      `${student.firstName} ${student.lastName}`,
      {
        tenantId,
        studentId: student._id,
        userId: session.user.id
      }
    )

    return NextResponse.json(student, { status: 201 })
  } catch (error) {
    console.error("Error creating student:", error)

    // Handle duplicate CIN error
    const dup = error as { code?: number; keyPattern?: Record<string, unknown> }
    if (dup.code === 11000 && dup.keyPattern?.cin) {
      return NextResponse.json(
        { message: "رقم بطاقة التعريف مستخدم مسبقاً" },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { message: "حدث خطأ أثناء إنشاء الطالب" },
      { status: 500 }
    )
  }
}
