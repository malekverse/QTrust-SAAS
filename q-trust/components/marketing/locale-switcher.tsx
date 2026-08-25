"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { MarketingLocale } from "./i18n"

const LOCALES: { code: MarketingLocale; label: string; full: string }[] = [
  { code: "ar", label: "ع", full: "العربية" },
  { code: "fr", label: "FR", full: "Français" },
  { code: "en", label: "EN", full: "English" },
]

// Strip any locale prefix so the current page is preserved when switching
// (e.g. /fr/pricing → /pricing, /en → /). The Arabic pages live at the root.
function stripLocale(path: string): string {
  if (path === "/fr" || path.startsWith("/fr/")) return path.slice(3) || "/"
  if (path === "/en" || path.startsWith("/en/")) return path.slice(3) || "/"
  return path || "/"
}

// `?hl=` tells the proxy this is an explicit language pick: it persists the
// choice in the locale cookie (so it survives future visits and geo-detection
// never overrides it) and redirects to the clean URL.
function hrefFor(code: MarketingLocale, bare: string): string {
  if (code === "ar") return `${bare}?hl=ar`
  const suffix = bare === "/" ? "" : bare
  return `/${code}${suffix}?hl=${code}`
}

export function LocaleSwitcher({
  current,
  className = "",
}: {
  current: MarketingLocale
  className?: string
}) {
  const pathname = usePathname() || "/"
  const bare = stripLocale(pathname)

  return (
    <div className={`flex items-center gap-1.5 ${className}`} role="group" aria-label="Language">
      {LOCALES.map((l, i) => (
        <span key={l.code} className="flex items-center gap-1.5">
          {i > 0 && (
            <span className="text-foreground/25" aria-hidden="true">·</span>
          )}
          {l.code === current ? (
            <span className="text-xs font-bold text-primary" aria-current="true">
              {l.label}
            </span>
          ) : (
            <Link
              href={hrefFor(l.code, bare)}
              prefetch={false}
              hrefLang={l.code}
              aria-label={l.full}
              className="mk-nav-link text-xs font-semibold"
            >
              {l.label}
            </Link>
          )}
        </span>
      ))}
    </div>
  )
}
