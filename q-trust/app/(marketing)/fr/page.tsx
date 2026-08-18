import type { Metadata } from "next"
import Link from "next/link"
import { QrCode, Eye, BookOpenCheck, MapPin, ShieldCheck, CalendarClock, Handshake } from "lucide-react"
import { Reveal } from "@/components/marketing/reveal"
import { CountUp } from "@/components/marketing/count-up"
import { BrowserFrame, ScreenshotSlot } from "@/components/marketing/frames"
import { ProductTour } from "@/components/marketing/product-tour"
import { AiChatDemo } from "@/components/marketing/ai-spotlight"
import { ScanDemo } from "@/components/marketing/scan-demo"
import { PricingCards } from "@/components/marketing/pricing-cards"
import {
  PROOF_STATS,
  TRUSTED_BY,
  TESTIMONIAL,
  SHOTS,
} from "@/components/marketing/content"
import {
  HERO,
  PILLARS,
  TRUST_POINTS,
  TOUR_BEATS as TOUR_BEATS_FR,
  AI_SPOTLIGHT,
  SCANNER,
  FINAL_CTA,
} from "@/components/marketing/content.fr"

export const metadata: Metadata = {
  title: "Q-Trust — Remplacez les registres papier par un système numérique complet",
  description:
    "Plateforme de gestion des associations et écoles coraniques : présence par QR, suivi des paiements, portail élèves et parents, assistant IA en arabe.",
}

const PILLAR_ICONS = {
  qr: QrCode,
  eye: Eye,
  ledger: BookOpenCheck,
} as const

const TRUST_ICONS = {
  tunisia: MapPin,
  shield: ShieldCheck,
  trial: CalendarClock,
  onsite: Handshake,
} as const

export default function FrenchLandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="mk-pattern text-primary">
        <div className="mk-container text-foreground">
          <div className="flex min-h-[84svh] flex-col items-center justify-center pt-20 pb-8 text-center">
            <h1 className="mk-display mk-h1 max-w-[22ch]">
              {HERO.headlineLines.map((line, i) => (
                <span
                  key={line}
                  className="mk-hero-line"
                  style={{ "--mk-line": i } as React.CSSProperties}
                >
                  {line === HERO.goldPhrase ? (
                    <span className="mk-underline-gold">{line}</span>
                  ) : (
                    line
                  )}
                </span>
              ))}
            </h1>
            <p
              className="mk-lead mk-hero-line mt-7 max-w-[56ch]"
              style={{ "--mk-line": 2.2 } as React.CSSProperties}
            >
              {HERO.subhead}
            </p>
            <div
              className="mk-hero-line mt-10 !flex flex-wrap items-center justify-center gap-5"
              style={{ "--mk-line": 3 } as React.CSSProperties}
            >
              <Link href="/fr/demo" className="mk-btn mk-btn-primary">
                {HERO.ctaPrimary}
                <span className="mk-btn-arrow" aria-hidden="true">→</span>
              </Link>
              <a href="#tour" className="mk-btn mk-btn-ghost">
                {HERO.ctaSecondary}
              </a>
            </div>

            <div
              className="mk-hero-line mk-hero-drift mt-10 w-full max-w-4xl"
              style={{ "--mk-line": 4 } as React.CSSProperties}
            >
              <BrowserFrame>
                <ScreenshotSlot
                  src={SHOTS.dashboard || undefined}
                  alt="Tableau de bord Q-Trust — vue d'ensemble de la présence et des sessions"
                  priority
                  sizes="(max-width: 896px) 100vw, 896px"
                  label="Capture d'écran réelle de la plateforme"
                />
              </BrowserFrame>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-foreground/8 bg-foreground/2">
        <div className="mk-container">
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-5 py-9">
            {PROOF_STATS
              ? PROOF_STATS.map((stat) => (
                  <div key={stat.label} className="text-center">
                    <p className="mk-display text-3xl font-bold text-primary">
                      <CountUp value={stat.value} suffix={stat.suffix} />
                    </p>
                    <p className="mt-1 text-sm text-foreground/60">{stat.label}</p>
                  </div>
                ))
              : TRUST_POINTS.map((point) => {
                  const Icon = TRUST_ICONS[point.icon]
                  return (
                    <div key={point.icon} className="flex items-center gap-2.5 text-sm text-foreground/70">
                      <Icon className="h-4.5 w-4.5 text-primary" aria-hidden="true" />
                      {point.text}
                    </div>
                  )
                })}
            {TRUSTED_BY && (
              <p className="text-sm text-foreground/60">
                Adopté par <span className="font-semibold text-foreground">{TRUSTED_BY.name}</span>
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Product tour */}
      <section id="tour" className="mk-section">
        <div className="mk-container">
          <Reveal className="mb-14 max-w-[40ch]">
            <p className="mk-eyebrow mb-3">Visite guidée</p>
            <h2 className="mk-display mk-h2">Trois moments qui résument la journée</h2>
          </Reveal>
          <ProductTour beats={TOUR_BEATS_FR} />
        </div>
      </section>

      {/* Three pillars */}
      <section className="mk-section pt-0">
        <div className="mk-container">
          <Reveal className="mb-12 max-w-[42ch]">
            <p className="mk-eyebrow mb-3">Pourquoi Q-Trust ?</p>
            <h2 className="mk-display mk-h2">Conçu autour de trois problèmes que chaque directeur connaît</h2>
          </Reveal>
          <div className="grid gap-6 md:grid-cols-3">
            {PILLARS.map((pillar, i) => {
              const Icon = PILLAR_ICONS[pillar.icon]
              return (
                <Reveal key={pillar.title} delay={i * 80}>
                  <article className="mk-card mk-card--lift h-full p-7">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5.5 w-5.5" />
                    </span>
                    <h3 className="mk-display mt-5 text-xl font-bold">{pillar.title}</h3>
                    <p className="mk-body mt-3 text-sm">{pillar.body}</p>
                  </article>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* AI spotlight (dark section) */}
      <section className="dark mk-dark-section mk-section mk-pattern">
        <div className="mk-container">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <Reveal>
              <p className="mk-eyebrow mb-3">{AI_SPOTLIGHT.eyebrow}</p>
              <h2 className="mk-display mk-h2 max-w-[18ch]">{AI_SPOTLIGHT.title}</h2>
              <p className="mk-body mt-5 max-w-[48ch]">{AI_SPOTLIGHT.body}</p>
            </Reveal>
            <Reveal delay={120}>
              <AiChatDemo />
            </Reveal>
          </div>
        </div>
      </section>

      {/* Scanner & QR */}
      <section className="mk-section">
        <div className="mk-container">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <Reveal>
              <ScanDemo />
            </Reveal>
            <Reveal delay={80}>
              <p className="mk-eyebrow mb-3">{SCANNER.eyebrow}</p>
              <h2 className="mk-display mk-h2 max-w-[20ch]">{SCANNER.title}</h2>
              <p className="mk-body mt-5 max-w-[48ch]">{SCANNER.body}</p>
              <ul className="mt-6 space-y-2.5">
                {SCANNER.bullets.map((b) => (
                  <li key={b} className="mk-body flex items-start gap-2.5 text-sm">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" aria-hidden="true" />
                    {b}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="mk-section pt-0">
        <div className="mk-container">
          <Reveal className="mb-12 max-w-[42ch]">
            <p className="mk-eyebrow mb-3">Tarifs</p>
            <h2 className="mk-display mk-h2">Un forfait à la mesure de votre association</h2>
            <p className="mk-lead mt-4">
              Tarifs annuels clairs en dinars tunisiens, payables par virement, chèque ou espèces.
            </p>
          </Reveal>
          <PricingCards teaser locale="fr" />
          <Reveal className="mt-8 text-center">
            <Link href="/fr/pricing" className="mk-nav-link text-sm underline underline-offset-4">
              Comparer les forfaits en détail →
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Testimonial */}
      {TESTIMONIAL && (
        <section className="mk-section pt-0">
          <div className="mk-container">
            <Reveal className="mx-auto max-w-3xl text-center">
              <blockquote className="mk-display mk-h3 leading-relaxed">
                «{TESTIMONIAL.quote}»
              </blockquote>
              <p className="mt-6 text-sm text-foreground/60">
                {TESTIMONIAL.name} — {TESTIMONIAL.role}
              </p>
            </Reveal>
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section className="mk-cta-band mk-pattern">
        <div className="mk-container">
          <div className="flex flex-col items-center gap-7 py-24 text-center sm:py-28">
            <Reveal>
              <h2 className="mk-display mk-h2 max-w-[26ch]">{FINAL_CTA.title}</h2>
            </Reveal>
            <Reveal delay={80}>
              <p className="mk-lead max-w-[50ch] !text-primary-foreground/80">{FINAL_CTA.body}</p>
            </Reveal>
            <Reveal delay={160}>
              <Link
                href="/fr/demo"
                className="mk-btn bg-white text-primary hover:bg-white/92 shadow-lg"
              >
                {FINAL_CTA.cta}
                <span className="mk-btn-arrow" aria-hidden="true">→</span>
              </Link>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  )
}
