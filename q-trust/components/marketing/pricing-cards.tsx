import Link from "next/link"
import { Check } from "lucide-react"
import { Reveal } from "./reveal"
import { PRICING_TIERS } from "./content"
import { PRICING_TIERS as PRICING_TIERS_FR } from "./content.fr"
import type { MarketingLocale } from "./i18n"

export function PricingCards({ teaser = false, locale = "ar" }: { teaser?: boolean; locale?: MarketingLocale }) {
  const tiers = locale === "fr" ? PRICING_TIERS_FR : PRICING_TIERS
  const prefix = locale === "fr" ? "/fr" : ""
  const ctaTeaser = locale === "fr" ? "Détails du forfait" : "تفاصيل الباقة"
  const ctaFull = locale === "fr" ? "Contactez les ventes" : "تواصل مع المبيعات"
  const badge = locale === "fr" ? "Le plus complet" : "الأكثر اكتمالًا"
  return (
    <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
      {tiers.map((tier, i) => (
        <Reveal key={tier.key} delay={i * 80} className="h-full">
          <article
            className={`mk-card mk-card--lift flex h-full flex-col p-7 ${
              tier.highlight ? "border-t-2 !border-t-secondary lg:-translate-y-2" : ""
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="mk-display text-xl font-bold">{tier.name}</h3>
              {tier.highlight && (
                <span className="text-xs font-semibold text-secondary-foreground/70 bg-secondary/25 rounded-full px-3 py-1">
                  {badge}
                </span>
              )}
            </div>

            <div className="mt-5 space-y-1">
              <p className="text-2xl font-bold">{tier.annual}</p>
              <p className="text-sm text-foreground/60">
                {locale === "fr" ? `Installation ${tier.setup} · ${tier.cap}` : `رسوم تركيب ${tier.setup} · ${tier.cap}`}
              </p>
            </div>

            {!teaser && (
              <ul className="mt-6 space-y-2.5 text-sm">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="mk-body">{f}</span>
                  </li>
                ))}
              </ul>
            )}
            {teaser && <p className="mk-body mt-5 text-sm">{tier.unlocks}</p>}

            <div className="mt-auto pt-7">
              <Link
                href={teaser ? `${prefix}/pricing` : `${prefix}/demo`}
                className={`mk-btn w-full text-sm ${tier.highlight ? "mk-btn-primary" : "mk-btn-ghost"}`}
              >
                {teaser ? ctaTeaser : ctaFull}
              </Link>
            </div>
          </article>
        </Reveal>
      ))}
    </div>
  )
}
