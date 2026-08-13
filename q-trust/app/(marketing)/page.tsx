import type { Metadata } from "next"
import Link from "next/link"
import { QrCode, Eye, BookOpenCheck } from "lucide-react"
import { Reveal } from "@/components/marketing/reveal"
import { CountUp } from "@/components/marketing/count-up"
import { BrowserFrame, ScreenshotSlot } from "@/components/marketing/frames"
import { ProductTour } from "@/components/marketing/product-tour"
import { AiChatDemo } from "@/components/marketing/ai-spotlight"
import { ScanDemo } from "@/components/marketing/scan-demo"
import { PricingCards } from "@/components/marketing/pricing-cards"
import {
  HERO,
  PILLARS,
  PROOF_STATS,
  FOUNDING_ASSOCIATION,
  TESTIMONIAL,
  AI_SPOTLIGHT,
  SCANNER,
  FINAL_CTA,
  SHOTS,
} from "@/components/marketing/content"

export const metadata: Metadata = {
  title: "Q-Trust — استبدل دفاتر الحضور الورقية بنظام رقمي متكامل",
  description:
    "منصة إدارة جمعيات ومدارس تحفيظ القرآن: حضور بمسح QR، متابعة المدفوعات، بوابة الطالب والوليّ، ومساعد ذكي بالعربية.",
}

const PILLAR_ICONS = {
  qr: QrCode,
  eye: Eye,
  ledger: BookOpenCheck,
} as const

export default function LandingPage() {
  return (
    <>
      {/* ── 2. Hero — full viewport, calm (§8.2.2 #2) ── */}
      <section className="mk-pattern text-primary">
        <div className="mk-container text-foreground">
          <div className="flex min-h-[92svh] flex-col items-center justify-center pt-24 pb-10 text-center">
            <h1 className="mk-display mk-h1 max-w-[18ch]">
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
              className="mk-lead mk-hero-line mt-7 max-w-[52ch]"
              style={{ "--mk-line": 2.2 } as React.CSSProperties}
            >
              {HERO.subhead}
            </p>
            <div
              className="mk-hero-line mt-10 flex flex-wrap items-center justify-center gap-3.5"
              style={{ "--mk-line": 3 } as React.CSSProperties}
            >
              <Link href="/demo" className="mk-btn mk-btn-primary">
                {HERO.ctaPrimary}
                <span className="mk-btn-arrow" aria-hidden="true">←</span>
              </Link>
              <a href="#tour" className="mk-btn mk-btn-ghost">
                {HERO.ctaSecondary}
              </a>
            </div>

            {/* Beneath the fold-line: the real dashboard in a browser frame,
                fade + rise on load, extremely slow drift on scroll. */}
            <div
              className="mk-hero-line mk-hero-drift mt-16 w-full max-w-4xl"
              style={{ "--mk-line": 4 } as React.CSSProperties}
            >
              <BrowserFrame>
                <ScreenshotSlot
                  src={SHOTS.dashboard || undefined}
                  alt="لوحة تحكم Q-Trust — نظرة عامة على الحضور والحصص"
                  priority
                  sizes="(max-width: 896px) 100vw, 896px"
                />
              </BrowserFrame>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Proof strip — renders ONLY with verifiably real numbers (§8.2.7) ── */}
      {(PROOF_STATS || FOUNDING_ASSOCIATION) && (
        <section className="border-y border-foreground/8 bg-foreground/2">
          <div className="mk-container">
            <div className="flex flex-wrap items-center justify-center gap-x-14 gap-y-6 py-10">
              {PROOF_STATS?.map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="mk-display text-3xl font-bold text-primary">
                    <CountUp value={stat.value} suffix={stat.suffix} />
                  </p>
                  <p className="mt-1 text-sm text-foreground/60">{stat.label}</p>
                </div>
              ))}
              {FOUNDING_ASSOCIATION && (
                <p className="text-sm text-foreground/60">
                  موثوق من <span className="font-semibold text-foreground">{FOUNDING_ASSOCIATION.name}</span>
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── 4. Product tour — the centerpiece (§8.2.2 #4) ── */}
      <section id="tour" className="mk-section">
        <div className="mk-container">
          <Reveal className="mb-14 max-w-[40ch]">
            <p className="mk-eyebrow mb-3">جولة في المنصة</p>
            <h2 className="mk-display mk-h2">ثلاث لحظات تختصر يوم الجمعية</h2>
          </Reveal>
          <ProductTour />
        </div>
      </section>

      {/* ── 5. Three pillars — the director's pain points (§8.2.2 #5) ── */}
      <section className="mk-section pt-0">
        <div className="mk-container">
          <Reveal className="mb-12 max-w-[42ch]">
            <p className="mk-eyebrow mb-3">لماذا Q-Trust؟</p>
            <h2 className="mk-display mk-h2">مصمّم حول ثلاث أوجاع يعرفها كل مدير جمعية</h2>
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

      {/* ── 6. AI spotlight — the one dark section (§8.2.2 #6) ── */}
      <section className="dark mk-dark-section mk-section">
        <div className="mk-container">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <Reveal>
              <p className="mk-eyebrow mb-3">{AI_SPOTLIGHT.eyebrow}</p>
              <h2 className="mk-display mk-h2 max-w-[16ch]">{AI_SPOTLIGHT.title}</h2>
              <p className="mk-body mt-5 max-w-[48ch]">{AI_SPOTLIGHT.body}</p>
            </Reveal>
            <Reveal delay={120}>
              <AiChatDemo />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 7. Scanner & QR cards — split layout (§8.2.2 #7) ── */}
      <section className="mk-section">
        <div className="mk-container">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <Reveal className="order-2 lg:order-1">
              <ScanDemo />
            </Reveal>
            <Reveal className="order-1 lg:order-2" delay={80}>
              <p className="mk-eyebrow mb-3">{SCANNER.eyebrow}</p>
              <h2 className="mk-display mk-h2 max-w-[18ch]">{SCANNER.title}</h2>
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

      {/* ── 8. Pricing teaser (§8.2.2 #8) ── */}
      <section className="mk-section pt-0">
        <div className="mk-container">
          <Reveal className="mb-12 max-w-[42ch]">
            <p className="mk-eyebrow mb-3">الأسعار</p>
            <h2 className="mk-display mk-h2">باقة على قدر جمعيتك</h2>
            <p className="mk-lead mt-4">
              أسعار سنوية واضحة بالدينار التونسي، والدفع بالتحويل أو الشيك أو نقدًا.
            </p>
          </Reveal>
          <PricingCards teaser />
          <Reveal className="mt-8 text-center">
            <Link href="/pricing" className="mk-nav-link text-sm underline underline-offset-4">
              قارن الباقات بالتفصيل ←
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── 9. Testimonial — one real quote or nothing (§8.2.7) ── */}
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

      {/* ── 10. Final CTA (§8.2.2 #10) ── */}
      <section className="mk-cta-band mk-pattern">
        <div className="mk-container">
          <div className="flex flex-col items-center gap-7 py-24 text-center sm:py-28">
            <Reveal>
              <h2 className="mk-display mk-h2 max-w-[22ch]">{FINAL_CTA.title}</h2>
            </Reveal>
            <Reveal delay={80}>
              <p className="mk-lead max-w-[46ch] !text-primary-foreground/80">{FINAL_CTA.body}</p>
            </Reveal>
            <Reveal delay={160}>
              <Link
                href="/demo"
                className="mk-btn bg-white text-primary hover:bg-white/92 shadow-lg"
              >
                {FINAL_CTA.cta}
                <span className="mk-btn-arrow" aria-hidden="true">←</span>
              </Link>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  )
}
