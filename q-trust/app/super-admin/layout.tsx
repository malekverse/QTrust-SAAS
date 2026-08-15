import "@/app/app-dashboard.css"
import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { ROLES } from "@/lib/constants"
import { ShieldCheck, Building2, Inbox, Receipt } from "lucide-react"
import { SignOutButton } from "./sign-out-button"

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) {
    redirect("/auth/login")
  }
  // Platform operators only — tenant users never reach the console.
  if (session.user.role !== ROLES.SUPER_ADMIN) {
    redirect("/")
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <span className="font-bold text-base sm:text-lg">منصة Q-Trust — لوحة الإدارة</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-sm text-muted-foreground">
              {session.user.fullName}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <nav className="border-b bg-card/50">
        <div className="mx-auto max-w-6xl px-4 h-12 flex items-center gap-1">
          <Link
            href="/super-admin/tenants"
            className="px-3 py-2 text-sm rounded-md hover:bg-muted flex items-center gap-2 transition-colors"
          >
            <Building2 className="h-4 w-4" />
            المؤسسات
          </Link>
          <Link
            href="/super-admin/billing"
            className="px-3 py-2 text-sm rounded-md hover:bg-muted flex items-center gap-2 transition-colors"
          >
            <Receipt className="h-4 w-4" />
            الفوترة
          </Link>
          <Link
            href="/super-admin/leads"
            className="px-3 py-2 text-sm rounded-md hover:bg-muted flex items-center gap-2 transition-colors"
          >
            <Inbox className="h-4 w-4" />
            طلبات العروض
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  )
}
