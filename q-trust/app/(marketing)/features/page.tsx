import type { Metadata } from "next"
import Link from "next/link"
import { Reveal } from "@/components/marketing/reveal"
import { BrowserFrame, ScreenshotSlot } from "@/components/marketing/frames"
import { ScanDemo } from "@/components/marketing/scan-demo"
import { ProductVideo } from "@/components/marketing/product-video"
import { SHOTS, AI_VIDEO, QR_VIDEO } from "@/components/marketing/content"

export const metadata: Metadata = {
  title: "المميزات",
  description:
    "كل قدرات Q-Trust بالتفصيل: الحضور بمسح QR، لوحة التحكم والتقارير، دفتر المدفوعات، بوابة الطالب والوليّ، والمساعد الذكي بالعربية.",
}

// One full section per real capability (§8.1) — never an icon grid with
// three-word blurbs (§8.2.7). Every visual slot takes a real product capture.
const SECTIONS = [
  {
    key: "qr",
    eyebrow: "الحضور",
    title: "مسح QR يسجّل الحضور في ثانية",
    body: "لكل طالب بطاقة بمعرّف QR فريد. عند دخول القاعة يمرّرها أمام الكاميرا — من جهاز لوحي عند الباب أو من متصفح المشرف — فيُسجَّل حضوره فورًا في الحصة الصحيحة، مع نافذة زمنية تضبطها الجمعية لكل حصة. المتأخر يُسجَّل متأخرًا، والغائب يظهر غائبًا دون أي إدخال يدوي.",
    shot: "qrCheckin" as const,
  },
  {
    key: "dashboard",
    eyebrow: "لوحة التحكم",
    title: "أرقام اليوم أمامك لحظة حدوثها",
    body: "حصص اليوم، نسبة الحضور، الغيابات، الاعتراضات المعلّقة، وحالة الاشتراكات — في شاشة واحدة تتحدّث مباشرة. تقارير أسبوعية وشهرية جاهزة للعرض على مجلس إدارة الجمعية دون تجميع يدوي.",
    shot: "dashboard" as const,
  },
  {
    key: "payments",
    eyebrow: "المدفوعات",
    title: "دفتر اشتراكات لا يسقط منه أحد",
    body: "اشتراك كل طالب لكل شهر: مدفوع أو متأخّر، بضغطة واحدة أو بعملية جماعية لمجموعة كاملة. تصدير CSV جاهز للمحاسبة، وسجلّ يوضح من سجّل كل عملية ومتى — شفافية كاملة أمام أهل الطالب وأمام مجلس الجمعية.",
    shot: "ledger" as const,
  },
  {
    key: "portal",
    eyebrow: "بوابة الطالب والوليّ",
    title: "كل عائلة ترى مسار ابنها",
    body: "حساب لكل طالب يعرض حضوره وجدول حصصه ووثائقه التعليمية وأداءه. الوليّ يتابع من هاتفه دون أن يسأل أحدًا — والجمعية تكسب ثقة العائلات بشفافية يومية.",
    shot: "dashboard" as const,
  },
]

export default function FeaturesPage() {
  return (
    <>
      <section className="pt-36 pb-6">
        <div className="mk-container">
          <Reveal className="max-w-[46ch]">
            <p className="mk-eyebrow mb-3">المميزات</p>
            <h1 className="mk-display mk-h2">منصة واحدة لإدارة يوم الجمعية كاملًا</h1>
            <p className="mk-lead mt-5">
              من لحظة دخول الطالب إلى تقرير نهاية الشهر — كل قدرة مبنية حول طريقة عمل جمعيات
              التحفيظ فعلًا، بالعربية ومن اليمين إلى اليسار.
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
                <h2 className="mk-display mk-h3 max-w-[20ch]">{s.title}</h2>
                <p className="mk-body mt-4 max-w-[52ch] text-sm sm:text-base">{s.body}</p>
              </Reveal>
              <Reveal delay={80} className={i % 2 === 1 ? "lg:order-1" : ""}>
                <BrowserFrame>
                  {s.key === "qr" ? (
                    <ProductVideo
                      src={QR_VIDEO.src}
                      poster={QR_VIDEO.poster}
                      label="تسجيل حقيقي من المنصة: شاشة تسجيل الحضور بمسح QR"
                    />
                  ) : (
                    <ScreenshotSlot src={SHOTS[s.shot] || undefined} alt={s.title} />
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
              <p className="mk-eyebrow mb-3">تطبيق الماسح</p>
              <h2 className="mk-display mk-h3 max-w-[20ch]">جهاز لوحي عند الباب يدير الدخول وحده</h2>
              <p className="mk-body mt-4 max-w-[52ch] text-sm sm:text-base">
                تطبيق مخصّص يقترن بحساب جمعيتك ويعمل في وضع «كشك» على جهاز لوحي عند مدخل القاعة.
                الطالب يمرّر بطاقته ويرى نبضة النجاح الخضراء — والمعلّم يبدأ حصته في وقتها بدل
                المناداة بالأسماء. (متاح من باقة «احترافي»)
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
              <p className="mk-eyebrow mb-3">المساعد الذكي — باقة متقدّم</p>
              <h2 className="mk-display mk-h3 max-w-[20ch]">موظف إداري يفهم العربية ويطلب إذنك</h2>
              <p className="mk-body mt-4 max-w-[52ch] text-sm sm:text-base">
                «كم طالبًا غاب هذا الأسبوع؟» — يجيب فورًا من بياناتك. «سجّل دفع أحمد لشهر مارس» —
                يجهّز العملية ويعرضها في بطاقة موافقة قبل أي تنفيذ. كل عملية كتابة تمرّ بموافقتك
                الصريحة، وتُسجَّل في سجلّ النشاطات باسم من وافق عليها.
              </p>
            </Reveal>
            <Reveal delay={80}>
              <BrowserFrame>
                <ProductVideo
                  src={AI_VIDEO.src}
                  poster={AI_VIDEO.poster}
                  label="تسجيل حقيقي من المنصة: المساعد الذكي يجهّز عملية وينتظر موافقة المدير"
                />
              </BrowserFrame>
              <p className="mt-3 text-center text-xs text-foreground/50">
                تسجيل حقيقي من المنصة — دون تسريع أو مونتاج
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-container text-center">
          <Reveal>
            <h2 className="mk-display mk-h3">أفضل طريقة لفهم المنصة: أن تراها تعمل</h2>
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
