"use client"

import { use, useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/toast"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  ArrowRight, ArrowLeft, Phone, Mail, MapPin, Calendar, MessageSquarePlus,
  Building2, Trash2, ExternalLink, CheckCircle2,
} from "lucide-react"

type LeadNote = { _id?: string; body: string; authorName: string; createdAt: string }
type Lead = {
  _id: string
  name: string
  associationName: string
  city?: string
  phone: string
  email?: string
  studentCount?: string
  message?: string
  status: string
  locale: string
  followUpAt?: string
  contactedAt?: string
  convertedTenantId?: string
  convertedAt?: string
  source?: string
  notes: LeadNote[]
  createdAt: string
  updatedAt: string
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  NEW: ["NEW", "CONTACTED", "CLOSED"],
  CONTACTED: ["CONTACTED", "NEW", "CLOSED"],
  CLOSED: ["CLOSED", "NEW", "CONTACTED"],
  CONVERTED: ["CONVERTED"],
}

const STATUS_KEYS: Record<string, string> = {
  NEW: "new",
  CONTACTED: "contacted",
  CONVERTED: "converted",
  CLOSED: "closed",
}

function formatStudentCount(raw: string | undefined, t: (k: string) => string): string {
  if (!raw) return "—"
  if (["LT_50", "R50_150", "R150_300", "GT_300"].includes(raw)) {
    return t(`studentRange.${raw}`)
  }
  return raw
}

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const qc = useQueryClient()
  const t = useTranslations("superAdmin.leads")
  const tc = useTranslations("common")
  const { success, error: showError } = useToast()
  const [note, setNote] = useState("")

  const { data: lead, isLoading } = useQuery<Lead>({
    queryKey: ["lead", id],
    queryFn: async () => {
      const res = await fetch(`/api/leads/${id}`)
      if (!res.ok) throw new Error((await res.json()).message || "failed")
      return res.json()
    },
  })

  const patchLead = useMutation({
    mutationFn: async (update: Partial<Pick<Lead, "status" | "followUpAt" | "contactedAt">>) => {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "failed")
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead", id] })
      qc.invalidateQueries({ queryKey: ["leads"] })
      success(t("saved"), t("statusUpdated"))
    },
    onError: (e: Error) => showError(tc("error"), e.message),
  })

  const addNote = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/leads/${id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: note.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "failed")
      return data
    },
    onSuccess: () => {
      setNote("")
      qc.invalidateQueries({ queryKey: ["lead", id] })
      success(t("saved"), t("noteAdded"))
    },
    onError: (e: Error) => showError(tc("error"), e.message),
  })

  const deleteLead = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/leads/${id}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "failed")
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] })
      success(t("deleted"), t("deleteConfirmTitle"))
      router.push("/super-admin/leads")
    },
    onError: (e: Error) => showError(tc("error"), e.message),
  })

  const isConverted = lead?.status === "CONVERTED"

  const followUpValue = useMemo(() => {
    if (!lead?.followUpAt) return ""
    const d = new Date(lead.followUpAt)
    return d.toISOString().slice(0, 10)
  }, [lead?.followUpAt])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }
  if (!lead) return null
  const notes = lead.notes ?? []

  const fmtDate = (d: string) => new Date(d).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-3">
            <Link href="/super-admin/leads">
              <ArrowRight className="h-4 w-4 ml-1 rtl:hidden" />
              <ArrowLeft className="h-4 w-4 mr-1 ltr:hidden" />
              {t("backToList")}
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">{lead.name}</h1>
          <p className="text-muted-foreground text-sm">{lead.associationName}</p>
        </div>
        <div className="flex items-center gap-2">
          {isConverted && lead.convertedTenantId ? (
            <Button asChild variant="outline">
              <Link href={`/super-admin/tenants/${lead.convertedTenantId}`}>
                <ExternalLink className="h-4 w-4 ml-2" />
                {t("openConvertedTenant")}
              </Link>
            </Button>
          ) : (
            <Button asChild size="lg">
              <Link href={`/super-admin/tenants/new?leadId=${lead._id}`}>
                <Building2 className="h-4 w-4 ml-2" />
                {t("convertToTenant")}
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: contact card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("contactInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow icon={<Phone className="h-4 w-4" />} label={t("phoneCol")}>
              <a href={`tel:${lead.phone}`} className="text-primary hover:underline" dir="ltr">
                {lead.phone}
              </a>
            </InfoRow>
            {lead.email && (
              <InfoRow icon={<Mail className="h-4 w-4" />} label={t("email")}>
                <a href={`mailto:${lead.email}`} className="text-primary hover:underline" dir="ltr">
                  {lead.email}
                </a>
              </InfoRow>
            )}
            {lead.city && (
              <InfoRow icon={<MapPin className="h-4 w-4" />} label={t("city")}>
                {lead.city}
              </InfoRow>
            )}
            <InfoRow icon={<Calendar className="h-4 w-4" />} label={t("submittedAt")}>
              {fmtDate(lead.createdAt)}
            </InfoRow>
            {lead.studentCount && (
              <InfoRow icon={<Building2 className="h-4 w-4" />} label={t("studentCount")}>
                {formatStudentCount(lead.studentCount, t)}
              </InfoRow>
            )}
            {lead.message && (
              <div className="mt-4 border-t pt-3">
                <p className="text-xs text-muted-foreground mb-1">{t("messageFromLead")}</p>
                <p className="whitespace-pre-wrap">{lead.message}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: status + follow-up */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("statusPanel")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("status")}</label>
              <select
                value={lead.status}
                disabled={isConverted || patchLead.isPending}
                onChange={(e) => patchLead.mutate({ status: e.target.value })}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                {(STATUS_TRANSITIONS[lead.status] ?? [lead.status]).map((s) => (
                  <option key={s} value={s}>
                    {t(STATUS_KEYS[s] ?? s)}
                  </option>
                ))}
              </select>
              {isConverted && (
                <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  {lead.convertedAt ? t("convertedAt", { date: fmtDate(lead.convertedAt) }) : t("converted")}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("followUpAt")}</label>
              <Input
                type="date"
                value={followUpValue}
                disabled={isConverted}
                onChange={(e) => {
                  const v = e.target.value
                  patchLead.mutate({ followUpAt: v ? new Date(v).toISOString() : null as unknown as undefined })
                }}
              />
            </div>
            {!isConverted && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive w-full justify-start">
                    <Trash2 className="h-4 w-4 ml-2" />
                    {t("deleteLead")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>{t("deleteConfirmBody")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteLead.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {tc("delete")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notes timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("notesTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Textarea
              placeholder={t("notePlaceholder")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="flex-1"
            />
            <Button
              onClick={() => addNote.mutate()}
              disabled={!note.trim() || addNote.isPending}
              className="shrink-0"
            >
              <MessageSquarePlus className="h-4 w-4 ml-2" />
              {t("addNote")}
            </Button>
          </div>

          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t("noNotesYet")}</p>
          ) : (
            <ul className="space-y-3">
              {[...notes].reverse().map((n, i) => (
                <li key={n._id ?? i} className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{n.authorName}</span>
                    <span className="text-xs text-muted-foreground">{fmtDate(n.createdAt)}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div>{children}</div>
      </div>
    </div>
  )
}
