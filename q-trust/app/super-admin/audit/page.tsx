"use client"

import { useMemo, useState, useEffect } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Pagination } from "@/components/ui/pagination"
import { History, Search, UserCog, ShieldCheck, Building2, CreditCard, Mail, KeyRound, LogIn } from "lucide-react"

// Match models/PlatformAuditLog PlatformAuditAction enum. Kept literal
// so this file doesn't drag Mongoose into the client bundle.
const ALL_ACTIONS = [
  "TENANT_PROVISIONED",
  "TENANT_UPDATED",
  "TENANT_PLAN_CHANGED",
  "TENANT_STATUS_CHANGED",
  "TENANT_DELETED",
  "TENANT_LIMITS_CHANGED",
  "ADMIN_ACCESS_REISSUED",
  "ADMIN_ACCESS_REVEALED",
  "ADMIN_ACCESS_EMAILED",
  "ADMIN_PASSWORD_RESET",
  "IMPERSONATION_STARTED",
  "IMPERSONATION_ENDED",
  "LEAD_CONVERTED",
  "LEAD_DELETED",
  "INVOICE_CREATED",
  "INVOICE_PAID",
  "INVOICE_CANCELLED",
  "BILLING_SWEEP_RUN",
  "SUPER_ADMIN_CREATED",
] as const

type AuditRow = {
  _id: string
  actorEmail: string
  action: string
  targetType?: string
  targetId?: string
  tenantId?: string
  tenant?: { _id: string; name: string; slug: string } | null
  metadata?: Record<string, unknown>
  ip?: string
  createdAt: string
}
type ListResponse = { data: AuditRow[]; pagination: { page: number; pages: number; total: number; limit: number } }

function actionIcon(action: string) {
  if (action.startsWith("TENANT_")) return <Building2 className="h-4 w-4 text-primary" />
  if (action.startsWith("ADMIN_ACCESS_") || action === "ADMIN_PASSWORD_RESET")
    return <KeyRound className="h-4 w-4 text-blue-600" />
  if (action.startsWith("IMPERSONATION_")) return <UserCog className="h-4 w-4 text-amber-600" />
  if (action.startsWith("LEAD_")) return <Mail className="h-4 w-4 text-emerald-600" />
  if (action.startsWith("INVOICE_") || action === "BILLING_SWEEP_RUN")
    return <CreditCard className="h-4 w-4 text-purple-600" />
  if (action === "SUPER_ADMIN_CREATED") return <ShieldCheck className="h-4 w-4 text-red-600" />
  return <LogIn className="h-4 w-4 text-muted-foreground" />
}

function useDebounced<T>(value: T, delay = 250): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

export default function AuditPage() {
  const t = useTranslations("superAdmin.audit")
  const tc = useTranslations("common")
  const tAction = useTranslations("superAdmin.audit.actions")

  const [action, setAction] = useState<string>("")
  const [actor, setActor] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [page, setPage] = useState(1)

  const debouncedActor = useDebounced(actor)

  const params = useMemo(() => {
    const p = new URLSearchParams()
    if (action) p.set("action", action)
    if (debouncedActor.trim()) p.set("actor", debouncedActor.trim())
    if (from) p.set("from", from)
    if (to) p.set("to", to)
    p.set("page", String(page))
    return p.toString()
  }, [action, debouncedActor, from, to, page])

  const { data, isLoading } = useQuery<ListResponse>({
    queryKey: ["audit", params],
    queryFn: async () => {
      const res = await fetch(`/api/super-admin/audit?${params}`)
      if (!res.ok) throw new Error("failed")
      return res.json()
    },
  })
  const rows = data?.data ?? []

  const fmt = (d: string) =>
    new Date(d).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })

  function metadataSummary(r: AuditRow): string | null {
    const m = r.metadata
    if (!m) return null
    // Pick a small set of well-known keys to summarize inline. Anything
    // else appears in the expandable detail (not built yet — keeps the
    // page terse for the common case).
    const parts: string[] = []
    if (typeof m.invoiceNumber === "string") parts.push(m.invoiceNumber)
    if (typeof m.amountTND === "number") parts.push(`${m.amountTND} د.ت`)
    if (typeof m.slug === "string") parts.push(`/t/${m.slug}`)
    if (typeof m.tenantSlug === "string" && !m.slug) parts.push(`/t/${m.tenantSlug}`)
    if (typeof m.from === "string" && typeof m.to === "string") parts.push(`${m.from} → ${m.to}`)
    if (typeof m.adminEmail === "string") parts.push(m.adminEmail)
    if (typeof m.targetEmail === "string" && m.targetEmail !== m.adminEmail) parts.push(m.targetEmail)
    if (typeof m.to === "string" && parts.length === 0) parts.push(m.to as string)
    if (typeof m.reason === "string" && m.reason) parts.push(`— ${m.reason}`)
    if (r.action === "BILLING_SWEEP_RUN") {
      const overdue = (m.overdueMarked as number | undefined) ?? 0
      const renewals = (m.renewalsGenerated as number | undefined) ?? 0
      const trials = (m.trialsLapsed as number | undefined) ?? 0
      return t("sweepSummary", { overdue, renewals, trials })
    }
    return parts.length ? parts.join(" · ") : null
  }

  function safeActionLabel(action: string): string {
    // useTranslations throws when a key is missing. Fall back to the raw
    // enum string so a new action shipped ahead of its translation still
    // renders something sensible.
    try {
      return tAction(action)
    } catch {
      return action
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          {t("pageTitle")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t("pageSubtitle", { count: data?.pagination.total ?? 0 })}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value)
            setPage(1)
          }}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm min-w-[180px]"
        >
          <option value="">{t("filterAllActions")}</option>
          {ALL_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {safeActionLabel(a)}
            </option>
          ))}
        </select>
        <div className="relative w-full md:w-64">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={actor}
            onChange={(e) => {
              setActor(e.target.value)
              setPage(1)
            }}
            placeholder={t("actorPlaceholder")}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("timelineTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">{t("noResults")}</p>
          ) : (
            <ul className="divide-y">
              {rows.map((r) => {
                const summary = metadataSummary(r)
                return (
                  <li key={r._id} className="py-3 flex items-start gap-3">
                    <div className="mt-0.5 h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      {actionIcon(r.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{safeActionLabel(r.action)}</span>
                        {r.tenant && (
                          <Link
                            href={`/super-admin/tenants/${r.tenant._id}`}
                            className="text-xs text-primary hover:underline"
                          >
                            {r.tenant.name}
                          </Link>
                        )}
                        <Badge variant="outline" className="text-xs font-mono">
                          {r.action}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5" dir="ltr">
                        {r.actorEmail}
                      </p>
                      {summary && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{summary}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {fmt(r.createdAt)}
                    </span>
                  </li>
                )
              })}
            </ul>
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
