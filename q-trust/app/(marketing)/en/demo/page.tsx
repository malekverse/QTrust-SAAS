import type { Metadata } from "next"
import { Reveal } from "@/components/marketing/reveal"
import { DemoForm } from "./demo-form"

export const metadata: Metadata = {
  title: "Book a demo",
  description:
    "Book a live Q-Trust demo — we show you QR attendance, payments, and reports with sample data, on-site or remotely.",
}

const STEPS = [
  { n: "1", text: "Fill out the form — we receive your request instantly." },
  { n: "2", text: "We call you within one business day to understand your needs and schedule a meeting." },
  { n: "3", text: "30-minute live demo with sample data — on-site or remote." },
]

export default function EnglishDemoPage() {
  return (
    <section className="pt-36 mk-section">
      <div className="mk-container">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <Reveal>
            <p className="mk-eyebrow mb-3">Demo</p>
            <h1 className="mk-display mk-h2 max-w-[18ch]">See your platform in action before you commit</h1>
            <p className="mk-lead mt-5 max-w-[48ch]">
              Live demonstration on sample data: QR attendance, the dashboard,
              and the payment ledger — ask all your questions.
            </p>
            <ol className="mt-9 space-y-4">
              {STEPS.map((s) => (
                <li key={s.n} className="flex items-start gap-3.5">
                  <span className="mk-display flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {s.n}
                  </span>
                  <p className="mk-body pt-1 text-sm">{s.text}</p>
                </li>
              ))}
            </ol>
          </Reveal>
          <Reveal delay={100}>
            <DemoForm />
          </Reveal>
        </div>
      </div>
    </section>
  )
}
