"use client"

import { useState, useEffect } from "react"
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
  const [claims, setClaims] = useState<Claim[]>([])
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
  }, [statusFilter])

  const fetchClaims = async () => {
    try {
      const res = await fetch(`/api/admin/claims?status=${statusFilter}`)
      if (res.ok) {
        const data = await res.json()
        setClaims(data.claims)
        setStats(data.stats)
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
        toast({ title: "تمت المراجعة", description: data.message })
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
            قيد الانتظار
          </Badge>
        )
      case "APPROVED":
        return (
          <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20">
            <CheckCircle2 className="h-3 w-3 ml-1" />
            مقبول
          </Badge>
        )
      case "REJECTED":
        return (
          <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50 dark:bg-red-900/20">
            <XCircle className="h-3 w-3 ml-1" />
            مرفوض
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
          إدارة الاعتراضات
        </h1>
        <p className="text-muted-foreground mt-1">مراجعة اعتراضات الحضور المقدمة من الطلاب</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground mt-1">إجمالي الاعتراضات</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 dark:border-amber-800/40">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
            <p className="text-xs text-muted-foreground mt-1">قيد الانتظار</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 dark:border-emerald-800/40">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{stats.approved}</p>
            <p className="text-xs text-muted-foreground mt-1">مقبول</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-800/40">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
            <p className="text-xs text-muted-foreground mt-1">مرفوض</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Label>حالة الاعتراض:</Label>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setLoading(true); }}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="PENDING">قيد الانتظار</SelectItem>
            <SelectItem value="APPROVED">مقبول</SelectItem>
            <SelectItem value="REJECTED">مرفوض</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Claims List */}
      <div className="space-y-3">
        {claims.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-muted-foreground">لا توجد اعتراضات</p>
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
                      <p><span className="font-medium">الحلقة:</span> {claim.sessionName || "—"}</p>
                      <p><span className="font-medium">التاريخ:</span> {formatDate(claim.date)}</p>
                      <p><span className="font-medium">السبب:</span> {claim.reason}</p>
                      {claim.reviewNotes && (
                        <p><span className="font-medium">ملاحظات المراجعة:</span> {claim.reviewNotes}</p>
                      )}
                      {claim.reviewedBy && (
                        <p className="text-xs">
                          <span className="font-medium">راجع بواسطة:</span> {claim.reviewedBy} - {claim.reviewedAt ? formatDate(claim.reviewedAt) : ""}
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
                        قبول
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1"
                        onClick={() => openReviewDialog(claim, "REJECTED")}
                      >
                        <XCircle className="h-4 w-4" />
                        رفض
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "APPROVED" ? "قبول الاعتراض" : "رفض الاعتراض"}
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
              <Label>ملاحظات المراجعة (اختياري)</Label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="أضف ملاحظات على قرارك..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={submitReview}
              disabled={submitting}
              variant={reviewAction === "REJECTED" ? "destructive" : "default"}
            >
              {submitting ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري المراجعة...
                </>
              ) : reviewAction === "APPROVED" ? (
                "تأكيد القبول"
              ) : (
                "تأكيد الرفض"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
