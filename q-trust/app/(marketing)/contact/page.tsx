import type { Metadata } from "next"
import Link from "next/link"
import { CalendarCheck, MessageCircle } from "lucide-react"
import { Reveal } from "@/components/marketing/reveal"

export const metadata: Metadata = {
  title: "تواصل معنا",
  description: "تواصل مع فريق Q-Trust — احجز عرضًا تجريبيًا أو أرسل استفسارك وسنعاود الاتصال بك خلال يوم عمل.",
}

export default function ContactPage() {
  return (
    <section className="pt-36 mk-section">
      <div className="mk-container">
        <Reveal className="max-w-[46ch]">
          <p className="mk-eyebrow mb-3">تواصل معنا</p>
          <h1 className="mk-display mk-h2">نرد خلال يوم عمل</h1>
          <p className="mk-lead mt-5">
            سواء كنت تستكشف المنصة لأول مرة أو لديك سؤال محدّد — أسرع طريق هو نموذج طلب العرض،
            ويصلنا مباشرة.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 max-w-3xl">
          <Reveal>
            <Link href="/demo" className="mk-card mk-card--lift block h-full p-7">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CalendarCheck className="h-5.5 w-5.5" />
              </span>
              <h2 className="mk-display mt-5 text-xl font-bold">احجز عرضًا تجريبيًا</h2>
              <p className="mk-body mt-2 text-sm">
                عرض حيّ ٣٠ دقيقة ببيانات تجريبية، في مقرّ جمعيتك أو عن بُعد. الطريقة المفضّلة للبدء.
              </p>
            </Link>
          </Reveal>
          <Reveal delay={80}>
            <Link href="/demo" className="mk-card mk-card--lift block h-full p-7">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MessageCircle className="h-5.5 w-5.5" />
              </span>
              <h2 className="mk-display mt-5 text-xl font-bold">سؤال أو استفسار</h2>
              <p className="mk-body mt-2 text-sm">
                اكتب سؤالك في خانة الملاحظات بنفس النموذج وسنتصل بك للإجابة — عن الأسعار أو نقل
                البيانات أو أي شيء آخر.
              </p>
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
