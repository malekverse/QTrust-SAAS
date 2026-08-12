"use client"

import { ReactNode, useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "./sidebar"
import { Navbar } from "./navbar"
import { ADMIN_NAV_ITEMS, TEACHER_NAV_ITEMS, STUDENT_NAV_ITEMS } from "@/lib/constants"
import { cn } from "@/lib/utils"

interface DashboardLayoutProps {
  children: ReactNode
  role: "admin" | "teacher" | "student"
}

export function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const pathname = usePathname()
  const navItems = role === "admin" 
    ? ADMIN_NAV_ITEMS 
    : role === "student" 
      ? STUDENT_NAV_ITEMS 
      : TEACHER_NAV_ITEMS
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
    <div className="min-h-screen bg-background islamic-pattern-bg" dir="rtl">
      <Sidebar 
        navItems={navItems} 
        role={role} 
        collapsed={sidebarCollapsed}
        mobileOpen={mobileMenuOpen}
        onCollapsedChange={setSidebarCollapsed}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <div 
        className={cn(
          "transition-all duration-300",
          // Desktop margins based on sidebar state
          "lg:mr-64",
          sidebarCollapsed && "lg:mr-[72px]",
          // Mobile - no margin
          "mr-0"
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
