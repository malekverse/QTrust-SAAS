import type { Metadata } from "next"
import Link from "next/link"
import { CalendarCheck, MessageCircle } from "lucide-react"
import { Reveal } from "@/components/marketing/reveal"

export const metadata: Metadata = {
  title: "Contact us",
  description: "Contact the Q-Trust team — book a demo or send your question, we'll get back to you within one business day.",
}

export default function EnglishContactPage() {
  return (
    <section className="pt-36 mk-section">
      <div className="mk-container">
        <Reveal className="max-w-[50ch]">
          <p className="mk-eyebrow mb-3">Contact us</p>
          <h1 className="mk-display mk-h2">We respond within one business day</h1>
          <p className="mk-lead mt-5">
            Whether you&apos;re discovering the platform for the first time or have a specific
            question — the quickest way is the demo request form, which reaches us directly.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 max-w-3xl">
          <Reveal>
            <Link href="/en/demo" className="mk-card mk-card--lift block h-full p-7">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CalendarCheck className="h-5.5 w-5.5" />
              </span>
              <h2 className="mk-display mt-5 text-xl font-bold">Book a demo</h2>
              <p className="mk-body mt-2 text-sm">
                30-minute live demo with sample data, on-site or remote.
                The best way to get started.
              </p>
            </Link>
          </Reveal>
          <Reveal delay={80}>
            <Link href="/en/demo" className="mk-card mk-card--lift block h-full p-7">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MessageCircle className="h-5.5 w-5.5" />
              </span>
              <h2 className="mk-display mt-5 text-xl font-bold">Question or inquiry</h2>
              <p className="mk-body mt-2 text-sm">
                Write your question in the notes field of the same form and we&apos;ll
                call you to answer it — pricing, data migration, or anything else.
              </p>
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
