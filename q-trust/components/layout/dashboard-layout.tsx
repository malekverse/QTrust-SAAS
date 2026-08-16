"use client"

import { ReactNode, useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { isRtl, type Locale } from "@/i18n/config"
import { Sidebar } from "./sidebar"
import { Navbar } from "./navbar"
import { ADMIN_NAV_KEYS, TEACHER_NAV_KEYS, STUDENT_NAV_KEYS } from "@/lib/constants"
import { cn } from "@/lib/utils"

interface DashboardLayoutProps {
  children: ReactNode
  role: "admin" | "teacher" | "student"
}

export function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const pathname = usePathname()
  const locale = useLocale() as Locale
  const t = useTranslations("nav")
  const rtl = isRtl(locale)

  const navKeys = role === "admin"
    ? ADMIN_NAV_KEYS
    : role === "student"
      ? STUDENT_NAV_KEYS
      : TEACHER_NAV_KEYS
  const navItems = navKeys.map(item => ({ href: item.href, label: t(item.labelKey), icon: item.icon }))
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [displayContent, setDisplayContent] = useState(children)

  // Handle page transitions
  useEffect(() => {
    setIsTransitioning(true)
    const timeout = setTimeout(() => {
      setDisplayContent(children)
      setIsTransitioning(false)
    }, 150)
    return () => clearTimeout(timeout)
  }, [pathname, children])

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false)
      }
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [mobileMenuOpen])

  return (
    <div className="min-h-screen bg-background islamic-pattern-bg">
      <Sidebar
        navItems={navItems}
        role={role}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileMenuOpen}
        onCollapsedChange={setSidebarCollapsed}
        onMobileClose={() => setMobileMenuOpen(false)}
        rtl={rtl}
      />
      <div
        className={cn(
          "transition-all duration-300",
          rtl ? "lg:mr-64" : "lg:ml-64",
          sidebarCollapsed && (rtl ? "lg:mr-[72px]" : "lg:ml-[72px]"),
          rtl ? "mr-0" : "ml-0"
        )}
      >
        <Navbar 
          onMenuClick={() => setMobileMenuOpen(true)}
        />
        <main className="p-3 sm:p-4 md:p-6">
          <div 
            className={cn(
              "mx-auto max-w-7xl",
              isTransitioning ? "page-exit" : "page-enter"
            )}
          >
            {displayContent}
          </div>
        </main>
      </div>
    </div>
  )
}
