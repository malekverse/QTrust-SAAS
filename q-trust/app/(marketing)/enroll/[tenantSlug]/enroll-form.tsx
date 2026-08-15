"use client"

import { useState } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"

interface Props {
  tenantSlug: string
  accent: string
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"

export function EnrollForm({ tenantSlug, accent }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const form = e.currentTarget
    const fd = new FormData(form)
    const payload = Object.fromEntries(fd.entries())

    try {
      const res = await fetch(`/api/enroll/${tenantSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "حدث خطأ" }))
        throw new Error(data.message || "حدث خطأ")
      }
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ")
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <div
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: `${accent}18`, color: accent }}
        >
          <CheckCircle2 className="h-9 w-9" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900">تم إرسال طلب التسجيل</h2>
        <p className="mt-2 text-sm text-neutral-600">
          شكراً لكم. سيتم مراجعة الطلب والتواصل معكم قريباً بإذن الله.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8"
    >
      {/* Honeypot — visually hidden; bots fill it, humans don't */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute h-0 w-0 overflow-hidden opacity-0"
      />

      <fieldset className="space-y-4" disabled={submitting}>
        <legend className="mb-2 text-sm font-bold text-neutral-800">معلومات الطالب</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">الاسم *</label>
            <input name="firstName" required minLength={2} maxLength={50} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">اللقب *</label>
            <input name="lastName" required minLength={2} maxLength={50} className={inputClass} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">الجنس *</label>
            <select name="gender" required defaultValue="" className={inputClass}>
              <option value="" disabled>اختر...</option>
              <option value="MALE">ذكر</option>
              <option value="FEMALE">أنثى</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">تاريخ الولادة</label>
            <input type="date" name="dateOfBirth" dir="ltr" className={inputClass} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              رقم بطاقة التعريف (8 أرقام)
            </label>
            <input name="cin" inputMode="numeric" pattern="\d{8}" dir="ltr" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">المستوى التعليمي</label>
            <input name="educationLevel" maxLength={100} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">العنوان</label>
          <input name="address" maxLength={200} className={inputClass} />
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t border-neutral-100 pt-5" disabled={submitting}>
        <legend className="mb-2 text-sm font-bold text-neutral-800">معلومات الولي</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">اسم الولي</label>
            <input name="parentName" maxLength={100} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              هاتف الولي (+216XXXXXXXX)
            </label>
            <input name="parentPhone" dir="ltr" placeholder="+216" className={inputClass} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">
            البريد الإلكتروني للولي
          </label>
          <input type="email" name="parentEmail" dir="ltr" className={inputClass} />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">
            ملاحظات صحية أو طارئة (اختياري)
          </label>
          <textarea name="medicalNotes" maxLength={500} rows={3} className={inputClass} />
        </div>
      </fieldset>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
        style={{ backgroundColor: accent }}
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        إرسال طلب التسجيل
      </button>

      <p className="text-center text-[11px] text-neutral-400">
        بإرسال هذا الطلب فإنكم توافقون على مراجعة الجمعية للبيانات المقدمة.
      </p>
    </form>
  )
}
