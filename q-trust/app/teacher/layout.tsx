import "@/app/app-dashboard.css"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { ROLES } from "@/lib/constants"
import { getTenantStatus, isBlockedStatus } from "@/lib/tenant-status"

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect("/auth/login")
  }

  // Only teachers may access the teacher portal; route others to their own home
  if (session.user.role !== ROLES.TEACHER) {
    redirect("/")
  }

  // Block a suspended/cancelled tenant's users from the dashboard.
  if (session.user.tenantId && isBlockedStatus(await getTenantStatus(session.user.tenantId))) {
    redirect("/suspended")
  }

  return <DashboardLayout role="teacher">{children}</DashboardLayout>
}

