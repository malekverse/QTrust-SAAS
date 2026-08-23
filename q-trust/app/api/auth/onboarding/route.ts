import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import User from "@/models/User"
import { auth, hashPassword } from "@/lib/auth"

// POST /api/auth/onboarding — role-agnostic first-login password change.
//
// Works for every role, including a SUPER_ADMIN (who has no tenantId) and a
// freshly-provisioned tenant ADMIN. Unlike a normal password change it takes no
// current password, but it is gated on the *database* record having
// mustChangePassword === true — so it can only ever be used once, right after
// provisioning, and never as an unauthenticated password-reset bypass.
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ message: "غير مصرح لك بالوصول" }, { status: 401 })
    }

    const { newPassword } = await request.json()
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
      return NextResponse.json(
        { message: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" },
        { status: 400 }
      )
    }

    await dbConnect()

    const user = await User.findById(session.user.id)
    if (!user) {
      return NextResponse.json({ message: "المستخدم غير موجود" }, { status: 404 })
    }

    // Only valid as a first-login flow. Once the flag is cleared, callers must
    // use the authenticated change-password endpoint (which verifies the current
    // password) instead.
    if (!user.mustChangePassword) {
      return NextResponse.json(
        { message: "لا حاجة لتغيير كلمة المرور" },
        { status: 400 }
      )
    }

    // Setting passwordHash triggers the pre-save hook that clears any pending
    // activation token / temp credential for this user.
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
