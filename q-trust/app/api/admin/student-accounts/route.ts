import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import User from "@/models/User"
import Student from "@/models/Student"
import { logActivity } from "@/models/ActivityLog"
import { auth, hashPassword, generateTempPassword } from "@/lib/auth"
import { ROLES } from "@/lib/constants"

// POST /api/admin/student-accounts - Create a student portal account
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
    const { studentId, parentEmail, parentPhone, parentName } = body

    if (!studentId) {
      return NextResponse.json(
        { message: "معرّف الطالب مطلوب" },
        { status: 400 }
      )
    }

    await dbConnect()

    // Find the student
    const student = await Student.findById(studentId)
    if (!student) {
      return NextResponse.json(
        { message: "الطالب غير موجود" },
        { status: 404 }
      )
    }

    // Check if student already has a portal account
    if (student.hasPortalAccess && student.userId) {
      return NextResponse.json(
        { message: "الطالب لديه حساب بالفعل في البوابة" },
        { status: 400 }
      )
    }

    // Determine login credential using fallback logic:
    // 1. Student email
    // 2. Parent email
    // 3. Phone number (student or parent)
    let loginEmail: string
    let loginPhone: string | undefined
    let credentialType: 'student_email' | 'parent_email' | 'phone'

    if (student.email) {
      // Priority 1: Student's own email
      loginEmail = student.email
      credentialType = 'student_email'
    } else if (parentEmail) {
      // Priority 2: Parent/Guardian email
      loginEmail = parentEmail
      credentialType = 'parent_email'
    } else if (student.phone || parentPhone) {
      // Priority 3: Phone number (generate a system email)
      const phone = student.phone || parentPhone
      loginEmail = `student_${student._id}@qtrust.local`
      loginPhone = phone
      credentialType = 'phone'
    } else {
      return NextResponse.json(
        { message: "يجب توفير بريد إلكتروني أو رقم هاتف على الأقل" },
        { status: 400 }
      )
    }

    // Check if email is already used by another user
    const existingUser = await User.findOne({ email: loginEmail })
    if (existingUser) {
      return NextResponse.json(
        { message: "البريد الإلكتروني مستخدم بالفعل في حساب آخر" },
        { status: 400 }
      )
    }

    // Generate temporary password
    const tempPassword = generateTempPassword()
    const passwordHash = await hashPassword(tempPassword)

    // Create user account
    const displayName = student.firstName && student.lastName 
      ? `${student.firstName} ${student.lastName}`
      : student.fullName || 'طالب'

    const newUser = await User.create({
      fullName: displayName,
      email: loginEmail,
      phone: loginPhone,
      role: ROLES.STUDENT,
      passwordHash,
      isActive: true,
      mustChangePassword: true,
      studentId: student._id
    })

    // Update student with portal access info
    student.hasPortalAccess = true
    student.userId = newUser._id
    if (parentEmail) student.parentEmail = parentEmail
    if (parentPhone) student.parentPhone = parentPhone
    if (parentName) student.parentName = parentName
    await student.save()

    // Log activity
    await logActivity(
      'STUDENT_UPDATED',
      `إنشاء حساب بوابة للطالب ${displayName}`,
      {
        studentId: student._id,
        userId: session.user.id,
        metadata: { credentialType }
      }
    )

    return NextResponse.json({
      message: "تم إنشاء الحساب بنجاح",
      account: {
        studentName: displayName,
        loginIdentifier: credentialType === 'phone' ? loginPhone : loginEmail,
        credentialType,
        tempPassword,
        userId: newUser._id
      }
    }, { status: 201 })
  } catch (error) {
    console.error("Error creating student account:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء إنشاء الحساب" },
      { status: 500 }
    )
  }
}

// GET /api/admin/student-accounts - Get students with/without portal access
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session || session.user.role !== ROLES.ADMIN) {
      return NextResponse.json(
        { message: "غير مصرح لك بالوصول" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const hasAccess = searchParams.get("hasAccess")

    await dbConnect()

    let query: Record<string, unknown> = { isActive: true }
    if (hasAccess === "true") {
      query.hasPortalAccess = true
    } else if (hasAccess === "false") {
      query.$or = [
        { hasPortalAccess: false },
        { hasPortalAccess: { $exists: false } }
      ]
    }

    const students = await Student.find(query)
      .select("firstName lastName fullName email phone parentEmail parentPhone hasPortalAccess userId")
      .populate("userId", "email phone mustChangePassword isActive")
      .sort({ createdAt: -1 })
      .lean()

    return NextResponse.json(students)
  } catch (error) {
    console.error("Error fetching student accounts:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء جلب البيانات" },
      { status: 500 }
    )
  }
}
