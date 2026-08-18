import type { Metadata } from "next"
import Link from "next/link"
import { Reveal } from "@/components/marketing/reveal"

export const metadata: Metadata = {
  title: "About",
  description:
    "Q-Trust is a Tunisian platform specialized in managing Quranic schools and associations — built around the needs of directors, teachers, and families.",
}

const VALUES = [
  {
    title: "Specialists in one domain",
    body: "We don't build a generic school software and then translate it — Q-Trust is designed from the first line around how Quranic schools and associations operate: sessions and halaqat, daily attendance, monthly fees, and the school's relationship with parents. This specialization is why the platform is simple to use.",
  },
  {
    title: "Arabic first, not an afterthought translation",
    body: "The platform is designed right-to-left and written in Arabic from the start — interfaces, reports, and even the AI assistant speaks Arabic. Because a school's tools should speak its language.",
  },
  {
    title: "Student data is a sacred trust",
    body: "We handle data of minors: names, photos, parent phone numbers. That's why each school is completely isolated from others, every sensitive operation is logged in an activity journal, and we never sell or share the data — see our privacy policy.",
  },
  {
    title: "A direct relationship, not support tickets",
    body: "The Q-Trust team installs the platform with you at your location, trains your staff, and stays reachable by phone. Our growth comes from school satisfaction and word-of-mouth recommendations — not signed-and-forgotten contracts. We're based in Ariana and travel across the country.",
  },
]

export default function EnglishAboutPage() {
  return (
    <>
      <section className="pt-36 pb-6">
        <div className="mk-container">
          <Reveal className="max-w-[50ch]">
            <p className="mk-eyebrow mb-3">About</p>
            <h1 className="mk-display mk-h2">A Tunisian platform specialized in Quranic school management</h1>
            <p className="mk-lead mt-5">
              Q-Trust centralizes attendance, payments, and tracking in a single system that
              respects how these institutions work — developed in Tunisia, in Arabic from
              the start.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="mk-section pt-12">
        <div className="mk-container">
          <div className="grid gap-x-14 gap-y-12 md:grid-cols-2">
            {VALUES.map((v, i) => (
              <Reveal key={v.title} delay={(i % 2) * 80}>
                <div className="mk-hairline-gold pt-6">
                  <h2 className="mk-display text-xl font-bold">{v.title}</h2>
                  <p className="mk-body mt-3 text-sm sm:text-base">{v.body}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-24 text-center">
            <h2 className="mk-display mk-h3">Want to see what we&apos;ve built?</h2>
            <Link href="/en/demo" className="mk-btn mk-btn-primary mt-7">
              Book a demo
              <span className="mk-btn-arrow" aria-hidden="true">→</span>
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  )
}
