"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { BrandLogo } from "@/components/brand-logo"
import { Menu, X } from "lucide-react"

const LINKS = [
  { href: "/features", label: "المميزات" },
  { href: "/pricing", label: "الأسعار" },
  { href: "/contact", label: "تواصل معنا" },
]

// Transparent over the hero → frosted-glass bar once scrolled (§8.2.2 #1).
export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <header className={`mk-nav ${scrolled || open ? "mk-nav--scrolled" : ""}`}>
      <div className="mk-container">
        <div className="mk-nav-inner flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="Q-Trust — الصفحة الرئيسية">
            <BrandLogo variant="symbol" className="h-9 w-9" />
            <span className="mk-display text-lg font-bold" dir="ltr">Q-Trust</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6" aria-label="التنقل الرئيسي">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="mk-nav-link">
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="ms-auto hidden md:flex items-center gap-5">
            <Link href="/auth/login" className="mk-nav-link">
              تسجيل الدخول
            </Link>
            <Link href="/demo" className="mk-btn mk-btn-primary !px-5 !py-2.5 text-sm">
              احجز عرضًا تجريبيًا
            </Link>
          </div>

          <button
            type="button"
            className="ms-auto md:hidden p-2 -me-2"
            aria-expanded={open}
            aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open && (
          <nav
            className="md:hidden pb-5 pt-1 flex flex-col gap-1 border-t border-foreground/8"
            aria-label="التنقل الرئيسي"
          >
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="mk-nav-link py-2.5 text-base">
                {l.label}
              </Link>
            ))}
            <Link href="/auth/login" className="mk-nav-link py-2.5 text-base">
              تسجيل الدخول
            </Link>
            <Link href="/demo" className="mk-btn mk-btn-primary mt-3 text-sm self-start !px-5 !py-2.5">
              احجز عرضًا تجريبيًا
            </Link>
          </nav>
        )}
      </div>
    </header>
  )
}
