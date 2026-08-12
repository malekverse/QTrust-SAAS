import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import User from "@/models/User"
import Student from "@/models/Student"
import { logActivity } from "@/models/ActivityLog"
import { auth, hashPassword, generateTempPassword } from "@/lib/auth"
import { ROLES } from "@/lib/constants"

// POST /api/admin/student-accounts/[id]/reset-password - Reset student password
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

    await dbConnect()

    // Find student
    const student = await Student.findOne({ _id: id, tenantId })
    if (!student) {
      return NextResponse.json(
        { message: "الطالب غير موجود" },
        { status: 404 }
      )
    }

    if (!student.userId) {
      return NextResponse.json(
        { message: "الطالب ليس لديه حساب في البوابة" },
        { status: 400 }
      )
    }

    // Find user account
    const user = await User.findOne({ _id: student.userId, tenantId })
    if (!user) {
      return NextResponse.json(
        { message: "حساب المستخدم غير موجود" },
        { status: 404 }
      )
    }

    // Generate new temporary password
    const tempPassword = generateTempPassword()
    const passwordHashValue = await hashPassword(tempPassword)

    // Update user
    user.passwordHash = passwordHashValue
    user.mustChangePassword = true
    await user.save()

    const displayName = student.firstName && student.lastName 
      ? `${student.firstName} ${student.lastName}`
      : student.fullName || 'طالب'

    // Log activity
    await logActivity(
      'STUDENT_UPDATED',
      `إعادة تعيين كلمة مرور الطالب ${displayName}`,
      {
        tenantId,
        studentId: student._id,
        userId: session.user.id
      }
    )

    return NextResponse.json({
      message: "تم إعادة تعيين كلمة المرور بنجاح",
      tempPassword,
      studentName: displayName,
      loginIdentifier: user.phone || user.email
    })
  } catch (error) {
    console.error("Error resetting student password:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء إعادة تعيين كلمة المرور" },
      { status: 500 }
    )
  }
}
