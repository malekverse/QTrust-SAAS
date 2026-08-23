"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Loader2, Check, Undo2, AlertTriangle } from "lucide-react"
import {
  PLANS,
  TENANT_STATUS,
  PAYMENT_METHODS,
  INVOICE_STATUS,
} from "@/lib/constants"
import { useTranslations } from "next-intl"

const selectCls =
  "w-full h-9 rounded-md border border-input bg-background px-3 text-sm"

// ── Plan + status editor ────────────────────────────────────────────────
//
// Same inline form as before, plus:
//   • Suspension reason textarea when the target status is SUSPENDED —
//     the reason is persisted on the Tenant and shown to admins on the
//     /suspended page (a future improvement), and audited alongside the
//     status change.
//   • "Downgrade override" recovery: if the API returns 409 because the
//     tenant is over the new plan's seat cap, offer a Retry button that
//     re-submits with force:true.
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
  const t = useTranslations("superAdmin.tenants")
  const tPlan = useTranslations("superAdmin.enums.plan")
  const tStatus = useTranslations("superAdmin.enums.tenantStatus")
  const tc = useTranslations("common")
  const [nextPlan, setNextPlan] = useState(plan)
  const [nextStatus, setNextStatus] = useState(status)
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState<{ activeCount: number; newCap: number } | null>(null)

  const dirty = nextPlan !== plan || nextStatus !== status
  const needsReason = nextStatus === TENANT_STATUS.SUSPENDED

  async function save(force = false) {
    setSaving(true)
    setError(null)
    setConflict(null)
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: nextPlan,
          status: nextStatus,
          suspensionReason: needsReason ? reason : undefined,
          force,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409 && typeof data.activeCount === "number") {
          setConflict({ activeCount: data.activeCount, newCap: data.newCap })
        }
        setError(data.message || t("saveFailed"))
        return
      }
      setReason("")
      router.refresh()
    } catch {
      setError(t("connectionError"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2 text-xs text-destructive">
          <p>{error}</p>
          {conflict && (
            <button
              type="button"
              className="mt-2 underline"
              onClick={() => save(true)}
              disabled={saving}
            >
              {t("planDowngradeForce")}
            </button>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">{t("planLabel")}</p>
          <select value={nextPlan} onChange={(e) => setNextPlan(e.target.value)} className={selectCls}>
            {Object.values(PLANS).map((p) => (
              <option key={p} value={p}>
                {tPlan(p)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">{tc("status")}</p>
          <select
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value)}
            className={selectCls}
          >
            {Object.values(TENANT_STATUS).map((s) => (
              <option key={s} value={s}>
                {tStatus(s)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {needsReason && nextStatus !== status && (
        <div>
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            {t("suspensionReasonLabel")}
          </p>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("suspensionReasonPlaceholder")}
            rows={2}
            className="text-sm"
          />
        </div>
      )}
      {nextPlan !== plan && (
        <p className="text-xs text-amber-600">
          {t("planChangeWarningSmart")}
        </p>
      )}
      <Button size="sm" onClick={() => save(false)} disabled={!dirty || saving} className="w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("saveChanges")}
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
  const t = useTranslations("superAdmin.tenants")
  const tInvStatus = useTranslations("superAdmin.enums.invoiceStatus")
  const tMethod = useTranslations("superAdmin.enums.paymentMethod")
  const tc = useTranslations("common")
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
        setError(data.message || t("updateFailed"))
        return
      }
      setOpen(false)
      router.refresh()
    } catch {
      setError(t("connectionError"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="text-left">
      <p className="text-sm font-semibold">{amountTND} {t("currency")}</p>
      <Badge variant={isPaid ? "default" : "outline"} className="text-xs">
        {tInvStatus(status)}
      </Badge>

      {isPaid ? (
        <button
          type="button"
          onClick={() => patch({ status: INVOICE_STATUS.PENDING })}
          disabled={busy}
          className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Undo2 className="h-3 w-3" />
          {t("cancelPayment")}
        </button>
      ) : !open ? (
        <Button
          size="sm"
          variant="outline"
          className="mt-1 h-7 text-xs"
          onClick={() => setOpen(true)}
        >
          {t("recordPayment")}
        </Button>
      ) : (
        <div className="mt-2 space-y-2 rounded-md border p-2 text-right w-48">
          {error && <p className="text-xs text-destructive">{error}</p>}
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={selectCls}>
            {Object.values(PAYMENT_METHODS).map((m) => (
              <option key={m} value={m}>
                {tMethod(m)}
              </option>
            ))}
          </select>
          <Input
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder={t("referencePlaceholder")}
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
                  {tc("confirm")}
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
              {tc("cancel")}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
