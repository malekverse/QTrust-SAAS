"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { BrandLogo } from "@/components/brand-logo"
import { Menu, X, Sun, Moon } from "lucide-react"
import { UI_LABELS } from "./i18n"
import type { MarketingLocale } from "./i18n"
import { LocaleSwitcher } from "./locale-switcher"

function prefixHref(href: string, locale: MarketingLocale) {
  if (locale === "fr") return `/fr${href}`
  if (locale === "en") return `/en${href}`
  return href
}

function ThemeToggle({ label }: { label: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <button
      type="button"
      className="mk-nav-link flex items-center justify-center rounded-md p-1.5"
      aria-label={label}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {mounted ? (
        resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  )
}

export function MarketingNav({ locale = "ar" }: { locale?: MarketingLocale }) {
  const t = UI_LABELS[locale]
  const ctaArrow = locale === "ar" ? "←" : "→"
  const themeLabel = locale === "ar" ? "تبديل المظهر" : locale === "fr" ? "Changer le thème" : "Toggle theme"

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

  const LINKS = [
    { href: prefixHref("/features", locale), label: t.features },
    { href: prefixHref("/pricing", locale), label: t.pricing },
    { href: prefixHref("/contact", locale), label: t.contact },
  ]

  return (
    <header className={`mk-nav ${scrolled || open ? "mk-nav--scrolled" : ""}`}>
      <div className="mk-container">
        <div className="mk-nav-inner flex items-center gap-6">
          <Link href={prefixHref("/", locale)} className="flex items-center gap-2.5 shrink-0" aria-label={t.homeLabel}>
            <BrandLogo variant="symbol" className="h-9 w-9" priority sizes="36px" />
            <span className="mk-display text-lg font-bold" dir="ltr">Q-Trust</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6" aria-label={locale === "ar" ? "التنقل الرئيسي" : locale === "fr" ? "Navigation principale" : "Main navigation"}>
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="mk-nav-link">
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="ms-auto hidden md:flex items-center gap-4">
            <div className="flex items-center gap-3 border-e border-foreground/10 pe-4">
              <LocaleSwitcher current={locale} />
              <ThemeToggle label={themeLabel} />
            </div>
            <Link href="/auth/login" className="mk-nav-link">
              {t.login}
            </Link>
            <Link href={prefixHref("/demo", locale)} className="mk-btn mk-btn-primary !px-5 !py-2.5 text-sm">
              {t.bookDemo} {ctaArrow}
            </Link>
          </div>

          <button
            type="button"
            className="ms-auto md:hidden p-2 -me-2"
            aria-expanded={open}
            aria-label={open ? t.closeMenu : t.openMenu}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open && (
          <nav
            className="md:hidden pb-5 pt-1 flex flex-col gap-1 border-t border-foreground/8"
            aria-label={locale === "ar" ? "التنقل الرئيسي" : locale === "fr" ? "Navigation principale" : "Main navigation"}
          >
            <div className="flex items-center gap-3 py-2.5">
              <LocaleSwitcher current={locale} />
              <ThemeToggle label={themeLabel} />
            </div>
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="mk-nav-link py-2.5 text-base">
                {l.label}
              </Link>
            ))}
            <Link href="/auth/login" className="mk-nav-link py-2.5 text-base">
              {t.login}
            </Link>
            <Link href={prefixHref("/demo", locale)} className="mk-btn mk-btn-primary mt-3 text-sm self-start !px-5 !py-2.5">
              {t.bookDemo} {ctaArrow}
            </Link>
          </nav>
        )}
      </div>
    </header>
  )
}
