"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Pagination } from "@/components/ui/pagination"
import { Inbox, Search, Phone, CalendarClock, TrendingUp, Sparkles } from "lucide-react"

type LeadRow = {
  _id: string
  name: string
  associationName: string
  city?: string
  phone: string
  email?: string
  studentCount?: string
  message?: string
  status: string
  followUpAt?: string
  contactedAt?: string
  convertedTenantId?: string
  createdAt: string
}

type LeadListResponse = {
  data: LeadRow[]
  pagination: { page: number; limit: number; total: number; pages: number }
}

const STATUS_KEYS: Record<string, string> = {
  NEW: "new",
  CONTACTED: "contacted",
  CONVERTED: "converted",
  CLOSED: "closed",
}

const STATUS_BADGE: Record<string, string> = {
  NEW: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  CONTACTED: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  CONVERTED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  CLOSED: "bg-muted text-muted-foreground border-border",
}

// Renders the range label if the value is a stable STUDENT_RANGES key,
// otherwise falls back to the legacy free-text stored on older leads.
function formatStudentCount(raw: string | undefined, t: (k: string) => string): string {
  if (!raw) return "—"
  if (["LT_50", "R50_150", "R150_300", "GT_300"].includes(raw)) {
    return t(`studentRange.${raw}`)
  }
  return raw
}

async function fetchLeads(status: string | "ALL", search: string, page: number): Promise<LeadListResponse> {
  const params = new URLSearchParams()
  if (status !== "ALL") params.set("status", status)
  if (search) params.set("search", search)
  params.set("page", String(page))
  const res = await fetch(`/api/leads?${params.toString()}`)
  if (!res.ok) throw new Error("failed")
  return res.json()
}

export default function LeadsPage() {
  const t = useTranslations("superAdmin.leads")
  const tc = useTranslations("common")
  const [status, setStatus] = useState<string>("ALL")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const debounced = useDebounced(search, 250)

  const { data, isLoading } = useQuery<LeadListResponse>({
    queryKey: ["leads", status, debounced, page],
    queryFn: () => fetchLeads(status, debounced, page),
  })
  const leads = data?.data ?? []

  const fmtDate = useCallback((d: string) => {
    return new Date(d).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }, [])

  const kpis = useMemo(() => {
    // Approximate KPI from the current page load. For a tighter number, a
    // dedicated aggregation endpoint would replace this — good enough for
    // the first cut.
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    let convertedThisMonth = 0
    for (const l of leads) {
      if (l.status === "CONVERTED" && new Date(l.createdAt) >= monthStart) convertedThisMonth++
    }
    return {
      total: data?.pagination.total ?? 0,
      convertedThisMonth,
    }
  }, [leads, data])

  const tabs = [
    { key: "ALL", label: tc("all") ?? "الكل" },
    { key: "NEW", label: t("new") },
    { key: "CONTACTED", label: t("contacted") },
    { key: "CONVERTED", label: t("converted") },
    { key: "CLOSED", label: t("closed") },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("pageTitle")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("requestCount", { count: kpis.total })}
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Inbox className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">{t("kpiTotal")}</p>
              <p className="text-xl font-semibold">{kpis.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-emerald-600" />
            <div>
              <p className="text-xs text-muted-foreground">{t("kpiConvertedMonth")}</p>
              <p className="text-xl font-semibold">{kpis.convertedThisMonth}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="hidden md:block">
          <CardContent className="p-4 flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-xs text-muted-foreground">{t("kpiHint")}</p>
              <p className="text-sm">{t("kpiHintBody")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter tabs + search */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setStatus(tab.key); setPage(1) }}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                status === tab.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder={t("searchPlaceholder")}
            className="pr-10"
          />
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : leads.length === 0 ? (
        <Card className="p-12 text-center">
          <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-medium">{t("noLeadsYet")}</h3>
          <p className="text-sm text-muted-foreground mt-1">{t("noLeadsHint")}</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 font-medium">{t("dateCol")}</th>
                <th className="p-3 font-medium">{t("nameCol")}</th>
                <th className="p-3 font-medium">{t("associationCol")}</th>
                <th className="p-3 font-medium">{t("cityCol")}</th>
                <th className="p-3 font-medium">{t("phoneCol")}</th>
                <th className="p-3 font-medium">{t("studentCountCol")}</th>
                <th className="p-3 font-medium">{t("statusCol")}</th>
                <th className="p-3 font-medium">{t("actionsCol")}</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l._id} className="border-t hover:bg-muted/30 align-top">
                  <td className="p-3 whitespace-nowrap text-muted-foreground">{fmtDate(l.createdAt)}</td>
                  <td className="p-3 font-medium">
                    <Link href={`/super-admin/leads/${l._id}`} className="hover:underline">
                      {l.name}
                    </Link>
                  </td>
                  <td className="p-3">
                    {l.associationName}
                    {l.message && (
                      <p className="text-xs text-muted-foreground mt-1 max-w-[36ch] line-clamp-2">
                        {l.message}
                      </p>
                    )}
                  </td>
                  <td className="p-3">{l.city ?? "—"}</td>
                  <td className="p-3">
                    <a href={`tel:${l.phone}`} className="text-primary hover:underline inline-flex items-center gap-1" dir="ltr">
                      <Phone className="h-3 w-3" />
                      {l.phone}
                    </a>
                    {l.email && (
                      <p className="text-xs text-muted-foreground" dir="ltr">{l.email}</p>
                    )}
                  </td>
                  <td className="p-3">{formatStudentCount(l.studentCount, t)}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${STATUS_BADGE[l.status] ?? ""}`}>
                      {t(STATUS_KEYS[l.status] ?? l.status)}
                    </span>
                    {l.followUpAt && (
                      <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" />
                        {fmtDate(l.followUpAt)}
                      </p>
                    )}
                  </td>
                  <td className="p-3">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/super-admin/leads/${l._id}`}>{t("open")}</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

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

function useDebounced<T>(value: T, delay = 200): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}
