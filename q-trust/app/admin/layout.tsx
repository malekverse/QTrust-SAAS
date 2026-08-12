import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { ROLES } from "@/lib/constants"
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

  return (
    <DashboardLayout role="admin">
      <AdminAIWrapper>{children}</AdminAIWrapper>
    </DashboardLayout>
  )
}

