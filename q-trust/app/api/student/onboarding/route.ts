import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import User from "@/models/User"
import { auth, hashPassword } from "@/lib/auth"
import { ROLES } from "@/lib/constants"

// POST /api/student/onboarding - Change temporary password on first login
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session || session.user.role !== ROLES.STUDENT) {
      return NextResponse.json(
        { message: "غير مصرح لك بالوصول" },
        { status: 403 }
      )
    }

    const tenantId = session.user.tenantId
    if (!tenantId) {
      return NextResponse.json({ message: "لا يوجد سياق مؤسسة" }, { status: 403 })
    }

    const { newPassword } = await request.json()

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" },
        { status: 400 }
      )
    }

    await dbConnect()

    const user = await User.findOne({ _id: session.user.id, tenantId })
    if (!user) {
      return NextResponse.json(
        { message: "المستخدم غير موجود" },
        { status: 404 }
      )
    }

    // Hash and update password
    user.passwordHash = await hashPassword(newPassword)
    user.mustChangePassword = false
    await user.save()

    return NextResponse.json({ message: "تم تغيير كلمة المرور بنجاح" })
  } catch (error) {
    console.error("Error in onboarding:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء تغيير كلمة المرور" },
      { status: 500 }
    )
  }
}
