// Marketing copy — English version (translated from the validated pitch script,
// identical positioning to the Arabic and French content files).

// ── Real-data gates (same rules: no unverified numbers — an empty proof strip
// is better than a fake one). Fill with REAL aggregates to auto-render. ──
export const PROOF_STATS: { label: string; value: number; suffix?: string }[] | null = null

export const TRUSTED_BY: { name: string; logoSrc?: string } | null = null

export const TESTIMONIAL: { quote: string; name: string; role: string } | null = null

// ── Product screenshots (from demo tenant only, never real student data).
// Empty string = honest placeholder renders. ──
export const SHOTS = {
  dashboard: "/assets/dashboard.png",
  qrCheckin: "/assets/qr-checkin.webp",
  ledger: "/assets/ledger.png",
  scannerPhone: "",
}

export const AI_VIDEO = {
  src: "/assets/ai-propose.mp4",
  poster: "/assets/ai-propose-poster.jpg",
}

export const QR_VIDEO = {
  src: "/assets/qr-scanner.mp4",
  poster: "/assets/qr-checkin.webp",
}

export const SCRUB = {
  basePath: "/assets/scrub",
  count: 72,
  width: 1024,
  height: 576,
}

export const TRUST_POINTS: { icon: "tunisia" | "shield" | "trial" | "onsite"; text: string }[] = [
  { icon: "tunisia", text: "Tunisian platform, fully Arabic interface" },
  { icon: "shield", text: "Each school's data is isolated and encrypted" },
  { icon: "trial", text: "Free 14-day trial, no commitment" },
  { icon: "onsite", text: "On-site setup and training at your school" },
]

export const HERO = {
  headlineLines: ["Replace paper attendance registers", "with a complete digital system"],
  goldPhrase: "with a complete digital system",
  subhead:
    "Q-Trust brings your school's student attendance via QR scan, payment tracking, and progress reports together — in one Arabic-first platform.",
  ctaPrimary: "Book a demo",
  ctaSecondary: "See the platform",
}

export const PILLARS = [
  {
    title: "Save time every session",
    body: "A QR card scan records attendance in one second. No more roll calls, hand-filled notebooks, or end-of-month spreadsheet re-entry.",
    icon: "qr" as const,
  },
  {
    title: "No absence goes unnoticed",
    body: "The dashboard shows today's absences as soon as the session starts, with a full history per student. Parents don't discover a dropout a month later.",
    icon: "eye" as const,
  },
  {
    title: "Know who paid and who's overdue",
    body: "A monthly ledger per student: paid or overdue, one click, with export ready for the school's financial reports.",
    icon: "ledger" as const,
  },
]

export const TOUR_BEATS = [
  {
    key: "qr",
    title: "QR attendance",
    caption: "The student holds their card to the camera — attendance is recorded instantly, with a green success pulse visible to the supervisor.",
    shot: "qrCheckin" as const,
  },
  {
    key: "dashboard",
    title: "Live dashboard",
    caption: "One glance: today's sessions, attendance rate, absences, and pending claims — real numbers, updated in real time.",
    shot: "dashboard" as const,
  },
  {
    key: "ledger",
    title: "Payment ledger",
    caption: "Each month's fees at your fingertips: who paid, who's overdue, and total revenue — no paper notebooks or scattered spreadsheets.",
    shot: "ledger" as const,
  },
]

export const AI_SPOTLIGHT = {
  eyebrow: "AI Assistant — Advanced plan",
  title: "Ask in Arabic, approve before any action",
  body: "Write your request as you'd tell an office assistant: 'Record Ahmed's payment for March.' The assistant searches, prepares the operation, then presents it in an approval card — no change is made to your data without your explicit approval.",
  typedRequest: "Record Ahmed Ben Ali's payment for March",
  actionDescription: "Record monthly payment — Ahmed Ben Ali, March",
  approveLabel: "Approve and execute",
  rejectLabel: "Reject",
}

export const SCANNER = {
  eyebrow: "Scanner app + QR cards",
  title: "A tablet at the door, a card for every student",
  body: "A dedicated scanner app runs on a tablet at the classroom entrance: the student holds up their card, the system handles the rest. PVC cards with a unique QR ID are printed for each student and handed out at enrollment.",
  bullets: [
    "Runs without teacher intervention — the session starts on time",
    "PVC cards printed with your school's name (add-on service)",
    "Clear green confirmation pulse visible to student and supervisor",
  ],
}

export const PRICING_TIERS = [
  {
    key: "starter",
    name: "Starter",
    setup: "0 TND",
    annual: "0 TND / year",
    cap: "Up to 50 students",
    highlight: false,
    unlocks: "Get started free: browser QR attendance and basic payment ledger.",
    features: [
      "QR attendance from the browser",
      "Basic payment ledger",
      "One admin seat",
      "Free 14-day trial",
    ],
  },
  {
    key: "standard",
    name: "Professional",
    setup: "From 600 TND",
    annual: "350–450 TND / year",
    cap: "Up to 300 students",
    highlight: false,
    unlocks: "Tablet scanner, bulk operations, and parent portal.",
    features: [
      "Everything in Starter",
      "Connect scanner app on tablet",
      "Bulk payments and CSV export",
      "Student and parent portal",
      "Educational document library",
    ],
  },
  {
    key: "premium",
    name: "Advanced",
    setup: "1,100 TND",
    annual: "650 TND / year",
    cap: "Unlimited students",
    highlight: true,
    unlocks: "Arabic AI assistant and multi-branch management — no student limit.",
    features: [
      "Everything in Professional",
      "Arabic AI assistant (approval required for every operation)",
      "Multi-branch management",
      "Priority technical support",
    ],
  },
]

export const FINAL_CTA = {
  title: "Ready to see your platform running with your school's data?",
  body: "Book a live demo — we come to you or meet remotely. Watch attendance and payments work right before your eyes.",
  cta: "Book a demo",
}
