"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOut, User, Settings, Moon, Sun, Menu } from "lucide-react"
import { useTheme } from "next-themes"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { NotificationBell } from "@/components/layout/notification-bell"
import { LanguageSwitcher } from "@/components/ui/language-switcher"

interface NavbarProps {
  onMenuClick?: () => void
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()
  const t = useTranslations("navbar")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // One-time mount guard to avoid an SSR/client hydration mismatch on the
    // session-dependent user menu.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  // Handle menu click with event stopping
  const handleMenuClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onMenuClick?.()
  }, [onMenuClick])

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
  }

  const handleSignOut = () => {
    signOut({ callbackUrl: "/auth/login" })
  }

  const settingsHref = session?.user?.role === "ADMIN" 
    ? "/admin/settings" 
    : session?.user?.role === "STUDENT"
      ? "/student/settings"
      : "/teacher/settings"

  return (
    <header 
      className="sticky top-0 z-30 w-full h-14 sm:h-16 bg-background border-b border-border transition-all duration-300"
    >
      <div className="flex h-full items-center justify-between px-3 sm:px-6">
        {/* Left side - Mobile Menu Button */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Mobile Menu Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleMenuClick}
            onTouchEnd={handleMenuClick}
            className="lg:hidden h-11 w-11 min-h-[44px] min-w-[44px] touch-manipulation"
            aria-label={t("openMenu")}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        {/* Right side - User actions */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="h-8 w-8 sm:h-9 sm:w-9"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">{t("toggleTheme")}</span>
          </Button>

          {/* Language Switcher */}
          <LanguageSwitcher />

          {/* Notifications */}
          <NotificationBell />

          {/* User Menu - Only render after mount to avoid hydration mismatch */}
          {mounted ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 sm:h-9 sm:w-9 rounded-full">
                  <Avatar className="h-8 w-8 sm:h-9 sm:w-9">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs sm:text-sm">
                      {session?.user?.fullName ? getInitials(session.user.fullName) : "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="start" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1 text-right">
                    <p className="text-sm font-medium leading-none">
                      {session?.user?.fullName}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {session?.user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={settingsHref} className="flex items-center cursor-pointer">
                    <User className="ml-2 h-4 w-4" />
                    <span>{t("profile")}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={settingsHref} className="flex items-center cursor-pointer">
                    <Settings className="ml-2 h-4 w-4" />
                    <span>{t("settings")}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleSignOut}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <LogOut className="ml-2 h-4 w-4" />
                  <span>{t("logout")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="ghost" className="relative h-8 w-8 sm:h-9 sm:w-9 rounded-full">
              <Avatar className="h-8 w-8 sm:h-9 sm:w-9">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs sm:text-sm">
                  {session?.user?.fullName ? getInitials(session.user.fullName) : "U"}
                </AvatarFallback>
              </Avatar>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
