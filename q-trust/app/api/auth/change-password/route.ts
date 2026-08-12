import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import User from "@/models/User"
import { auth, hashPassword, verifyPassword } from "@/lib/auth"
import { changePasswordSchema } from "@/lib/validations"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json(
        { message: "غير مصرح لك بالوصول" },
        { status: 401 }
      )
    }

    const tenantId = session.user.tenantId
    if (!tenantId) {
      return NextResponse.json({ message: "لا يوجد سياق مؤسسة" }, { status: 403 })
    }

    const body = await request.json()
    
    const validationResult = changePasswordSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { message: validationResult.error.issues[0].message },
        { status: 400 }
      )
    }

    const { currentPassword, newPassword } = validationResult.data

    await dbConnect()

    // Get user with password
    const user = await User.findOne({ _id: session.user.id, tenantId })
    if (!user) {
      return NextResponse.json(
        { message: "المستخدم غير موجود" },
        { status: 404 }
      )
    }

    // Verify current password
    const isValidPassword = await verifyPassword(currentPassword, user.passwordHash)
    if (!isValidPassword) {
      return NextResponse.json(
        { message: "كلمة المرور الحالية غير صحيحة" },
        { status: 400 }
      )
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword)

    // Update password
    user.passwordHash = newPasswordHash
    await user.save()

    return NextResponse.json({ message: "تم تغيير كلمة المرور بنجاح" })
  } catch (error) {
    console.error("Error changing password:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء تغيير كلمة المرور" },
      { status: 500 }
    )
  }
}

