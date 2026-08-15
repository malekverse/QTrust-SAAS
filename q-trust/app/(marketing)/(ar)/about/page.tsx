import type { Metadata } from "next"
import Link from "next/link"
import { Reveal } from "@/components/marketing/reveal"

export const metadata: Metadata = {
  title: "من نحن",
  description:
    "Q-Trust منصة تونسية متخصّصة في إدارة جمعيات ومدارس تحفيظ القرآن — مبنية حول احتياجات المديرين والمعلّمين والعائلات.",
}

const VALUES = [
  {
    title: "متخصّصون في مجال واحد",
    body: "لا نبني برنامج إدارة مدارس عامًّا ثم نُعرّبه — Q-Trust مبني من أول سطر حول طريقة عمل جمعيات ومدارس تحفيظ القرآن: الحصص والحلقات، الحضور اليومي، الاشتراكات الشهرية، وعلاقة الجمعية بأولياء الأمور. هذا التخصّص هو سبب بساطة المنصة عند الاستعمال.",
  },
  {
    title: "العربية أولًا، لا ترجمة لاحقة",
    body: "المنصة مصمّمة من اليمين إلى اليسار ومكتوبة بالعربية من أول سطر — الواجهات، التقارير، وحتى المساعد الذكي يتحدث العربية. لأن أدوات الجمعية يجب أن تتكلم لغتها.",
  },
  {
    title: "بيانات الطلاب أمانة",
    body: "نتعامل مع بيانات قاصرين: أسماء، صور، أرقام هواتف أولياء. لذلك كل جمعية معزولة تمامًا عن غيرها، وكل عملية حسّاسة تُسجَّل في سجلّ نشاطات، ولا نبيع البيانات أو نشاركها مع أي طرف — راجع سياسة الخصوصية.",
  },
  {
    title: "علاقة مباشرة، لا تذاكر دعم",
    body: "فريق Q-Trust يركّب المنصة معك في مقرّك، يدرّب فريقك، ويبقى على الهاتف. نموّنا يأتي من رضا الجمعيات وتزكيتها لبعضها — لا من عقود تُوقَّع وتُنسى. مقرّنا في أريانة، ونتنقّل إلى الجمعيات في كامل الجمهورية.",
  },
]

export default function AboutPage() {
  return (
    <>
      <section className="pt-36 pb-6">
        <div className="mk-container">
          <Reveal className="max-w-[46ch]">
            <p className="mk-eyebrow mb-3">من نحن</p>
            <h1 className="mk-display mk-h2">منصة تونسية متخصّصة في إدارة جمعيات التحفيظ</h1>
            <p className="mk-lead mt-5">
              Q-Trust يجمع الحضور والمدفوعات والمتابعة في نظام واحد يحترم طريقة عمل هذه المؤسسات —
              مطوَّر في تونس، وبالعربية من أول سطر.
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
            <h2 className="mk-display mk-h3">تريد أن ترى ما بنيناه؟</h2>
            <Link href="/demo" className="mk-btn mk-btn-primary mt-7">
              احجز عرضًا تجريبيًا
              <span className="mk-btn-arrow" aria-hidden="true">←</span>
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  )
}
