import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import Student from "@/models/Student"
import Tenant from "@/models/Tenant"
import { logActivity } from "@/models/ActivityLog"
import { auth } from "@/lib/auth"
import { createStudentSchema } from "@/lib/validations"
import { ROLES } from "@/lib/constants"
import { generateQrUuid } from "@/lib/utils"

// Force model registration (needed for populate in serverless)
void Student

// Generate next enrollment number (format: YYYY-XXX)
async function generateEnrollmentNumber(tenantId: string): Promise<string> {
  const currentYear = new Date().getFullYear()
  const yearPrefix = `${currentYear}-`

  // Find the highest enrollment number for this year (within this tenant)
  const lastStudent = await Student.findOne({
    tenantId,
    enrollmentNumber: { $regex: `^${yearPrefix}` }
  })
    .sort({ enrollmentNumber: -1 })
    .select('enrollmentNumber')
    .lean()
  
  let nextNumber = 1
  if (lastStudent?.enrollmentNumber) {
    const lastNumber = parseInt(lastStudent.enrollmentNumber.split('-')[1], 10)
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1
    }
  }
  
  return `${yearPrefix}${nextNumber.toString().padStart(3, '0')}`
}

// GET /api/students - List all students
export async function GET() {
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

    const students = await Student.find({ tenantId })
      .sort({ createdAt: -1 })
      .lean()

    // Transform data to include displayName for backward compatibility
    const transformedStudents = students.map(student => ({
      ...student,
      displayName: student.firstName && student.lastName 
        ? `${student.firstName} ${student.lastName}`
        : student.fullName || '',
    }))

    return NextResponse.json(transformedStudents)
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

    // Enforce the tenant's plan seat limit before creating.
    const tenant = await Tenant.findById(tenantId).select("maxStudents").lean<{ maxStudents: number }>()
    if (!tenant) {
      return NextResponse.json({ message: "المؤسسة غير موجودة" }, { status: 403 })
    }
    const activeCount = await Student.countDocuments({ tenantId, isActive: true })
    if (activeCount >= tenant.maxStudents) {
      return NextResponse.json(
        {
          message: `لقد بلغت الحدّ الأقصى لعدد الطلاب في باقتك (${tenant.maxStudents} طالب). يرجى ترقية الاشتراك لإضافة المزيد.`,
        },
        { status: 403 }
      )
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
  } catch (error: any) {
    console.error("Error creating student:", error)
    
    // Handle duplicate CIN error
    if (error.code === 11000 && error.keyPattern?.cin) {
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
