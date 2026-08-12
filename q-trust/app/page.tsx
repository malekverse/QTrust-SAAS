import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { ROLES } from "@/lib/constants"

export default async function HomePage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/auth/login")
  }

  if (session.user.role === ROLES.ADMIN) {
    redirect("/admin/dashboard")
  }

  if (session.user.role === ROLES.STUDENT) {
    if (session.user.mustChangePassword) {
      redirect("/auth/onboarding")
    }
    redirect("/student/dashboard")
  }

  if (session.user.role === ROLES.TEACHER) {
    redirect("/teacher/dashboard")
  }

  // Unknown/unhandled role — fail safe to login rather than defaulting into a portal
  redirect("/auth/login")
}
