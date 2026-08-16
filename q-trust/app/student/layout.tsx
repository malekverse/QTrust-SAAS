import "@/app/app-dashboard.css"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { ROLES } from "@/lib/constants"
import { getTenantStatus, isBlockedStatus } from "@/lib/tenant-status"

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

  // Block a suspended/cancelled tenant's users from the dashboard.
  if (session.user.tenantId && isBlockedStatus(await getTenantStatus(session.user.tenantId))) {
    redirect("/suspended")
  }

  // Check if student must change password (first login)
  if (session.user.mustChangePassword) {
    redirect("/auth/onboarding")
  }

  return <DashboardLayout role="student">{children}</DashboardLayout>
}
