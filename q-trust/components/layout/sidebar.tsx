"use client"

import { useCallback } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  Calendar, 
  ClipboardCheck,
  ClipboardList,
  UsersRound,
  Settings,
  BarChart3,
  BookOpen,
  Star,
  MessageSquareWarning,
  CreditCard,
  DoorOpen,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  X,
  Bot,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { BrandLogo } from "@/components/brand-logo"

const iconMap = {
  LayoutDashboard,
  Users,
  GraduationCap,
  Calendar,
  ClipboardCheck,
  ClipboardList,
  UsersRound,
  Settings,
  BarChart3,
  BookOpen,
  Star,
  MessageSquareWarning,
  CreditCard,
  DoorOpen,
  CalendarClock,
  Bot,
}

interface NavItem {
  href: string
  label: string
  icon: keyof typeof iconMap
}

interface SidebarProps {
  navItems: readonly NavItem[]
  role: "admin" | "teacher" | "student"
  collapsed: boolean
  mobileOpen: boolean
  onCollapsedChange: (collapsed: boolean) => void
  onMobileClose: () => void
}

export function Sidebar({ 
  navItems, 
  role, 
  collapsed, 
  mobileOpen,
  onCollapsedChange,
  onMobileClose 
}: SidebarProps) {
  const pathname = usePathname()

  const handleLinkClick = () => {
    // Close mobile menu when navigating
    onMobileClose()
  }

  // Handle close with event stopping to prevent double-triggers
  const handleClose = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onMobileClose()
  }, [onMobileClose])

  // Handle overlay click separately
  const handleOverlayClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // Only close if clicking directly on the overlay, not its children
    if (e.target === e.currentTarget) {
      e.preventDefault()
      e.stopPropagation()
      onMobileClose()
    }
  }, [onMobileClose])

  const dashboardHref = role === "admin" 
    ? "/admin/dashboard" 
    : role === "student" 
      ? "/student/dashboard" 
      : "/teacher/dashboard"

  return (
    <TooltipProvider delayDuration={0}>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden cursor-pointer"
          onClick={handleOverlayClick}
          onTouchEnd={handleOverlayClick}
          aria-hidden="true"
        />
      )}
      
      <aside 
        className={cn(
          "fixed top-0 right-0 z-50 h-screen bg-sidebar border-l border-sidebar-border transition-transform duration-300 ease-in-out",
          // Desktop
          "lg:translate-x-0",
          collapsed ? "lg:w-[72px]" : "lg:w-64",
          // Mobile - hide by default (translate-x-full moves it off-screen to the right)
          "w-72",
          mobileOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header with Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
          {(!collapsed || mobileOpen) && (
            <Link 
              href={dashboardHref} 
              className="flex items-center gap-2 min-w-0"
              onClick={handleLinkClick}
            >
              <BrandLogo
                variant="symbol"
                className="h-9 w-auto max-w-[148px] sm:max-w-[168px]"
                priority
              />
            </Link>
          )}
          {collapsed && !mobileOpen && (
            <div className="flex flex-1 justify-center lg:justify-center min-w-0">
              <Link
                href={dashboardHref}
                onClick={handleLinkClick}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-1"
                aria-label="الرئيسية"
              >
                <BrandLogo variant="symbol" className="h-8 w-8" />
              </Link>
            </div>
          )}

          {/* Mobile Close Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClose}
            onTouchEnd={handleClose}
            className="lg:hidden h-11 w-11 min-h-[44px] min-w-[44px] touch-manipulation"
            aria-label="إغلاق القائمة"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 h-[calc(100vh-8rem)]">
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = iconMap[item.icon]
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
              
              // Desktop collapsed view with tooltips
              if (collapsed && !mobileOpen) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        onClick={handleLinkClick}
                        className={cn(
                          "flex items-center justify-center h-10 w-10 mx-auto rounded-lg transition-all duration-200",
                          isActive 
                            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm" 
                            : "text-sidebar-foreground hover:bg-sidebar-accent/10"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                )
              }
              
              // Full width navigation
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={handleLinkClick}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                    isActive 
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm" 
                      : "text-sidebar-foreground hover:bg-sidebar-accent/10"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </ScrollArea>

        {/* Collapse Toggle - Desktop only */}
        <div className="absolute bottom-4 left-0 right-0 px-3 hidden lg:block">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCollapsedChange(!collapsed)}
            className={cn(
              "w-full justify-center",
              collapsed && "px-0"
            )}
          >
            {collapsed ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <>
                <ChevronRight className="h-4 w-4 ml-2" />
                <span>تصغير</span>
              </>
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  )
}
