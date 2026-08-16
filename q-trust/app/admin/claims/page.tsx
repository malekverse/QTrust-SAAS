"use client"

import { useState, useEffect } from "react"
import { Pagination } from "@/components/ui/pagination"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  MessageSquareWarning,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
} from "lucide-react"
import { useToast } from "@/components/ui/toast"
import { useTranslations } from "next-intl"

interface Claim {
  _id: string
  studentName: string
  studentId: string
  sessionName: string
  date: string
  reason: string
  status: string
  reviewedBy: string | null
  reviewNotes: string | null
  reviewedAt: string | null
  createdAt: string
}

interface ClaimStats {
  total: number
  pending: number
  approved: number
  rejected: number
}

export default function AdminClaims() {
  const { toast } = useToast()
  const t = useTranslations("admin.claims")
  const tc = useTranslations("common")
  const [claims, setClaims] = useState<Claim[]>([])
  const [paginationInfo, setPaginationInfo] = useState<{ page: number; pages: number; total: number } | null>(null)
  const [page, setPage] = useState(1)
  const [stats, setStats] = useState<ClaimStats>({ total: 0, pending: 0, approved: 0, rejected: 0 })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")

  // Review dialog
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null)
  const [reviewAction, setReviewAction] = useState<"APPROVED" | "REJECTED">("APPROVED")
  const [reviewNotes, setReviewNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchClaims()
  }, [statusFilter, page]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchClaims = async () => {
    try {
      const res = await fetch(`/api/admin/claims?status=${statusFilter}&page=${page}`)
      if (res.ok) {
        const data = await res.json()
        setClaims(data.data)
        setStats(data.stats)
        if (data.pagination) setPaginationInfo(data.pagination)
      }
    } catch (error) {
      console.error("Error fetching claims:", error)
    } finally {
      setLoading(false)
    }
  }

  const openReviewDialog = (claim: Claim, action: "APPROVED" | "REJECTED") => {
    setSelectedClaim(claim)
    setReviewAction(action)
    setReviewNotes("")
    setReviewDialogOpen(true)
  }

  const submitReview = async () => {
    if (!selectedClaim) return

    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/claims", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimId: selectedClaim._id,
          status: reviewAction,
          reviewNotes: reviewNotes || undefined,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        toast({ title: t("reviewed"), description: data.message })
        setReviewDialogOpen(false)
        fetchClaims()
      } else {
        const data = await res.json()
        toast({ title: "خطأ", description: data.message, variant: "destructive" })
      }
    } catch {
      toast({ title: "خطأ", description: "حدث خطأ أثناء المراجعة", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ar-TN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20">
            <Clock className="h-3 w-3 ml-1" />
            {tc("pending")}
          </Badge>
        )
      case "APPROVED":
        return (
          <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20">
            <CheckCircle2 className="h-3 w-3 ml-1" />
            {tc("approved")}
          </Badge>
        )
      case "REJECTED":
        return (
          <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50 dark:bg-red-900/20">
            <XCircle className="h-3 w-3 ml-1" />
            {tc("rejected")}
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <MessageSquareWarning className="h-7 w-7 text-primary" />
          {t("title")}
        </h1>
        <p className="text-muted-foreground mt-1">{t("description")}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("totalClaims")}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 dark:border-amber-800/40">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("pendingClaims")}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 dark:border-emerald-800/40">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{stats.approved}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("approvedClaims")}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-800/40">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("rejectedClaims")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Label>{t("filterLabel")}</Label>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); setLoading(true); }}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tc("all")}</SelectItem>
            <SelectItem value="PENDING">{tc("pending")}</SelectItem>
            <SelectItem value="APPROVED">{tc("approved")}</SelectItem>
            <SelectItem value="REJECTED">{tc("rejected")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Claims List */}
      <div className="space-y-3">
        {claims.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-muted-foreground">{t("noClaims")}</p>
            </CardContent>
          </Card>
        ) : (
          claims.map((claim) => (
            <Card key={claim._id} className="transition-all hover:shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-sm">{claim.studentName}</h4>
                      {getStatusBadge(claim.status)}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p><span className="font-medium">{t("session")}:</span> {claim.sessionName || "—"}</p>
                      <p><span className="font-medium">{tc("date")}:</span> {formatDate(claim.date)}</p>
                      <p><span className="font-medium">{t("reason")}:</span> {claim.reason}</p>
                      {claim.reviewNotes && (
                        <p><span className="font-medium">{t("reviewNotes")}:</span> {claim.reviewNotes}</p>
                      )}
                      {claim.reviewedBy && (
                        <p className="text-xs">
                          <span className="font-medium">{t("reviewedBy")}:</span> {claim.reviewedBy} - {claim.reviewedAt ? formatDate(claim.reviewedAt) : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  {claim.status === "PENDING" && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        className="gap-1"
                        onClick={() => openReviewDialog(claim, "APPROVED")}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {t("approve")}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1"
                        onClick={() => openReviewDialog(claim, "REJECTED")}
                      >
                        <XCircle className="h-4 w-4" />
                        {t("reject")}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {paginationInfo && (
        <Pagination page={paginationInfo.page} pages={paginationInfo.pages} total={paginationInfo.total} onPageChange={setPage} />
      )}

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "APPROVED" ? t("approveTitle") : t("rejectTitle")}
            </DialogTitle>
            <DialogDescription>
              {selectedClaim && (
                <span>
                  اعتراض {selectedClaim.studentName} بتاريخ {formatDate(selectedClaim.date)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {selectedClaim && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm font-medium mb-1">سبب الاعتراض:</p>
                <p className="text-sm text-muted-foreground">{selectedClaim.reason}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>{t("reviewNotesOptional")}</Label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder={t("addNotesPlaceholder")}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              onClick={submitReview}
              disabled={submitting}
              variant={reviewAction === "REJECTED" ? "destructive" : "default"}
            >
              {submitting ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  {t("reviewing")}
                </>
              ) : reviewAction === "APPROVED" ? (
                t("confirmApprove")
              ) : (
                t("confirmReject")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
