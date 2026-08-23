import "@/app/app-dashboard.css"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { ROLES } from "@/lib/constants"
import { getTenantStatus, isBlockedStatus } from "@/lib/tenant-status"
import { AdminAIWrapper } from "@/components/ai-assistant/admin-ai-wrapper"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect("/auth/login")
  }

  if (session.user.role !== ROLES.ADMIN) {
    redirect("/teacher/dashboard")
  }

  // Block a suspended/cancelled tenant's users from the dashboard.
  if (session.user.tenantId && isBlockedStatus(await getTenantStatus(session.user.tenantId))) {
    redirect("/suspended")
  }

  // Force a first-login password change (e.g. a freshly-provisioned tenant admin).
  if (session.user.mustChangePassword) {
    redirect("/auth/onboarding")
  }

  return (
    <DashboardLayout role="admin">
      <AdminAIWrapper>{children}</AdminAIWrapper>
    </DashboardLayout>
  )
}

