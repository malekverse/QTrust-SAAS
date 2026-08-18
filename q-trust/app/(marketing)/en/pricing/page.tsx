import type { Metadata } from "next"
import Link from "next/link"
import { Reveal } from "@/components/marketing/reveal"
import { PricingCards } from "@/components/marketing/pricing-cards"

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Q-Trust plans for Quranic schools and associations: Starter, Professional, and Advanced — annual pricing in Tunisian Dinars with one-time setup fees.",
}

const NOTES = [
  {
    q: "How is payment handled?",
    a: "By bank transfer, check, or cash at installation — we issue an invoice for every transaction. No credit card required.",
  },
  {
    q: "Are the prices negotiable?",
    a: "The displayed amounts are indicative. The final offer is adjusted based on the school's size and needs during the initial consultation with our sales team.",
  },
  {
    q: "What are the student QR cards?",
    a: "PVC cards printed with your school's name and a unique QR ID for each student, handed out at installation — add-on service at 2.5–3.5 TND per card, available with all plans.",
  },
  {
    q: "Is there a trial period?",
    a: "Yes — the Starter plan works as a free 14-day trial, and we can also run a live demo with sample data before any commitment.",
  },
]

export default function EnglishPricingPage() {
  return (
    <>
      <section className="pt-36 pb-4">
        <div className="mk-container">
          <Reveal className="max-w-[50ch]">
            <p className="mk-eyebrow mb-3">Pricing</p>
            <h1 className="mk-display mk-h2">Clear pricing, paid once a year</h1>
            <p className="mk-lead mt-5">
              A one-time setup fee covers installation, training, and data migration,
              then an annual subscription based on the plan you choose.
              No surprises, no hidden fees.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="mk-section pt-12">
        <div className="mk-container">
          <PricingCards locale="en" />
        </div>
      </section>

      <section className="mk-section pt-0">
        <div className="mk-container">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
            <Reveal>
              <h2 className="mk-display mk-h3">Questions we hear at every visit</h2>
            </Reveal>
            <div className="space-y-8">
              {NOTES.map((n, i) => (
                <Reveal key={n.q} delay={i * 60}>
                  <div className="mk-hairline-gold pt-5">
                    <h3 className="font-semibold">{n.q}</h3>
                    <p className="mk-body mt-2 text-sm">{n.a}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          <Reveal className="mt-20 text-center">
            <div className="mk-card mx-auto max-w-2xl p-10">
              <h2 className="mk-display mk-h3">Not sure which plan is right for you?</h2>
              <p className="mk-body mt-3">
                Book a demo and we&apos;ll help you choose based on your student count and
                how your school operates.
              </p>
              <Link href="/en/demo" className="mk-btn mk-btn-primary mt-7">
                Contact sales
                <span className="mk-btn-arrow" aria-hidden="true">→</span>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
