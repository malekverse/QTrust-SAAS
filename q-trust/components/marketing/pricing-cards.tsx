import Link from "next/link"
import { Check } from "lucide-react"
import { Reveal } from "./reveal"
import { PRICING_TIERS } from "./content"

// §6.4 tier cards. Premium is elevated with a gold hairline crown — gold as a
// thin accent only, never a fill (§8.2.1 #4). `teaser` shows the short form
// (landing); full feature lists live on /pricing.
export function PricingCards({ teaser = false }: { teaser?: boolean }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
      {PRICING_TIERS.map((tier, i) => (
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
                  الأكثر اكتمالًا
                </span>
              )}
            </div>

            <div className="mt-5 space-y-1">
              <p className="text-2xl font-bold">{tier.annual}</p>
              <p className="text-sm text-foreground/60">
                رسوم تركيب {tier.setup} · {tier.cap}
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
                href={teaser ? "/pricing" : "/demo"}
                className={`mk-btn w-full text-sm ${tier.highlight ? "mk-btn-primary" : "mk-btn-ghost"}`}
              >
                {teaser ? "تفاصيل الباقة" : "تواصل مع المبيعات"}
              </Link>
            </div>
          </article>
        </Reveal>
      ))}
    </div>
  )
}
