import type { Metadata } from "next"
import { Reveal } from "@/components/marketing/reveal"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Q-Trust collects, uses, and protects data — including data of minor students.",
}

const SECTIONS = [
  {
    title: "1. Who we are and purpose of this document",
    body: [
      "This policy explains how the Q-Trust platform (\"the Platform\") processes personal data when using our public website and when subscribed schools use the Platform to manage their activities.",
      "Each subscribed school acts as the data controller for its students' and members' data; the Platform acts as a data processor on behalf of the school and according to its instructions.",
    ],
  },
  {
    title: "2. Data we process",
    body: [
      "Demo request form data (public site): name, school name, city, phone number, and email if provided — used exclusively to follow up on your request.",
      "Operational data (within the Platform, entered by the school): student data — including minors — such as name, date of birth, ID number if applicable, photo, guardian contact information, attendance history, monthly fees, and educational documents.",
      "Technical data required for service operation and security: connection logs, IP address for rate limiting, and administrative activity journal within the school's account.",
    ],
  },
  {
    title: "3. Data of minors",
    body: [
      "The nature of Quranic school activities means that most students are minors. The school enters this data as the data controller, with guardian consent according to its own enrollment procedures.",
      "We are committed to strict isolation between schools (no school accesses another's data), role-based access control within the school (director, teacher, student/parent), and never using student data for commercial purposes.",
    ],
  },
  {
    title: "4. Where data is stored and who processes it on our behalf",
    body: [
      "Database: MongoDB Atlas (cloud hosting, encryption in transit and at rest).",
      "Photos and files: Cloudinary, in a folder isolated per school.",
      "AI assistant (Advanced plan): conversation text and necessary query results are sent to the language model provider Groq for request processing; they are not used for model training.",
      "Rate limiting and abuse protection: Upstash Redis.",
      "We do not sell personal data and do not share it with any third party beyond these technical sub-processors.",
    ],
  },
  {
    title: "5. Retention period",
    body: [
      "Demo request data: retained as long as the business relationship is active, deleted on request.",
      "Subscribed school data: retained for the duration of the subscription. At the end of the subscription, the school may request a copy of its data, which is then deleted from our systems within a reasonable timeframe.",
    ],
  },
  {
    title: "6. Your rights",
    body: [
      "You — and the guardian of any student — have the right to access, rectification, deletion, and withdrawal of consent, in accordance with Tunisian data protection law. Requests may be addressed to your school as the data controller, or directly to us via the contact page — we will forward them and assist with their execution.",
    ],
  },
  {
    title: "7. Security",
    body: [
      "Passwords are encrypted with a strong hashing algorithm and never stored in plain text. Connection to the Platform is encrypted via HTTPS. Sensitive operations are logged in an activity journal showing who performed them and when, including operations executed via the AI assistant after the director's approval.",
    ],
  },
  {
    title: "8. Updates",
    body: [
      "We may update this policy as the Platform evolves. Substantial changes are notified to subscribed schools by email to the registered director before they take effect.",
    ],
  },
]

export default function EnglishPrivacyPage() {
  return (
    <section className="pt-36 mk-section">
      <div className="mk-container">
        <Reveal className="max-w-[50ch]">
          <p className="mk-eyebrow mb-3">Trust & Privacy</p>
          <h1 className="mk-display mk-h2">Privacy Policy</h1>
          <p className="mk-lead mt-5">
            We handle data of families and students — many of whom are minors. This
            policy clearly explains what we collect, why, where it&apos;s stored, and who
            has access.
          </p>
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
