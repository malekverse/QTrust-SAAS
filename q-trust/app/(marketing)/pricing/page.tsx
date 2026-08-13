import type { Metadata } from "next"
import Link from "next/link"
import { Reveal } from "@/components/marketing/reveal"
import { PricingCards } from "@/components/marketing/pricing-cards"

export const metadata: Metadata = {
  title: "الأسعار",
  description:
    "باقات Q-Trust لجمعيات ومدارس تحفيظ القرآن: مبتدئ، احترافي، ومتقدّم — أسعار سنوية بالدينار التونسي مع رسوم تركيب لمرة واحدة.",
}

const NOTES = [
  {
    q: "كيف يتم الدفع؟",
    a: "بالتحويل البنكي أو الشيك أو نقدًا عند التركيب — نحرّر فاتورة لكل عملية، ولا حاجة لبطاقة بنكية.",
  },
  {
    q: "هل الأسعار قابلة للتفاوض؟",
    a: "الأرقام المعروضة أسعار استرشادية. العرض النهائي يُضبط حسب حجم الجمعية واحتياجاتها عند التواصل مع فريق المبيعات.",
  },
  {
    q: "ما هي بطاقات QR للطلاب؟",
    a: "بطاقات PVC مطبوعة باسم جمعيتك ومعرّف QR لكل طالب، تُسلَّم عند التركيب — خدمة إضافية بسعر 2.5–3.5 د.ت للبطاقة، متاحة مع كل الباقات.",
  },
  {
    q: "هل توجد تجربة قبل الالتزام؟",
    a: "نعم — باقة «مبتدئ» تعمل كتجربة مجانية لمدة 14 يومًا، ويمكننا أيضًا تقديم عرض حيّ ببيانات تجريبية قبل أي التزام.",
  },
]

export default function PricingPage() {
  return (
    <>
      <section className="pt-36 pb-4">
        <div className="mk-container">
          <Reveal className="max-w-[46ch]">
            <p className="mk-eyebrow mb-3">الأسعار</p>
            <h1 className="mk-display mk-h2">أسعار واضحة، تُدفع مرة في السنة</h1>
            <p className="mk-lead mt-5">
              رسوم تركيب لمرة واحدة تشمل الإعداد والتدريب ونقل بياناتك، ثم اشتراك سنوي حسب الباقة.
              لا مفاجآت ولا رسوم خفية.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="mk-section pt-12">
        <div className="mk-container">
          <PricingCards />
        </div>
      </section>

      <section className="mk-section pt-0">
        <div className="mk-container">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
            <Reveal>
              <h2 className="mk-display mk-h3">أسئلة تسمعها منّا في كل زيارة</h2>
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
              <h2 className="mk-display mk-h3">غير متأكد أي باقة تناسبك؟</h2>
              <p className="mk-body mt-3">
                احجز عرضًا تجريبيًا ونساعدك على الاختيار حسب عدد طلابك وطريقة عمل جمعيتك.
              </p>
              <Link href="/demo" className="mk-btn mk-btn-primary mt-7">
                تواصل مع المبيعات
                <span className="mk-btn-arrow" aria-hidden="true">←</span>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
