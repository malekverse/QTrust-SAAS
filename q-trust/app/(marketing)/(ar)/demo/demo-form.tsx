"use client"

import { useState } from "react"
import { Loader2, CheckCircle2 } from "lucide-react"

const STUDENT_RANGES = ["أقل من 50", "50 – 150", "150 – 300", "أكثر من 300"]

export function DemoForm() {
  const [form, setForm] = useState({
    name: "",
    associationName: "",
    city: "",
    phone: "",
    email: "",
    studentCount: "",
    message: "",
    company: "", // honeypot — hidden from real users, bots fill it
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, locale: "ar" }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.message || "حدث خطأ. حاول مرة أخرى.")
        return
      }
      setDone(true)
    } catch {
      setError("حدث خطأ في الاتصال. حاول مرة أخرى.")
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="mk-card p-10 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
        <h2 className="mk-display mt-5 text-2xl font-bold">وصلنا طلبك</h2>
        <p className="mk-body mt-3 max-w-[40ch] mx-auto">
          سنتواصل معك خلال يوم عمل لتحديد موعد العرض — عادةً عبر مكالمة قصيرة نفهم فيها احتياج
          جمعيتك أولًا.
        </p>
      </div>
    )
  }

  const inputCls =
    "w-full rounded-lg border border-foreground/15 bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"

  return (
    <form onSubmit={onSubmit} className="mk-card p-7 sm:p-9 space-y-5" noValidate>
      {error && (
        <p className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-center text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="lead-name" className="text-sm font-medium">الاسم الكامل *</label>
          <input
            id="lead-name"
            className={inputCls}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            required
            autoComplete="name"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="lead-assoc" className="text-sm font-medium">اسم الجمعية / المدرسة *</label>
          <input
            id="lead-assoc"
            className={inputCls}
            value={form.associationName}
            onChange={(e) => set("associationName", e.target.value)}
            required
            autoComplete="organization"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="lead-city" className="text-sm font-medium">المدينة</label>
          <input
            id="lead-city"
            className={inputCls}
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
            autoComplete="address-level2"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="lead-phone" className="text-sm font-medium">رقم الهاتف *</label>
          <input
            id="lead-phone"
            type="tel"
            dir="ltr"
            className={`${inputCls} text-left`}
            placeholder="+216 XX XXX XXX"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            required
            autoComplete="tel"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="lead-email" className="text-sm font-medium">البريد الإلكتروني (اختياري)</label>
          <input
            id="lead-email"
            type="email"
            dir="ltr"
            className={`${inputCls} text-left`}
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            autoComplete="email"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="lead-count" className="text-sm font-medium">عدد الطلاب تقريبًا</label>
          <select
            id="lead-count"
            className={inputCls}
            value={form.studentCount}
            onChange={(e) => set("studentCount", e.target.value)}
          >
            <option value="">اختر…</option>
            {STUDENT_RANGES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="lead-message" className="text-sm font-medium">ملاحظات (اختياري)</label>
        <textarea
          id="lead-message"
          rows={3}
          className={inputCls}
          value={form.message}
          onChange={(e) => set("message", e.target.value)}
        />
      </div>

      {/* Honeypot: visually hidden + tab-skipped; real users never touch it. */}
      <div className="absolute -z-10 h-0 w-0 overflow-hidden" aria-hidden="true">
        <label htmlFor="lead-company">Company</label>
        <input
          id="lead-company"
          tabIndex={-1}
          autoComplete="off"
          value={form.company}
          onChange={(e) => set("company", e.target.value)}
        />
      </div>

      <button type="submit" className="mk-btn mk-btn-primary w-full" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "أرسل الطلب"}
      </button>
      <p className="text-center text-xs text-foreground/50">
        بإرسال الطلب أنت توافق على <a href="/privacy" className="underline underline-offset-2">سياسة الخصوصية</a>. لا نشارك بياناتك مع أي طرف ثالث.
      </p>
    </form>
  )
}
