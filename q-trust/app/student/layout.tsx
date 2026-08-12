import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { ROLES } from "@/lib/constants"

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect("/auth/login")
  }

  if (session.user.role !== ROLES.STUDENT) {
    if (session.user.role === ROLES.ADMIN) {
      redirect("/admin/dashboard")
    }
    redirect("/teacher/dashboard")
  }

  // Check if student must change password (first login)
  if (session.user.mustChangePassword) {
    redirect("/auth/onboarding")
  }

  return <DashboardLayout role="student">{children}</DashboardLayout>
}
