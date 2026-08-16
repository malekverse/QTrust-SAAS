"use client"

import { use, useState, useMemo } from "react"
import { useTranslations } from "next-intl"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowRight,
  Search,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Loader2,
  Edit,
  CreditCard,
  DoorOpen,
  BookOpen,
  Heart,
} from "lucide-react"
import { getDayName, getAttendanceStatusLabel, getAttendanceStatusColor, formatDate } from "@/lib/utils"
import { ATTENDANCE_STATUS } from "@/lib/constants"
import { useToast } from "@/components/ui/toast"
import { HifzEntry } from "./hifz-entry"
import { BehaviorEntry } from "./behavior-entry"

interface AttendanceData {
  session: {
    _id: string
    name: string
    teacherId: { fullName: string }
    roomId?: { name: string; capacity: number; location?: string }
    dayOfWeek: number
    startTime: string
    endTime: string
  }
  occurrence: {
    _id: string
    date: string
    status: string
  }
  students: Array<{
    _id: string
    fullName: string
    parentName?: string
    status: string
    checkInTime?: string
    notes?: string
    attendanceId?: string
  }>
  stats: {
    total: number
    present: number
    late: number
    absent: number
    justified: number
  }
}

async function fetchAttendance(sessionId: string, date?: string): Promise<AttendanceData> {
  const url = date 
    ? `/api/sessions/${sessionId}/attendance?date=${date}`
    : `/api/sessions/${sessionId}/attendance`
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to fetch attendance")
  return res.json()
}

async function updateAttendance(
  sessionId: string,
  data: { studentId: string; occurrenceId: string; status: string; notes?: string }
) {
  const res = await fetch(`/api/sessions/${sessionId}/attendance`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update attendance")
  return res.json()
}

export default function TeacherSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const t = useTranslations("teacher.sessions")
  const tc = useTranslations("common")
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const [search, setSearch] = useState("")
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0])
  const [editingStudent, setEditingStudent] = useState<AttendanceData["students"][0] | null>(null)
  const [editStatus, setEditStatus] = useState("")
  const [editNotes, setEditNotes] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["session-attendance", id, selectedDate],
    queryFn: () => fetchAttendance(id, selectedDate),
  })

  const studentIds = useMemo(
    () => data?.students.map((s) => s._id) || [],
    [data?.students]
  )

  const { data: paymentStatus } = useQuery({
    queryKey: ["payment-status", studentIds],
    queryFn: async () => {
      if (studentIds.length === 0) return {}
      const res = await fetch(
        `/api/payments/status?studentIds=${studentIds.join(",")}`
      )
      if (!res.ok) return {}
      return res.json() as Promise<Record<string, boolean>>
    },
    enabled: studentIds.length > 0,
  })

  const mutation = useMutation({
    mutationFn: (updateData: { studentId: string; occurrenceId: string; status: string; notes?: string }) =>
      updateAttendance(id, updateData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-attendance", id, selectedDate] })
      setEditingStudent(null)
      success(tc("success"), t("takeAttendance"))
    },
    onError: (err: Error) => {
      error(tc("error"), err.message || tc("serverError"))
    },
  })

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case ATTENDANCE_STATUS.PRESENT:
        return <CheckCircle className="h-5 w-5 text-emerald-600" />
      case ATTENDANCE_STATUS.LATE:
        return <Clock className="h-5 w-5 text-amber-600" />
      case ATTENDANCE_STATUS.ABSENT:
        return <XCircle className="h-5 w-5 text-red-600" />
      case ATTENDANCE_STATUS.JUSTIFIED_ABSENCE:
        return <AlertCircle className="h-5 w-5 text-blue-600" />
      default:
        return null
    }
  }

  const filteredStudents = data?.students.filter((s) =>
    s.fullName.toLowerCase().includes(search.toLowerCase())
  )

  const handleEditClick = (student: AttendanceData["students"][0]) => {
    setEditingStudent(student)
    setEditStatus(student.status)
    setEditNotes(student.notes || "")
  }

  const handleSaveAttendance = () => {
    if (!editingStudent || !data?.occurrence) return
    
    mutation.mutate({
      studentId: editingStudent._id,
      occurrenceId: data.occurrence._id,
      status: editStatus,
      notes: editNotes,
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!data) {
    return <div>{tc("noData")}</div>
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" asChild>
        <Link href="/teacher/sessions">
          <ArrowRight className="ml-2 h-4 w-4" />
          {tc("back")}
        </Link>
      </Button>

      {/* Header */}
      <PageHeader
        title={data.session.name}
        description={`${getDayName(data.session.dayOfWeek)} • ${data.session.startTime} - ${data.session.endTime}`}
      >
        {data.session.roomId && (
          <Badge variant="outline" className="text-sm">
            <DoorOpen className="h-3.5 w-3.5 ml-1" />
            {data.session.roomId.name}
            <span className="text-muted-foreground mr-1">
              ({data.stats.total}/{data.session.roomId.capacity})
            </span>
          </Badge>
        )}
      </PageHeader>

      {/* Date Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-auto"
              dir="ltr"
            />
            <span className="text-muted-foreground">
              {formatDate(selectedDate)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Users className="h-5 w-5 text-blue-700 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.stats.total}</p>
              <p className="text-xs text-muted-foreground">{tc("total")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <CheckCircle className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.stats.present}</p>
              <p className="text-xs text-muted-foreground">{tc("present")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <Clock className="h-5 w-5 text-amber-700 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.stats.late}</p>
              <p className="text-xs text-muted-foreground">{tc("late")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/20">
              <XCircle className="h-5 w-5 text-red-700 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.stats.absent}</p>
              <p className="text-xs text-muted-foreground">{tc("absent")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance, Hifz & Behavior Tabs */}
      <Tabs defaultValue="attendance">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="attendance" className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {t("takeAttendance")}
          </TabsTrigger>
          <TabsTrigger value="hifz" className="flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" />
            التسميع
          </TabsTrigger>
          <TabsTrigger value="behavior" className="flex items-center gap-1.5">
            <Heart className="h-4 w-4" />
            السلوك
          </TabsTrigger>
        </TabsList>

        {/* Attendance Tab */}
        <TabsContent value="attendance" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">{t("takeAttendance")}</CardTitle>
              <div className="relative w-64">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={tc("searchPlaceholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              <TooltipProvider>
                <div className="space-y-2">
                  {filteredStudents?.map((student) => {
                    const isPaid = paymentStatus?.[student._id]
                    return (
                      <div
                        key={student._id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {getStatusIcon(student.status)}
                          <Avatar>
                            <AvatarFallback>{getInitials(student.fullName)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{student.fullName}</p>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                      isPaid
                                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                        : "bg-red-500/15 text-red-700 dark:text-red-400"
                                    }`}
                                  >
                                    <CreditCard className="h-3 w-3" />
                                    {isPaid ? tc("paid") : tc("unpaid")}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {isPaid
                                    ? tc("paid")
                                    : tc("unpaid")}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            {student.checkInTime && (
                              <p className="text-xs text-muted-foreground" dir="ltr">
                                {new Date(student.checkInTime).toLocaleTimeString("ar-TN", {
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getAttendanceStatusColor(student.status)}>
                            {getAttendanceStatusLabel(student.status)}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditClick(student)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </TooltipProvider>
            </CardContent>
          </Card>

          {/* Edit Attendance Dialog */}
          <Dialog open={!!editingStudent} onOpenChange={() => setEditingStudent(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{tc("edit")}</DialogTitle>
                <DialogDescription>
                  {editingStudent?.fullName}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{tc("status")}</label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ATTENDANCE_STATUS.PRESENT}>{tc("present")}</SelectItem>
                      <SelectItem value={ATTENDANCE_STATUS.LATE}>{tc("late")}</SelectItem>
                      <SelectItem value={ATTENDANCE_STATUS.ABSENT}>{tc("absent")}</SelectItem>
                      <SelectItem value={ATTENDANCE_STATUS.JUSTIFIED_ABSENCE}>{tc("excused")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{tc("notes")}</label>
                  <Textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="ملاحظات اختيارية..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingStudent(null)}>
                  {tc("cancel")}
                </Button>
                <Button onClick={handleSaveAttendance} disabled={mutation.isPending}>
                  {mutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  {tc("save")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Hifz Tab */}
        <TabsContent value="hifz" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                تسجيل التسميع
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.occurrence?._id ? (
                <HifzEntry
                  sessionId={id}
                  occurrenceId={data.occurrence._id}
                  students={data.students.map((s) => ({ _id: s._id, fullName: s.fullName }))}
                  selectedDate={selectedDate}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p>لا توجد حصة في هذا التاريخ</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Behavior Tab */}
        <TabsContent value="behavior" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Heart className="h-5 w-5" />
                الملاحظات السلوكية
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.occurrence?._id ? (
                <BehaviorEntry
                  sessionId={id}
                  occurrenceId={data.occurrence._id}
                  students={data.students.map((s) => ({ _id: s._id, fullName: s.fullName }))}
                  selectedDate={selectedDate}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Heart className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p>لا توجد حصة في هذا التاريخ</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

