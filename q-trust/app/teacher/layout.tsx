import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { ROLES } from "@/lib/constants"

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

  return <DashboardLayout role="teacher">{children}</DashboardLayout>
}

