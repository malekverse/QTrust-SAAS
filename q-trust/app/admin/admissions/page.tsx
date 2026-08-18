"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Pagination } from "@/components/ui/pagination"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ClipboardList,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  UserCheck,
  Phone,
  Mail,
  Calendar,
} from "lucide-react"
import { ADMISSION_STATUS } from "@/lib/constants"
import { useToast } from "@/components/ui/toast"

interface Application {
  _id: string
  firstName: string
  lastName: string
  gender: "MALE" | "FEMALE"
  cin?: string
  dateOfBirth?: string
  educationLevel?: string
  address?: string
  parentName?: string
  parentPhone?: string
  parentEmail?: string
  medicalNotes?: string
  status: string
  reviewNotes?: string
  createdAt: string
}

interface AdmissionsResponse {
  data: Application[]
  pagination: { page: number; limit: number; total: number; pages: number }
  stats: Record<string, number>
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  APPROVED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  WAITLISTED: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  REJECTED: "bg-red-500/15 text-red-700 dark:text-red-400",
}

type TabValue = "PENDING" | "WAITLISTED" | "APPROVED" | "REJECTED"

async function fetchAdmissions(status: string, page: number): Promise<AdmissionsResponse> {
  const res = await fetch(`/api/admissions?status=${status}&page=${page}`)
  if (!res.ok) throw new Error("Failed to fetch admissions")
  return res.json()
}

export default function AdmissionsPage() {
  const queryClient = useQueryClient()
  const { success, error: toastError } = useToast()
  const [tab, setTab] = useState<TabValue>("PENDING")
  const [page, setPage] = useState(1)
  const [reviewing, setReviewing] = useState<Application | null>(null)
  const [reviewNotes, setReviewNotes] = useState("")
  const t = useTranslations("admin.admissions")
  const tc = useTranslations("common")
  const admissionStatusKey: Record<string, string> = { PENDING: "statusPending", APPROVED: "statusApproved", WAITLISTED: "statusWaitlisted", REJECTED: "statusRejected" }

  const { data, isLoading } = useQuery({
    queryKey: ["admissions", tab, page],
    queryFn: () => fetchAdmissions(tab, page),
  })

  const mutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const res = await fetch(`/api/admissions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewNotes: notes }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({ message: "actionFailed" }))
        throw new Error(d.message)
      }
      return res.json()
    },
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admissions"] })
      setReviewing(null)
      setReviewNotes("")
      if (vars.status === ADMISSION_STATUS.APPROVED) {
        success(t("approved"), t("approvedMessage"))
      } else {
        success(tc("updated"), t("statusUpdated"))
      }
    },
    onError: (err: Error) => toastError(tc("error"), err.message),
  })

  const openReview = (app: Application) => {
    setReviewing(app)
    setReviewNotes(app.reviewNotes || "")
  }

  const act = (status: string) => {
    if (!reviewing) return
    mutation.mutate({ id: reviewing._id, status, notes: reviewNotes || undefined })
  }

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString("ar-TN", { day: "numeric", month: "long", year: "numeric" }) : "—"

  const applications = data?.data || []
  const stats = data?.stats || {}
  const pagination = data?.pagination

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <Tabs value={tab} onValueChange={(v) => { setTab(v as TabValue); setPage(1) }}>
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="PENDING">
            {t("pendingTab")}{stats.PENDING ? ` (${stats.PENDING})` : ""}
          </TabsTrigger>
          <TabsTrigger value="WAITLISTED">
            {t("waitlistedTab")}{stats.WAITLISTED ? ` (${stats.WAITLISTED})` : ""}
          </TabsTrigger>
          <TabsTrigger value="APPROVED">
            {t("approvedTab")}{stats.APPROVED ? ` (${stats.APPROVED})` : ""}
          </TabsTrigger>
          <TabsTrigger value="REJECTED">
            {t("rejectedTab")}{stats.REJECTED ? ` (${stats.REJECTED})` : ""}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : applications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
            <p className="font-medium text-muted-foreground">
              {t("noApplications")}
            </p>
            {tab === "PENDING" && (
              <p className="mt-1 text-sm text-muted-foreground">
                {t("emptyStateHint")}
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <Card key={app._id} className="transition-all hover:shadow-sm">
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">
                      {app.firstName} {app.lastName}
                    </h3>
                    <Badge variant="outline" className="text-[10px]">
                      {tc(app.gender === 'MALE' ? 'male' : 'female')}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] ${STATUS_STYLE[app.status] || ""}`}>
                      {t(admissionStatusKey[app.status])}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {app.parentName && <span>{t("guardian")}: {app.parentName}</span>}
                    {app.parentPhone && (
                      <span className="flex items-center gap-1" dir="ltr">
                        <Phone className="h-3 w-3" />
                        {app.parentPhone}
                      </span>
                    )}
                    {app.parentEmail && (
                      <span className="flex items-center gap-1" dir="ltr">
                        <Mail className="h-3 w-3" />
                        {app.parentEmail}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(app.createdAt)}
                    </span>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => openReview(app)}>
                  <UserCheck className="ml-1.5 h-4 w-4" />
                  {t("review")}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data?.pagination && (
        <Pagination page={data.pagination.page} pages={data.pagination.pages} total={data.pagination.total} onPageChange={setPage} />
      )}

      {/* Review dialog */}
      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("reviewTitle")}</DialogTitle>
            <DialogDescription>
              {reviewing && `${reviewing.firstName} ${reviewing.lastName}`}
            </DialogDescription>
          </DialogHeader>

          {reviewing && (
            <div className="space-y-4 py-1">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg bg-muted/50 p-4 text-sm sm:grid-cols-2">
                {reviewing.cin && (
                  <Detail label={t("idCard")} value={reviewing.cin} ltr />
                )}
                {reviewing.dateOfBirth && (
                  <Detail label={t("birthDate")} value={formatDate(reviewing.dateOfBirth)} />
                )}
                {reviewing.educationLevel && (
                  <Detail label={t("educationLevel")} value={reviewing.educationLevel} />
                )}
                {reviewing.address && <Detail label={t("address")} value={reviewing.address} />}
                {reviewing.parentName && <Detail label={t("guardian")} value={reviewing.parentName} />}
                {reviewing.parentPhone && (
                  <Detail label={t("guardianPhone")} value={reviewing.parentPhone} ltr />
                )}
              </dl>

              {reviewing.medicalNotes && (
                <div className="text-sm">
                  <p className="text-muted-foreground">{t("medicalNotes")}</p>
                  <p className="mt-1">{reviewing.medicalNotes}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("reviewNotes")}</label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={2}
                  placeholder={t("reviewNotesPlaceholder")}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="text-red-600 hover:text-red-700"
              onClick={() => act(ADMISSION_STATUS.REJECTED)}
              disabled={mutation.isPending}
            >
              <XCircle className="ml-1.5 h-4 w-4" />
              {t("reject")}
            </Button>
            <Button
              variant="outline"
              onClick={() => act(ADMISSION_STATUS.WAITLISTED)}
              disabled={mutation.isPending}
            >
              <Clock className="ml-1.5 h-4 w-4" />
              {t("waitlist")}
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => act(ADMISSION_STATUS.APPROVED)}
              disabled={mutation.isPending || reviewing?.status === ADMISSION_STATUS.APPROVED}
            >
              {mutation.isPending ? (
                <Loader2 className="ml-1.5 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="ml-1.5 h-4 w-4" />
              )}
              {t("approve")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Detail({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium" dir={ltr ? "ltr" : undefined}>
        {value}
      </dd>
    </div>
  )
}
