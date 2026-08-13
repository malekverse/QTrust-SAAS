"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Check, Undo2 } from "lucide-react"
import {
  PLANS,
  TENANT_STATUS,
  PAYMENT_METHODS,
  INVOICE_STATUS,
  PLAN_LABELS,
  TENANT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  INVOICE_STATUS_LABELS,
} from "@/lib/constants"

const selectCls =
  "w-full h-9 rounded-md border border-input bg-background px-3 text-sm"

// ── Plan + status editor ────────────────────────────────────────────────
export function PlanStatusForm({
  tenantId,
  plan,
  status,
}: {
  tenantId: string
  plan: string
  status: string
}) {
  const router = useRouter()
  const [nextPlan, setNextPlan] = useState(plan)
  const [nextStatus, setNextStatus] = useState(status)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = nextPlan !== plan || nextStatus !== status

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: nextPlan, status: nextStatus }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || "تعذّر الحفظ")
        return
      }
      router.refresh()
    } catch {
      setError("خطأ في الاتصال")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">الباقة</p>
          <select value={nextPlan} onChange={(e) => setNextPlan(e.target.value)} className={selectCls}>
            {Object.values(PLANS).map((p) => (
              <option key={p} value={p}>
                {PLAN_LABELS[p] ?? p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">الحالة</p>
          <select
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value)}
            className={selectCls}
          >
            {Object.values(TENANT_STATUS).map((s) => (
              <option key={s} value={s}>
                {TENANT_STATUS_LABELS[s] ?? s}
              </option>
            ))}
          </select>
        </div>
      </div>
      {nextPlan !== plan && (
        <p className="text-xs text-amber-600">
          تغيير الباقة سيُحدّث حدّ الطلاب وحصة الذكاء الاصطناعي تلقائياً.
        </p>
      )}
      <Button size="sm" onClick={save} disabled={!dirty || saving} className="w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ التغييرات"}
      </Button>
    </div>
  )
}

// ── Per-invoice payment control ─────────────────────────────────────────
export function InvoicePaymentControl({
  invoiceId,
  status,
  amountTND,
}: {
  invoiceId: string
  status: string
  amountTND: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState<string>(PAYMENT_METHODS.BANK_TRANSFER)
  const [ref, setRef] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isPaid = status === INVOICE_STATUS.PAID

  async function patch(body: Record<string, unknown>) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/super-admin/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || "تعذّر التحديث")
        return
      }
      setOpen(false)
      router.refresh()
    } catch {
      setError("خطأ في الاتصال")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="text-left">
      <p className="text-sm font-semibold">{amountTND} د.ت</p>
      <Badge variant={isPaid ? "default" : "outline"} className="text-xs">
        {INVOICE_STATUS_LABELS[status] ?? status}
      </Badge>

      {isPaid ? (
        <button
          type="button"
          onClick={() => patch({ status: INVOICE_STATUS.PENDING })}
          disabled={busy}
          className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Undo2 className="h-3 w-3" />
          إلغاء الدفع
        </button>
      ) : !open ? (
        <Button
          size="sm"
          variant="outline"
          className="mt-1 h-7 text-xs"
          onClick={() => setOpen(true)}
        >
          تسجيل الدفع
        </Button>
      ) : (
        <div className="mt-2 space-y-2 rounded-md border p-2 text-right w-48">
          {error && <p className="text-xs text-destructive">{error}</p>}
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={selectCls}>
            {Object.values(PAYMENT_METHODS).map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m] ?? m}
              </option>
            ))}
          </select>
          <Input
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder="رقم المرجع (اختياري)"
            className="h-8 text-xs"
          />
          <div className="flex gap-1">
            <Button
              size="sm"
              className="h-7 flex-1 text-xs"
              disabled={busy}
              onClick={() =>
                patch({
                  status: INVOICE_STATUS.PAID,
                  paymentMethod: method,
                  referenceNumber: ref || undefined,
                })
              }
            >
              {busy ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Check className="h-3 w-3 ml-1" />
                  تأكيد
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              إلغاء
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
