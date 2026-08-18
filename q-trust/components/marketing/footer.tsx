import Link from "next/link"
import { BrandLogo } from "@/components/brand-logo"
import { UI_LABELS } from "./i18n"
import type { MarketingLocale } from "./i18n"
import { LocaleSwitcher } from "./locale-switcher"

function prefixHref(href: string, locale: MarketingLocale) {
  if (locale === "fr") return `/fr${href}`
  if (locale === "en") return `/en${href}`
  return href
}

export function MarketingFooter({ locale = "ar" }: { locale?: MarketingLocale }) {
  const t = UI_LABELS[locale]

  const PRODUCT_LINKS = [
    { href: prefixHref("/features", locale), label: t.features },
    { href: prefixHref("/pricing", locale), label: t.pricing },
    { href: prefixHref("/demo", locale), label: t.bookDemo },
  ]

  const COMPANY_LINKS = [
    { href: prefixHref("/about", locale), label: t.about },
    { href: prefixHref("/contact", locale), label: t.contact },
  ]

  const TRUST_LINKS = [
    { href: prefixHref("/privacy", locale), label: t.privacy },
    { href: prefixHref("/terms", locale), label: t.terms },
  ]

  return (
    <footer className="border-t border-foreground/8">
      <div className="mk-container py-14">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <BrandLogo variant="symbol" className="h-9 w-9" />
              <span className="mk-display text-lg font-bold" dir="ltr">Q-Trust</span>
            </div>
            <p className="mk-body text-sm max-w-[36ch]">
              {t.tagline}
            </p>
          </div>

          <nav aria-label={t.product} className="space-y-3">
            <p className="text-sm font-semibold">{t.product}</p>
            <ul className="space-y-2">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="mk-nav-link text-sm">{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={t.company} className="space-y-3">
            <p className="text-sm font-semibold">{t.company}</p>
            <ul className="space-y-2">
              {COMPANY_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="mk-nav-link text-sm">{l.label}</Link>
                </li>
              ))}
              <li>
                <Link href="/auth/login" className="mk-nav-link text-sm">{t.login}</Link>
              </li>
            </ul>
          </nav>

          <nav aria-label={t.trustAndPrivacy} className="space-y-3">
            <p className="text-sm font-semibold">{t.trustAndPrivacy}</p>
            <ul className="space-y-2">
              {TRUST_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="mk-nav-link text-sm">{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mk-hairline-gold mt-12 pt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-foreground/50">
          <p>&copy; {new Date().getFullYear()} Q-Trust. {t.copyright}</p>
          <LocaleSwitcher current={locale} />
          <p dir="ltr">{t.madeIn}</p>
        </div>
      </div>
    </footer>
  )
}
