"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  Clock,
  MessageSquare,
  Loader2,
  Filter,
} from "lucide-react"
import { ATTENDANCE_STATUS, CLAIM_STATUS } from "@/lib/constants"
import { useToast } from "@/components/ui/toast"

interface AttendanceRecord {
  _id: string
  date: string
  sessionName: string
  teacher: string
  dayName: string
  startTime: string
  endTime: string
  status: string
  checkInTime: string | null
  attendanceId: string | null
  notes: string | null
  hasClaim: boolean
  claimStatus: string | null
  claimId: string | null
}

interface AttendanceStats {
  total: number
  present: number
  late: number
  absent: number
  justified: number
  rate: number
}

const statusConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  [ATTENDANCE_STATUS.PRESENT]: {
    label: 'حاضر',
    icon: <CheckCircle2 className="h-5 w-5" />,
    className: 'bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-800'
  },
  [ATTENDANCE_STATUS.LATE]: {
    label: 'متأخر',
    icon: <AlertCircle className="h-5 w-5" />,
    className: 'bg-amber-500/10 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-800'
  },
  [ATTENDANCE_STATUS.ABSENT]: {
    label: 'غائب',
    icon: <XCircle className="h-5 w-5" />,
    className: 'bg-red-500/10 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-800'
  },
  [ATTENDANCE_STATUS.JUSTIFIED_ABSENCE]: {
    label: 'غياب مبرر',
    icon: <Info className="h-5 w-5" />,
    className: 'bg-blue-500/10 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-800'
  }
}

export default function StudentAttendance() {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [stats, setStats] = useState<AttendanceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState("all")
  const [claimDialogOpen, setClaimDialogOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null)
  const [claimReason, setClaimReason] = useState("")
  const [submittingClaim, setSubmittingClaim] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchAttendance()
  }, [filter])

  const fetchAttendance = async () => {
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filter !== "all") params.set("status", filter)
      
      const res = await fetch(`/api/student/attendance?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setRecords(data.records)
        setStats(data.stats)
      } else {
        const errData = await res.json().catch(() => null)
        setError(errData?.message || "حدث خطأ أثناء تحميل البيانات")
      }
    } catch (err) {
      console.error("Error:", err)
      setError("حدث خطأ في الاتصال بالخادم")
    } finally {
      setLoading(false)
    }
  }

  const handleClaim = (record: AttendanceRecord) => {
    setSelectedRecord(record)
    setClaimReason("")
    setClaimDialogOpen(true)
  }

  const submitClaim = async () => {
    if (!selectedRecord || !claimReason.trim()) return

    setSubmittingClaim(true)
    try {
      const res = await fetch("/api/student/attendance/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionOccurrenceId: selectedRecord._id,
          reason: claimReason.trim()
        })
      })

      const data = await res.json()

      if (res.ok) {
        toast({
          title: "تم تقديم الاعتراض",
          description: "سيتم مراجعته من قبل الإدارة",
        })
        setClaimDialogOpen(false)
        fetchAttendance()
      } else {
        toast({
          title: "خطأ",
          description: data.message,
          variant: "destructive"
        })
      }
    } catch {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تقديم الاعتراض",
        variant: "destructive"
      })
    } finally {
      setSubmittingClaim(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ar-TN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (timeStr: string) => {
    return new Date(timeStr).toLocaleTimeString('ar-TN', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12 space-y-3">
        <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground/40" />
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={() => { setLoading(true); fetchAttendance() }}>
          إعادة المحاولة
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <ClipboardCheck className="h-7 w-7 text-primary" />
          سجل الحضور
        </h1>
        <p className="text-muted-foreground mt-1">سجل تفصيلي لحضورك في الحلقات</p>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="card-lift">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{stats.rate}%</p>
              <p className="text-xs text-muted-foreground">نسبة الحضور</p>
            </CardContent>
          </Card>
          <Card className="card-lift">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.present}</p>
              <p className="text-xs text-muted-foreground">حاضر</p>
            </CardContent>
          </Card>
          <Card className="card-lift">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.late}</p>
              <p className="text-xs text-muted-foreground">متأخر</p>
            </CardContent>
          </Card>
          <Card className="card-lift">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.absent}</p>
              <p className="text-xs text-muted-foreground">غائب</p>
            </CardContent>
          </Card>
          <Card className="card-lift">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.justified}</p>
              <p className="text-xs text-muted-foreground">مبرر</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="تصفية حسب الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value={ATTENDANCE_STATUS.PRESENT}>حاضر</SelectItem>
            <SelectItem value={ATTENDANCE_STATUS.LATE}>متأخر</SelectItem>
            <SelectItem value={ATTENDANCE_STATUS.ABSENT}>غائب</SelectItem>
            <SelectItem value={ATTENDANCE_STATUS.JUSTIFIED_ABSENCE}>غياب مبرر</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Attendance Records */}
      <div className="space-y-3">
        {records.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardCheck className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-muted-foreground">لا توجد سجلات حضور</p>
            </CardContent>
          </Card>
        ) : (
          records.map((record) => {
            const config = statusConfig[record.status] || statusConfig[ATTENDANCE_STATUS.ABSENT]
            return (
              <Card key={record._id} className="overflow-hidden transition-all hover:shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Status Icon */}
                    <div className={`rounded-xl p-2.5 border ${config.className}`}>
                      {config.icon}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-foreground text-sm">{record.sessionName}</h4>
                        <Badge variant="outline" className={`text-xs ${config.className}`}>
                          {config.label}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{formatDate(record.date)}</span>
                        <span>{record.dayName}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {record.startTime} - {record.endTime}
                        </span>
                        {record.checkInTime && (
                          <span className="text-primary font-medium">
                            تسجيل: {formatTime(record.checkInTime)}
                          </span>
                        )}
                      </div>
                      {record.notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          {record.notes}
                        </p>
                      )}
                    </div>

                    {/* Claim Button */}
                    <div className="shrink-0">
                      {record.hasClaim ? (
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            record.claimStatus === CLAIM_STATUS.APPROVED 
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                              : record.claimStatus === CLAIM_STATUS.REJECTED
                                ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                          }`}
                        >
                          {record.claimStatus === CLAIM_STATUS.APPROVED ? 'تمت الموافقة' :
                           record.claimStatus === CLAIM_STATUS.REJECTED ? 'مرفوض' : 'قيد المراجعة'}
                        </Badge>
                      ) : (
                        (record.status === ATTENDANCE_STATUS.ABSENT || record.status === ATTENDANCE_STATUS.LATE) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleClaim(record)}
                            className="text-xs gap-1"
                          >
                            <MessageSquare className="h-3 w-3" />
                            اعتراض
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Claim Dialog */}
      <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تقديم اعتراض على الحضور</DialogTitle>
            <DialogDescription>
              {selectedRecord && (
                <span>
                  {selectedRecord.sessionName} — {formatDate(selectedRecord.date)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="reason">سبب الاعتراض</Label>
              <Textarea
                id="reason"
                value={claimReason}
                onChange={(e) => setClaimReason(e.target.value)}
                placeholder="مثال: نسيت بطاقتي ولكنني كنت حاضراً في الحصة..."
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">{claimReason.length}/500</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClaimDialogOpen(false)}>
              إلغاء
            </Button>
            <Button 
              onClick={submitClaim} 
              disabled={!claimReason.trim() || submittingClaim}
            >
              {submittingClaim ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري الإرسال...
                </>
              ) : (
                "تقديم الاعتراض"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
