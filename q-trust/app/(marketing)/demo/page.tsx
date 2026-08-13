import type { Metadata } from "next"
import { Reveal } from "@/components/marketing/reveal"
import { DemoForm } from "./demo-form"

export const metadata: Metadata = {
  title: "احجز عرضًا تجريبيًا",
  description:
    "احجز عرضًا حيًّا لمنصة Q-Trust — نعرض عليك الحضور بمسح QR والمدفوعات والتقارير ببيانات تجريبية، في مقر جمعيتك أو عن بُعد.",
}

const STEPS = [
  { n: "١", text: "تملأ النموذج — يصلنا طلبك مباشرة." },
  { n: "٢", text: "نتصل بك خلال يوم عمل لفهم احتياج جمعيتك وتحديد موعد." },
  { n: "٣", text: "عرض حيّ ٣٠ دقيقة ببيانات تجريبية — في مقرّكم أو عن بُعد." },
]

export default function DemoPage() {
  return (
    <section className="pt-36 mk-section">
      <div className="mk-container">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <Reveal>
            <p className="mk-eyebrow mb-3">عرض تجريبي</p>
            <h1 className="mk-display mk-h2 max-w-[16ch]">شاهد منصّتك تعمل قبل أن تلتزم</h1>
            <p className="mk-lead mt-5 max-w-[44ch]">
              عرض مباشر على بيانات تجريبية: الحضور بمسح QR، لوحة التحكم، ودفتر المدفوعات — وتسأل ما
              تشاء.
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
