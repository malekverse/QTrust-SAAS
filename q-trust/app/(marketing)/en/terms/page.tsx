import type { Metadata } from "next"
import { Reveal } from "@/components/marketing/reveal"

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms governing the use of the Q-Trust platform for Quranic school and association management.",
}

const SECTIONS = [
  {
    title: "1. The service",
    body: [
      "The Q-Trust platform provides a cloud-based management system for Quranic schools and associations: student enrollment, QR attendance, monthly fee tracking, student and parent portal, and depending on the plan: scanner app and AI assistant.",
    ],
  },
  {
    title: "2. Accounts and permissions",
    body: [
      "School accounts are created during onboarding and the director receives provisional credentials to change at first login. The school is responsible for the confidentiality of its credentials, the use made through its accounts, the accuracy of entered data, and obtaining necessary parental consents.",
    ],
  },
  {
    title: "3. Plans and billing",
    body: [
      "The subscription includes a one-time setup fee and an annual subscription based on the plan agreed upon in the commercial offer, payable by bank transfer, check, or cash against invoice.",
      "Upon expiration of the annual period without renewal, account access may be suspended after prior notice, with the school's data retained in accordance with the privacy policy until renewal or request for data return.",
    ],
  },
  {
    title: "4. Data ownership",
    body: [
      "The school's data and its students' data belong to the school. The school grants the Platform a processing license exclusively for service delivery. At the end of the contract, the school may request a copy of its data before deletion from our systems.",
    ],
  },
  {
    title: "5. Acceptable use",
    body: [
      "It is prohibited to use the Platform for illegal purposes, to attempt to access another school's data, to disrupt service operation, or to abuse the AI assistant. We reserve the right to suspend any violating account after notification.",
    ],
  },
  {
    title: "6. Service availability and liability",
    body: [
      "We make our best efforts to maintain continuous service availability, with planned maintenance announced in advance when possible. We are not liable for indirect damages, and our total liability is limited to the amount paid by the school during the current subscription year.",
    ],
  },
  {
    title: "7. Governing law",
    body: [
      "These terms are governed by Tunisian law. The courts of Ariana have jurisdiction over any dispute not settled amicably.",
    ],
  },
]

export default function EnglishTermsPage() {
  return (
    <section className="pt-36 mk-section">
      <div className="mk-container">
        <Reveal className="max-w-[50ch]">
          <p className="mk-eyebrow mb-3">Trust & Privacy</p>
          <h1 className="mk-display mk-h2">Terms of Service</h1>
          <p className="mt-3 text-xs text-foreground/50">Last updated: August 2026</p>
        </Reveal>

        <div className="mt-14 max-w-3xl space-y-10">
          {SECTIONS.map((s, i) => (
            <Reveal key={s.title} delay={Math.min(i, 3) * 40}>
              <div>
                <h2 className="mk-display text-lg font-bold">{s.title}</h2>
                <div className="mt-3 space-y-2.5">
                  {s.body.map((p) => (
                    <p key={p.slice(0, 24)} className="mk-body text-sm">{p}</p>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
