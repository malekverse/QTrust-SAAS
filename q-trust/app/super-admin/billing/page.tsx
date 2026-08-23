"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Pagination } from "@/components/ui/pagination"
import { useToast } from "@/components/ui/toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Receipt, AlertTriangle, Clock, CheckCircle2, Search, Download, PlayCircle, Check, Undo2, Loader2,
} from "lucide-react"
import {
  INVOICE_STATUS,
  PAYMENT_METHODS,
} from "@/lib/constants"

type Invoice = {
  _id: string
  tenantId: string
  tenant: { _id: string; name: string; slug: string } | null
  type: string
  amountTND: number
  status: string
  dueDate: string
  paidAt?: string
  paymentMethod?: string
  referenceNumber?: string
  proofUrl?: string
  notes?: string
  invoiceNumber?: string
  createdAt: string
}
type ListResponse = { data: Invoice[]; pagination: { page: number; pages: number; total: number; limit: number } }
type SummaryResponse = {
  byStatus: Record<string, { count: number; total: number }>
  aging: Record<string, { count: number; total: number }>
  collectedThisMonth: { total: number; count: number }
}

const fmtTND = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n))
const fmtDate = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—"

function statusBadgeCls(s: string) {
  if (s === INVOICE_STATUS.PAID)
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
  if (s === INVOICE_STATUS.OVERDUE)
    return "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20"
  if (s === INVOICE_STATUS.PENDING)
    return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
  return "bg-muted text-muted-foreground border-border"
}

export default function BillingPage() {
  const qc = useQueryClient()
  const t = useTranslations("superAdmin.billing")
  const tType = useTranslations("superAdmin.enums.invoiceType")
  const tStatus = useTranslations("superAdmin.enums.invoiceStatus")
  const tc = useTranslations("common")
  const { success, error: showError } = useToast()

  const [status, setStatus] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [page, setPage] = useState(1)

  const params = useMemo(() => {
    const p = new URLSearchParams()
    if (status !== "all") p.set("status", status)
    if (search.trim()) p.set("search", search.trim())
    if (from) p.set("from", from)
    if (to) p.set("to", to)
    p.set("page", String(page))
    return p.toString()
  }, [status, search, from, to, page])

  const { data: summary } = useQuery<SummaryResponse>({
    queryKey: ["invoices-summary"],
    queryFn: async () => {
      const res = await fetch("/api/super-admin/invoices/summary")
      if (!res.ok) throw new Error("failed")
      return res.json()
    },
    refetchInterval: 60_000,
  })

  const { data, isLoading } = useQuery<ListResponse>({
    queryKey: ["invoices", params],
    queryFn: async () => {
      const res = await fetch(`/api/super-admin/invoices?${params}`)
      if (!res.ok) throw new Error("failed")
      return res.json()
    },
  })
  const rows = data?.data ?? []

  const markPaid = useMutation({
    mutationFn: async (input: {
      id: string
      status: string
      paymentMethod?: string
      referenceNumber?: string
    }) => {
      const res = await fetch(`/api/super-admin/invoices/${input.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: input.status,
          paymentMethod: input.paymentMethod,
          referenceNumber: input.referenceNumber,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message || "failed")
      return body as { tenantReactivated?: boolean }
    },
    onSuccess: (body) => {
      qc.invalidateQueries({ queryKey: ["invoices"] })
      qc.invalidateQueries({ queryKey: ["invoices-summary"] })
      if (body.tenantReactivated) {
        success(t("paymentRecorded"), t("tenantReactivated"))
      } else {
        success(t("paymentRecorded"), "")
      }
    },
    onError: (e: Error) => showError(tc("error"), e.message),
  })

  const runSweep = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/super-admin/billing/run-sweep", {
        method: "POST",
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message || "failed")
      return body as {
        overdueMarked: number
        trialsLapsed: number
        renewalsGenerated: number
        tokensSwept: number
      }
    },
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: ["invoices"] })
      qc.invalidateQueries({ queryKey: ["invoices-summary"] })
      success(
        t("sweepDone"),
        t("sweepSummary", {
          overdue: b.overdueMarked,
          renewals: b.renewalsGenerated,
          trials: b.trialsLapsed,
        })
      )
    },
    onError: (e: Error) => showError(tc("error"), e.message),
  })

  function exportCsv() {
    // Fetch a larger page for the export to keep it accurate. If the
    // AR ever grows past 1000 rows we'll swap this for a streaming
    // /export endpoint.
    const p = new URLSearchParams(params)
    p.set("limit", "500")
    fetch(`/api/super-admin/invoices?${p.toString()}`)
      .then((r) => r.json())
      .then((res: ListResponse) => {
        const header = [
          "invoiceNumber",
          "tenant",
          "type",
          "amountTND",
          "status",
          "dueDate",
          "paidAt",
          "paymentMethod",
          "referenceNumber",
        ]
        const escape = (v: unknown) => {
          const s = v == null ? "" : String(v)
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
        }
        const lines = [header.join(",")]
        for (const r of res.data) {
          lines.push(
            [
              r.invoiceNumber ?? "",
              r.tenant?.name ?? "",
              r.type,
              r.amountTND,
              r.status,
              new Date(r.dueDate).toISOString().slice(0, 10),
              r.paidAt ? new Date(r.paidAt).toISOString().slice(0, 10) : "",
              r.paymentMethod ?? "",
              r.referenceNumber ?? "",
            ]
              .map(escape)
              .join(",")
          )
        }
        const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `qtrust-invoices-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => showError(tc("error"), tc("error")))
  }

  const pending = summary?.byStatus?.[INVOICE_STATUS.PENDING]
  const overdue = summary?.byStatus?.[INVOICE_STATUS.OVERDUE]
  const collected = summary?.collectedThisMonth
  const aging = summary?.aging ?? {}

  const tabs: { key: string; label: string; count?: number }[] = [
    { key: "all", label: tc("all") ?? "الكل" },
    { key: INVOICE_STATUS.PENDING, label: tStatus("PENDING"), count: pending?.count },
    { key: INVOICE_STATUS.OVERDUE, label: tStatus("OVERDUE"), count: overdue?.count },
    { key: INVOICE_STATUS.PAID, label: tStatus("PAID") },
    { key: INVOICE_STATUS.CANCELLED, label: tStatus("CANCELLED") },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{t("pageTitle")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("invoiceCountSubtitle", { count: (data?.pagination.total ?? 0) })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
            <Download className="h-4 w-4 ml-2" />
            {t("exportCsv")}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <PlayCircle className="h-4 w-4 ml-2" />
                {t("runSweepNow")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("runSweepTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("runSweepBody")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={() => runSweep.mutate()}>
                  {runSweep.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : tc("confirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={<Clock className="h-5 w-5 text-amber-600" />}
          label={t("pendingLabel")}
          value={pending?.total ?? 0}
          suffix={t("currency")}
          sub={t("invoiceUnitCount", { count: pending?.count ?? 0 })}
        />
        <SummaryCard
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          label={t("overdueLabel")}
          value={overdue?.total ?? 0}
          suffix={t("currency")}
          sub={t("invoiceUnitCount", { count: overdue?.count ?? 0 })}
        />
        <SummaryCard
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          label={t("collectedThisMonth")}
          value={collected?.total ?? 0}
          suffix={t("currency")}
          sub={t("invoiceUnitCount", { count: collected?.count ?? 0 })}
        />
      </div>

      {/* AR aging */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("arAgingTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <AgingBucket label={t("agingNotYetDue")} bucket={aging.notYetDue} suffix={t("currency")} />
            <AgingBucket label={t("aging1_30")} bucket={aging["1_30"]} suffix={t("currency")} />
            <AgingBucket label={t("aging31_60")} bucket={aging["31_60"]} suffix={t("currency")} />
            <AgingBucket label={t("aging60plus")} bucket={aging["60_plus"]} suffix={t("currency")} />
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setStatus(tab.key)
                setPage(1)
              }}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                status === tab.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="mr-1 text-xs text-muted-foreground">({tab.count})</span>
              )}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder={t("searchPlaceholder")}
            className="pr-10"
          />
        </div>
        <Input
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value)
            setPage(1)
          }}
          className="w-40"
        />
        <Input
          type="date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value)
            setPage(1)
          }}
          className="w-40"
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            {t("tableTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">
              {t("noResults")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-3 font-medium">{t("invoiceNumberCol")}</th>
                    <th className="p-3 font-medium">{t("organizationCol")}</th>
                    <th className="p-3 font-medium">{t("typeCol")}</th>
                    <th className="p-3 font-medium">{t("amountCol")}</th>
                    <th className="p-3 font-medium">{t("dueDateCol")}</th>
                    <th className="p-3 font-medium">{t("statusCol")}</th>
                    <th className="p-3 font-medium">{t("actionCol")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((inv) => (
                    <tr key={inv._id} className="border-t hover:bg-muted/30 align-top">
                      <td className="p-3 font-mono text-xs" dir="ltr">
                        {inv.invoiceNumber ?? "—"}
                      </td>
                      <td className="p-3">
                        <Link
                          href={`/super-admin/tenants/${inv.tenantId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {inv.tenant?.name ?? "—"}
                        </Link>
                      </td>
                      <td className="p-3">{tType(inv.type)}</td>
                      <td className="p-3 font-semibold whitespace-nowrap">
                        {fmtTND(inv.amountTND)} {t("currency")}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDate(inv.dueDate)}
                      </td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className={`text-xs ${statusBadgeCls(inv.status)}`}
                        >
                          {tStatus(inv.status)}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <InlineAction inv={inv} onMark={markPaid.mutate} isBusy={markPaid.isPending} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {data?.pagination && (
        <Pagination
          page={data.pagination.page}
          pages={data.pagination.pages}
          total={data.pagination.total}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  suffix,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: number
  suffix: string
  sub: string
}) {
  return (
    <Card>
      <CardContent className="pt-6 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold tabular-nums">
            {fmtTND(value)} <span className="text-sm font-normal">{suffix}</span>
          </p>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function AgingBucket({
  label,
  bucket,
  suffix,
}: {
  label: string
  bucket: { count: number; total: number } | undefined
  suffix: string
}) {
  const b = bucket ?? { count: 0, total: 0 }
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-base font-semibold tabular-nums mt-1">
        {fmtTND(b.total)} <span className="text-xs font-normal">{suffix}</span>
      </p>
      <p className="text-xs text-muted-foreground">{b.count}</p>
    </div>
  )
}

function InlineAction({
  inv,
  onMark,
  isBusy,
}: {
  inv: Invoice
  onMark: (i: { id: string; status: string; paymentMethod?: string; referenceNumber?: string }) => void
  isBusy: boolean
}) {
  const t = useTranslations("superAdmin.billing")
  const tMethod = useTranslations("superAdmin.enums.paymentMethod")
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState<string>(PAYMENT_METHODS.BANK_TRANSFER)
  const [ref, setRef] = useState("")

  if (inv.status === INVOICE_STATUS.PAID) {
    return (
      <button
        type="button"
        onClick={() => onMark({ id: inv._id, status: INVOICE_STATUS.PENDING })}
        disabled={isBusy}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Undo2 className="h-3 w-3" />
        {t("undoPayment")}
      </button>
    )
  }
  if (inv.status === INVOICE_STATUS.CANCELLED) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  if (!open) {
    return (
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setOpen(true)}>
        {t("recordPayment")}
      </Button>
    )
  }
  return (
    <div className="rounded-md border p-2 space-y-2 w-56">
      <select
        value={method}
        onChange={(e) => setMethod(e.target.value)}
        className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
      >
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
          disabled={isBusy}
          onClick={() => {
            onMark({
              id: inv._id,
              status: INVOICE_STATUS.PAID,
              paymentMethod: method,
              referenceNumber: ref || undefined,
            })
            setOpen(false)
            setRef("")
          }}
        >
          <Check className="h-3 w-3 ml-1" />
          {t("markPaid")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => setOpen(false)}
          disabled={isBusy}
        >
          ×
        </Button>
      </div>
    </div>
  )
}
