"use client"

import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Search,
  CreditCard,
  Users,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Phone,
  TrendingUp,
  CircleDollarSign,
  Receipt,
  MessageCircle,
  ImageIcon,
} from "lucide-react"
import { useToast } from "@/components/ui/toast"
import { FileUpload } from "@/components/ui/file-upload"
import { useTranslations } from "next-intl"

interface StudentPayment {
  _id: string
  firstName: string
  lastName: string
  fullName?: string
  displayName: string
  phone?: string
  enrollmentNumber?: string
  isPaid: boolean
  paidAt?: string
  amount?: number
  notes?: string
  receiptPhotoUrl?: string
  markedBy?: { fullName: string }
  paymentId?: string
}

interface PaymentResponse {
  students: StudentPayment[]
  stats: {
    total: number
    paid: number
    unpaid: number
    rate: number
  }
  period: { month: number; year: number }
}

async function fetchPayments(month: number, year: number): Promise<PaymentResponse> {
  const res = await fetch(`/api/payments?month=${month}&year=${year}`)
  if (!res.ok) throw new Error("Failed to fetch payments")
  return res.json()
}

async function togglePayment(data: {
  studentId: string
  month: number
  year: number
  isPaid: boolean
  amount?: number
  notes?: string
  receiptPhotoUrl?: string
}) {
  const res = await fetch("/api/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update payment")
  return res.json()
}

async function bulkUpdatePayments(data: {
  studentIds: string[]
  month: number
  year: number
  isPaid: boolean
}) {
  const res = await fetch("/api/payments/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to bulk update")
  return res.json()
}

export default function SubscriptionsPage() {
  const t = useTranslations("admin.subscriptions")
  const tc = useTranslations("common")
  const queryClient = useQueryClient()
  const { success, error: toastError } = useToast()

  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<"all" | "paid" | "unpaid">("all")
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [paymentStudent, setPaymentStudent] = useState<StudentPayment | null>(null)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentNotes, setPaymentNotes] = useState("")
  const [paymentReceiptUrl, setPaymentReceiptUrl] = useState<string | undefined>(undefined)

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["payments", selectedMonth, selectedYear],
    queryFn: () => fetchPayments(selectedMonth, selectedYear),
  })

  // Payment reminders are opt-in; only show the reminder action when enabled.
  const { data: remindersEnabled } = useQuery({
    queryKey: ["payment-reminders-enabled"],
    queryFn: async () => {
      const res = await fetch("/api/settings/messaging")
      if (!res.ok) return false
      const cfg = await res.json()
      return !!cfg.paymentRemindersEnabled
    },
  })

  const paymentMutation = useMutation({
    mutationFn: togglePayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments", selectedMonth, selectedYear] })
      setPaymentDialogOpen(false)
      setPaymentStudent(null)
      setPaymentAmount("")
      setPaymentNotes("")
      setPaymentReceiptUrl(undefined)
      success(t("updated"), t("paymentStatusUpdated"))
    },
    onError: () => {
      toastError(t("error"), t("paymentUpdateError"))
    },
  })

  const bulkMutation = useMutation({
    mutationFn: bulkUpdatePayments,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["payments", selectedMonth, selectedYear] })
      setSelectedStudents(new Set())
      success(t("updated"), result.message)
    },
    onError: () => {
      toastError(t("error"), t("bulkUpdateError"))
    },
  })

  const remindMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const res = await fetch("/api/payments/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, month: selectedMonth, year: selectedYear }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || t("reminderSendFailed"))
      return data as { status: string; error?: string }
    },
    onSuccess: (data) => {
      if (data.status === "SENT") {
        success(t("sent"), t("reminderSentToParent"))
      } else if (data.status === "SKIPPED") {
        toastError(t("notEnabled"), t("messagingProviderDisabled"))
      } else {
        toastError(t("sendFailed"), data.error || t("messageSendError"))
      }
    },
    onError: (err: Error) => toastError(t("error"), err.message),
  })

  const { filteredStudents, stats } = useMemo(() => {
    if (!data) return { filteredStudents: [], stats: { total: 0, paid: 0, unpaid: 0, rate: 0 } }

    let filtered = data.students

    if (activeTab === "paid") {
      filtered = filtered.filter(s => s.isPaid)
    } else if (activeTab === "unpaid") {
      filtered = filtered.filter(s => !s.isPaid)
    }

    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(student =>
        student.displayName.toLowerCase().includes(searchLower) ||
        student.phone?.includes(search) ||
        student.enrollmentNumber?.includes(search)
      )
    }

    return { filteredStudents: filtered, stats: data.stats }
  }, [data, search, activeTab])

  const getInitials = (student: StudentPayment) => {
    if (student.firstName && student.lastName) {
      return `${student.firstName[0]}${student.lastName[0]}`.toUpperCase()
    }
    return student.displayName?.slice(0, 2).toUpperCase() || tc("unknownInitial")
  }

  const handleQuickToggle = (student: StudentPayment) => {
    if (!student.isPaid) {
      setPaymentStudent(student)
      setPaymentAmount("")
      setPaymentNotes("")
      setPaymentReceiptUrl(undefined)
      setPaymentDialogOpen(true)
    } else {
      paymentMutation.mutate({
        studentId: student._id,
        month: selectedMonth,
        year: selectedYear,
        isPaid: false,
      })
    }
  }

  const handleConfirmPayment = () => {
    if (!paymentStudent) return
    paymentMutation.mutate({
      studentId: paymentStudent._id,
      month: selectedMonth,
      year: selectedYear,
      isPaid: true,
      amount: paymentAmount ? parseFloat(paymentAmount) : undefined,
      notes: paymentNotes || undefined,
      receiptPhotoUrl: paymentReceiptUrl,
    })
  }

  const handleBulkPaid = () => {
    if (selectedStudents.size === 0) return
    bulkMutation.mutate({
      studentIds: Array.from(selectedStudents),
      month: selectedMonth,
      year: selectedYear,
      isPaid: true,
    })
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const unpaidIds = filteredStudents.filter(s => !s.isPaid).map(s => s._id)
      setSelectedStudents(new Set(unpaidIds))
    } else {
      setSelectedStudents(new Set())
    }
  }

  const handleSelectStudent = (studentId: string, checked: boolean) => {
    const next = new Set(selectedStudents)
    if (checked) {
      next.add(studentId)
    } else {
      next.delete(studentId)
    }
    setSelectedStudents(next)
  }

  const navigateMonth = (direction: number) => {
    let newMonth = selectedMonth + direction
    let newYear = selectedYear
    if (newMonth > 12) {
      newMonth = 1
      newYear++
    } else if (newMonth < 1) {
      newMonth = 12
      newYear--
    }
    setSelectedMonth(newMonth)
    setSelectedYear(newYear)
    setSelectedStudents(new Set())
  }

  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
      >
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ml-2 ${isFetching ? "animate-spin" : ""}`} />
            {tc("refresh")}
          </Button>
        </div>
      </PageHeader>

      {/* Month / Year Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
              <ChevronRight className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <Select
                value={String(selectedMonth)}
                onValueChange={(v) => {
                  setSelectedMonth(parseInt(v))
                  setSelectedStudents(new Set())
                }}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({length: 12}, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {tc('months.' + m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(selectedYear)}
                onValueChange={(v) => {
                  setSelectedYear(parseInt(v))
                  setSelectedStudents(new Set())
                }}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card
          className={`cursor-pointer transition-all ${activeTab === "all" ? "ring-2 ring-primary" : "hover:border-primary/50"}`}
          onClick={() => setActiveTab("all")}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Users className="h-5 w-5 text-blue-700 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">{t("totalDue")}</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${activeTab === "paid" ? "ring-2 ring-primary" : "hover:border-primary/50"}`}
          onClick={() => setActiveTab("paid")}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <CheckCircle className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.paid}</p>
              <p className="text-xs text-muted-foreground">{t("totalPaid")}</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${activeTab === "unpaid" ? "ring-2 ring-primary" : "hover:border-primary/50"}`}
          onClick={() => setActiveTab("unpaid")}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/20">
              <XCircle className="h-5 w-5 text-red-700 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.unpaid}</p>
              <p className="text-xs text-muted-foreground">{t("totalPending")}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:border-primary/50 transition-all">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <TrendingUp className="h-5 w-5 text-purple-700 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.rate}%</p>
              <p className="text-xs text-muted-foreground">{t("collectionRate")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Bulk Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10"
              />
            </div>
            <div className="flex gap-2 items-center">
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as typeof activeTab)}
                className="w-auto"
              >
                <TabsList className="grid grid-cols-3">
                  <TabsTrigger value="all">{tc("all")}</TabsTrigger>
                  <TabsTrigger value="paid">{tc("paid")}</TabsTrigger>
                  <TabsTrigger value="unpaid">{tc("unpaid")}</TabsTrigger>
                </TabsList>
              </Tabs>
              {selectedStudents.size > 0 && (
                <Button
                  size="sm"
                  onClick={handleBulkPaid}
                  disabled={bulkMutation.isPending}
                >
                  {bulkMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  <CircleDollarSign className="ml-2 h-4 w-4" />
                  {t("confirmBulkPayment")} ({selectedStudents.size})
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-50" />
              {search ? (
                <>
                  <p className="font-medium">{t("noSearchResults")}</p>
                  <p className="text-sm mt-1">{t("tryDifferentSearch")}</p>
                  <Button variant="outline" className="mt-4" onClick={() => setSearch("")}>
                    {t("clearSearch")}
                  </Button>
                </>
              ) : activeTab === "unpaid" ? (
                <>
                  <CheckCircle className="h-12 w-12 mx-auto mb-3 text-emerald-500 opacity-70" />
                  <p className="font-medium text-emerald-600">{t("allPaidThisMonth")}</p>
                  <p className="text-sm mt-1">{t("allPaidCongrats")}</p>
                </>
              ) : (
                <p className="font-medium">{t("noStudentsRegistered")}</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={
                        filteredStudents.filter(s => !s.isPaid).length > 0 &&
                        filteredStudents
                          .filter(s => !s.isPaid)
                          .every(s => selectedStudents.has(s._id))
                      }
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>{tc("name")}</TableHead>
                  <TableHead className="hidden sm:table-cell">{tc("phone")}</TableHead>
                  <TableHead className="hidden md:table-cell">{tc("details")}</TableHead>
                  <TableHead>{tc("status")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{tc("date")}</TableHead>
                  <TableHead className="w-[200px]">{tc("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow
                    key={student._id}
                    className={`group ${!student.isPaid ? "bg-red-50/30 dark:bg-red-950/10" : ""}`}
                  >
                    <TableCell>
                      {!student.isPaid && (
                        <Checkbox
                          checked={selectedStudents.has(student._id)}
                          onCheckedChange={(checked) =>
                            handleSelectStudent(student._id, !!checked)
                          }
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="border-2 border-background shadow-sm">
                          <AvatarFallback className="bg-primary/10 text-primary font-medium">
                            {getInitials(student)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{student.displayName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {student.phone ? (
                        <a
                          href={`tel:${student.phone}`}
                          className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                          dir="ltr"
                        >
                          <Phone className="h-3 w-3" />
                          {student.phone.replace("+216", "+216 ")}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {student.enrollmentNumber || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={student.isPaid ? "success" : "destructive"}
                        className="font-normal"
                      >
                        {student.isPaid ? tc("paid") : tc("unpaid")}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                      {student.isPaid && student.paidAt
                        ? new Date(student.paidAt).toLocaleDateString("ar-TN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant={student.isPaid ? "outline" : "default"}
                          size="sm"
                          onClick={() => handleQuickToggle(student)}
                          disabled={paymentMutation.isPending}
                          className={
                            student.isPaid
                              ? ""
                              : "bg-emerald-600 hover:bg-emerald-700 text-white"
                          }
                        >
                          {paymentMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : student.isPaid ? (
                            <>
                              <XCircle className="ml-1 h-4 w-4" />
                              {tc("cancel")}
                            </>
                          ) : (
                            <>
                              <CheckCircle className="ml-1 h-4 w-4" />
                              {t("markPaid")}
                            </>
                          )}
                        </Button>
                        {student.isPaid && student.receiptPhotoUrl && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t("viewReceipt")}
                            onClick={() => window.open(student.receiptPhotoUrl, "_blank")}
                          >
                            <ImageIcon className="h-4 w-4" />
                          </Button>
                        )}
                        {student.isPaid && student.paymentId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t("printReceipt")}
                            onClick={() =>
                              window.open(`/receipt/payment/${student.paymentId}`, "_blank")
                            }
                          >
                            <Receipt className="h-4 w-4" />
                          </Button>
                        )}
                        {!student.isPaid && remindersEnabled && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t("sendReminderToParent")}
                            disabled={
                              remindMutation.isPending && remindMutation.variables === student._id
                            }
                            onClick={() => remindMutation.mutate(student._id)}
                          >
                            {remindMutation.isPending && remindMutation.variables === student._id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MessageCircle className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Results Count */}
      {!isLoading && filteredStudents.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          {t("showingResults", { shown: filteredStudents.length, total: stats.total })} —{" "}
          {tc('months.' + selectedMonth)} {selectedYear}
        </p>
      )}

      {/* Payment Confirmation Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CircleDollarSign className="h-5 w-5 text-emerald-600" />
              {t("confirmPaymentTitle")}
            </DialogTitle>
            <DialogDescription>
              {paymentStudent && (
                <span>
                  {t("confirmPaymentDesc", { name: paymentStudent.displayName, month: tc('months.' + selectedMonth), year: selectedYear })}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{tc("amount")} ({tc("optional")})</Label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder={t("amountPlaceholder")}
                dir="ltr"
                min="0"
                step="0.5"
              />
            </div>
            <div className="space-y-2">
              <Label>{tc("notes")} ({tc("optional")})</Label>
              <Textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder={t("notesPlaceholder")}
                className="resize-none"
              />
            </div>
            <FileUpload
              label={t("receiptPhotoLabel")}
              uploadType="receipt"
              accept="image/*,application/pdf"
              maxSize={10}
              value={paymentReceiptUrl}
              onChange={setPaymentReceiptUrl}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              onClick={handleConfirmPayment}
              disabled={paymentMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {paymentMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              {t("markPaid")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
