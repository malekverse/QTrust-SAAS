import type { Metadata } from "next"
import Link from "next/link"
import { Reveal } from "@/components/marketing/reveal"
import { BrowserFrame, ScreenshotSlot } from "@/components/marketing/frames"
import { ScanDemo } from "@/components/marketing/scan-demo"
import { ProductVideo } from "@/components/marketing/product-video"
import { SHOTS, AI_VIDEO, QR_VIDEO } from "@/components/marketing/content"

export const metadata: Metadata = {
  title: "Features",
  description:
    "All Q-Trust capabilities in detail: QR attendance, dashboard and reports, payment ledger, student and parent portal, Arabic AI assistant.",
}

const SECTIONS = [
  {
    key: "qr",
    eyebrow: "Attendance",
    title: "One QR scan records attendance in a second",
    body: "Each student has a card with a unique QR ID. At the classroom door, they hold it to the camera — tablet or supervisor's browser — and their attendance is instantly recorded in the correct session, with a configurable time window set by the school. Latecomers are marked late, absentees appear automatically — no manual entry required.",
    shot: "qrCheckin" as const,
  },
  {
    key: "dashboard",
    eyebrow: "Dashboard",
    title: "Today's numbers at a glance, in real time",
    body: "Today's sessions, attendance rate, absences, pending claims, and fee status — on a single screen updated live. Weekly and monthly reports ready to present to the board, with no manual compilation.",
    shot: "dashboard" as const,
  },
  {
    key: "payments",
    eyebrow: "Payments",
    title: "A fee ledger where no one falls through the cracks",
    body: "Each student's monthly fee: paid or overdue, in one click or via bulk operation. CSV export ready for accounting, plus a history showing who recorded each transaction and when — full transparency for families and the board.",
    shot: "ledger" as const,
  },
  {
    key: "portal",
    eyebrow: "Student & parent portal",
    title: "Every family follows their child's journey",
    body: "One account per student showing attendance, sessions, educational documents, and results. Parents check from their phone without having to ask anyone — and the school earns family trust through daily transparency.",
    shot: "dashboard" as const,
  },
]

export default function EnglishFeaturesPage() {
  return (
    <>
      <section className="pt-36 pb-6">
        <div className="mk-container">
          <Reveal className="max-w-[50ch]">
            <p className="mk-eyebrow mb-3">Features</p>
            <h1 className="mk-display mk-h2">One platform to manage the entire day</h1>
            <p className="mk-lead mt-5">
              From student arrival to end-of-month reports — every feature is built
              around how Quranic schools actually work, in Arabic and right-to-left.
            </p>
          </Reveal>
        </div>
      </section>

      {SECTIONS.map((s, i) => (
        <section key={s.key} className="mk-section pt-10">
          <div className="mk-container">
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
              <Reveal className={i % 2 === 1 ? "lg:order-2" : ""}>
                <p className="mk-eyebrow mb-3">{s.eyebrow}</p>
                <h2 className="mk-display mk-h3 max-w-[24ch]">{s.title}</h2>
                <p className="mk-body mt-4 max-w-[52ch] text-sm sm:text-base">{s.body}</p>
              </Reveal>
              <Reveal delay={80} className={i % 2 === 1 ? "lg:order-1" : ""}>
                <BrowserFrame>
                  {s.key === "qr" ? (
                    <ProductVideo
                      src={QR_VIDEO.src}
                      poster={QR_VIDEO.poster}
                      label="Real platform recording: QR check-in screen"
                    />
                  ) : (
                    <ScreenshotSlot
                      src={SHOTS[s.shot] || undefined}
                      alt={s.title}
                      label="Real platform screenshot"
                    />
                  )}
                </BrowserFrame>
              </Reveal>
            </div>
          </div>
        </section>
      ))}

      {/* Scanner app */}
      <section className="mk-section pt-10">
        <div className="mk-container">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <Reveal>
              <p className="mk-eyebrow mb-3">Scanner app</p>
              <h2 className="mk-display mk-h3 max-w-[24ch]">A tablet at the entrance handles arrivals on its own</h2>
              <p className="mk-body mt-4 max-w-[52ch] text-sm sm:text-base">
                A dedicated app pairs with your school&apos;s account and runs in kiosk mode on a
                tablet at the classroom door. The student holds up their card and sees a green
                confirmation signal — the teacher starts the session on time instead of taking roll.
                (Available from the Professional plan)
              </p>
            </Reveal>
            <Reveal delay={80}>
              <ScanDemo />
            </Reveal>
          </div>
        </div>
      </section>

      {/* AI assistant */}
      <section className="dark mk-dark-section mk-section">
        <div className="mk-container">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <Reveal>
              <p className="mk-eyebrow mb-3">AI assistant — Advanced plan</p>
              <h2 className="mk-display mk-h3 max-w-[24ch]">An admin assistant that understands Arabic and asks for your approval</h2>
              <p className="mk-body mt-4 max-w-[52ch] text-sm sm:text-base">
                &ldquo;How many students were absent this week?&rdquo; — it answers instantly from
                your data. &ldquo;Record Ahmed&apos;s payment for March&rdquo; — it prepares the
                operation and presents it in an approval card before any execution. Every write
                operation goes through your explicit approval and is logged in the activity journal
                under the approver&apos;s name.
              </p>
            </Reveal>
            <Reveal delay={80}>
              <BrowserFrame>
                <ProductVideo
                  src={AI_VIDEO.src}
                  poster={AI_VIDEO.poster}
                  label="Real recording: the AI assistant prepares an operation and waits for the director's approval"
                />
              </BrowserFrame>
              <p className="mt-3 text-center text-xs text-foreground/50">
                Real platform recording — no speed-up or editing
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-container text-center">
          <Reveal>
            <h2 className="mk-display mk-h3">The best way to understand the platform: see it in action</h2>
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
