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

    // Look up by id. Scope to the tenant when present; a SUPER_ADMIN has no
    // tenantId and must still be able to change their own password.
    const tenantId = session.user.tenantId
    const user = await User.findOne(
      tenantId ? { _id: session.user.id, tenantId } : { _id: session.user.id }
    )
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

    // Update password. Also clear the first-login flag so a user who reaches
    // this authenticated flow while still flagged doesn't get bounced back to
    // onboarding. (Setting passwordHash also triggers the temp-credential purge
    // hook on the User model.)
    user.passwordHash = newPasswordHash
    user.mustChangePassword = false
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

