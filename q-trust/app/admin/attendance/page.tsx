"use client"

import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { 
  Calendar,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  Download,
  Printer,
  MoreVertical,
  CheckCheck,
  UserX,
  CalendarDays,
  TrendingUp,
  RefreshCw,
  CreditCard
} from "lucide-react"
import { getAttendanceStatusLabel, getDayName } from "@/lib/utils"
import { ATTENDANCE_STATUS } from "@/lib/constants"
import { useToast } from "@/components/ui/toast"
import { useTranslations } from "next-intl"

interface StudentAttendance {
  _id: string
  firstName?: string
  lastName?: string
  fullName?: string
  displayName?: string
  phone?: string
  gender?: 'MALE' | 'FEMALE'
  status: string
  checkInTime?: string
  attendanceId?: string
  notes?: string
}

interface SessionWithAttendance {
  _id: string
  name: string
  teacher: { _id: string; fullName: string }
  startTime: string
  endTime: string
  occurrenceId?: string
  students: StudentAttendance[]
  stats: {
    total: number
    present: number
    late: number
    absent: number
    justified: number
  }
}

interface AttendanceByDate {
  date: string
  dayOfWeek: number
  sessions: SessionWithAttendance[]
}

async function fetchAttendanceByDate(date: string): Promise<AttendanceByDate> {
  const res = await fetch(`/api/attendance/by-date?date=${date}`)
  if (!res.ok) throw new Error("Failed to fetch attendance")
  return res.json()
}

async function updateAttendance(sessionTemplateId: string, studentId: string, date: string, status: string) {
  const res = await fetch(`/api/attendance/${sessionTemplateId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentId, date, status }),
  })
  if (!res.ok) throw new Error("Failed to update attendance")
  return res.json() as Promise<{
    _id: string
    status: string
    checkInTime?: string | null
  }>
}

/** Match GET /api/attendance/by-date stats shape (present includes late). */
function statsForStudents(students: StudentAttendance[]): SessionWithAttendance["stats"] {
  const total = students.length
  const present = students.filter(
    (s) => s.status === ATTENDANCE_STATUS.PRESENT || s.status === ATTENDANCE_STATUS.LATE
  ).length
  const late = students.filter((s) => s.status === ATTENDANCE_STATUS.LATE).length
  const absent = students.filter((s) => s.status === ATTENDANCE_STATUS.ABSENT).length
  const justified = students.filter((s) => s.status === ATTENDANCE_STATUS.JUSTIFIED_ABSENCE).length
  return { total, present, late, absent, justified }
}

function mergeAttendanceIntoByDate(
  old: AttendanceByDate | undefined,
  sessionId: string,
  studentId: string,
  attendance: { _id: string; status: string; checkInTime?: string | null }
): AttendanceByDate | undefined {
  if (!old) return old
  return {
    ...old,
    sessions: old.sessions.map((session) => {
      if (session._id !== sessionId) return session
      const students = session.students.map((st) => {
        if (st._id !== studentId) return st
        const raw = attendance.checkInTime
        let checkInTime: string | undefined
        if (raw != null && raw !== "") {
          checkInTime = typeof raw === "string" ? raw : new Date(raw as Date).toISOString()
        } else if (
          attendance.status === ATTENDANCE_STATUS.PRESENT ||
          attendance.status === ATTENDANCE_STATUS.LATE
        ) {
          checkInTime = st.checkInTime
        } else {
          checkInTime = undefined
        }
        return {
          ...st,
          status: attendance.status,
          attendanceId: String(attendance._id),
          checkInTime,
        }
      })
      return { ...session, students, stats: statsForStudents(students) }
    }),
  }
}

// Mini Calendar Component
function MiniCalendar({ 
  selectedDate, 
  onDateChange 
}: { 
  selectedDate: string
  onDateChange: (date: string) => void 
}) {
  const [viewDate, setViewDate] = useState(() => new Date(selectedDate))
  
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()
    return { daysInMonth, startingDay }
  }

  const { daysInMonth, startingDay } = getDaysInMonth(viewDate)
  const today = new Date().toISOString().split("T")[0]

  const handlePrevMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const handleDayClick = (day: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day)
    onDateChange(newDate.toISOString().split("T")[0])
  }

  const weekDays = ["أح", "إث", "ثل", "أر", "خم", "جم", "سب"]

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrevMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="font-medium text-sm">
          {viewDate.toLocaleDateString("ar-TN", { month: "long", year: "numeric" })}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNextMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {weekDays.map(day => (
          <div key={day} className="text-xs text-muted-foreground font-medium py-1">
            {day}
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startingDay }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dateStr = new Date(viewDate.getFullYear(), viewDate.getMonth(), day).toISOString().split("T")[0]
          const isSelected = dateStr === selectedDate
          const isToday = dateStr === today
          
          return (
            <button
              key={day}
              onClick={() => handleDayClick(day)}
              className={`
                h-8 w-8 rounded-full text-sm transition-colors
                ${isSelected 
                  ? "bg-primary text-primary-foreground font-bold" 
                  : isToday 
                    ? "bg-primary/20 text-primary font-medium"
                    : "hover:bg-muted"
                }
              `}
            >
              {day}
            </button>
          )
        })}
      </div>
      
      <div className="mt-3 pt-3 border-t">
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full"
          onClick={() => {
            const todayDate = new Date()
            setViewDate(todayDate)
            onDateChange(todayDate.toISOString().split("T")[0])
          }}
        >
          <CalendarDays className="h-4 w-4 ml-2" />
          اليوم
        </Button>
      </div>
    </div>
  )
}

export default function AttendancePage() {
  const t = useTranslations("admin.attendance")
  const tc = useTranslations("common")
  const queryClient = useQueryClient()
  const { success, error: showError } = useToast()
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split("T")[0]
  })
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({})
  const [savingStudent, setSavingStudent] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [showCalendar, setShowCalendar] = useState(false)
  const [bulkLoading, setBulkLoading] = useState<string | null>(null)

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["attendance-by-date", selectedDate],
    queryFn: () => fetchAttendanceByDate(selectedDate),
    retry: 3,
    retryDelay: 1000,
    staleTime: 30000,
  })

  const allStudentIds = useMemo(() => {
    if (!data?.sessions) return []
    const ids = new Set<string>()
    data.sessions.forEach(s => s.students.forEach(st => ids.add(st._id)))
    return Array.from(ids)
  }, [data?.sessions])

  const { data: paymentStatus } = useQuery({
    queryKey: ["payment-status-attendance", allStudentIds],
    queryFn: async () => {
      if (allStudentIds.length === 0) return {}
      const res = await fetch(`/api/payments/status?studentIds=${allStudentIds.join(",")}`)
      if (!res.ok) return {}
      return res.json() as Promise<Record<string, boolean>>
    },
    enabled: allStudentIds.length > 0,
  })

  const updateMutation = useMutation({
    mutationFn: ({ sessionId, studentId, status }: { sessionId: string; studentId: string; status: string }) =>
      updateAttendance(sessionId, studentId, selectedDate, status),
    onSuccess: (attendance, { sessionId, studentId }) => {
      // Sync patch so the Select does not snap back to stale cache before refetch completes
      queryClient.setQueryData<AttendanceByDate | undefined>(
        ["attendance-by-date", selectedDate],
        (old) => mergeAttendanceIntoByDate(old, sessionId, studentId, attendance)
      )
      void queryClient.invalidateQueries({ queryKey: ["attendance-by-date", selectedDate] })
    },
    onError: (err: Error) => {
      showError("فشل التحديث", err.message || "حدث خطأ أثناء تحديث الحضور")
    },
  })

  const handleDateChange = (offset: number) => {
    const current = new Date(selectedDate)
    current.setDate(current.getDate() + offset)
    setSelectedDate(current.toISOString().split("T")[0])
  }

  const handleStatusChange = async (sessionId: string, studentId: string, status: string) => {
    const key = `${sessionId}-${studentId}`
    setPendingChanges(prev => ({ ...prev, [key]: status }))
    setSavingStudent(key)
    
    try {
      await updateMutation.mutateAsync({ sessionId, studentId, status })
      setPendingChanges(prev => {
        const newChanges = { ...prev }
        delete newChanges[key]
        return newChanges
      })
    } finally {
      setSavingStudent(null)
    }
  }

  const handleBulkAction = async (sessionId: string, status: string, students: StudentAttendance[]) => {
    setBulkLoading(sessionId)
    try {
      // Sequential so each onSuccess cache patch sees the previous student updates
      for (const student of students) {
        await updateMutation.mutateAsync({ sessionId, studentId: student._id, status })
      }
    } finally {
      setBulkLoading(null)
    }
  }

  const handleExportCSV = () => {
    if (!data?.sessions) return
    
    const headers = ["الحصة", "الطالب", "الحالة", "وقت الحضور"]
    const rows: string[][] = []
    
    data.sessions.forEach(session => {
      session.students.forEach(student => {
        rows.push([
          session.name,
          getStudentName(student),
          getAttendanceStatusLabel(student.status),
          student.checkInTime 
            ? new Date(student.checkInTime).toLocaleTimeString("ar-TN", { hour: "2-digit", minute: "2-digit" })
            : "-"
        ])
      })
    })
    
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `حضور-${selectedDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getInitials = (student: StudentAttendance) => {
    if (student.firstName && student.lastName) {
      return `${student.firstName[0]}${student.lastName[0]}`.toUpperCase()
    }
    const name = student.displayName || student.fullName || ''
    return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
  }
  
  const getStudentName = (student: StudentAttendance) => {
    return student.displayName || student.fullName || `${student.firstName || ''} ${student.lastName || ''}`
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case ATTENDANCE_STATUS.PRESENT:
        return <CheckCircle className="h-4 w-4 text-emerald-600" />
      case ATTENDANCE_STATUS.LATE:
        return <Clock className="h-4 w-4 text-amber-600" />
      case ATTENDANCE_STATUS.ABSENT:
        return <XCircle className="h-4 w-4 text-red-600" />
      case ATTENDANCE_STATUS.JUSTIFIED_ABSENCE:
        return <XCircle className="h-4 w-4 text-blue-600" />
      default:
        return <XCircle className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case ATTENDANCE_STATUS.PRESENT:
        return "bg-emerald-500/10 border-emerald-500/20"
      case ATTENDANCE_STATUS.LATE:
        return "bg-amber-500/10 border-amber-500/20"
      case ATTENDANCE_STATUS.ABSENT:
        return "bg-red-500/10 border-red-500/20"
      case ATTENDANCE_STATUS.JUSTIFIED_ABSENCE:
        return "bg-blue-500/10 border-blue-500/20"
      default:
        return "bg-muted/50"
    }
  }

  // Filter students by search query
  const filteredSessions = useMemo(() => {
    if (!data?.sessions || !searchQuery.trim()) return data?.sessions || []
    
    return data.sessions.map(session => ({
      ...session,
      students: session.students.filter(student => {
        const name = getStudentName(student)
        return name.toLowerCase().includes(searchQuery.toLowerCase())
      })
    })).filter(session => session.students.length > 0)
  }, [data?.sessions, searchQuery])

  // Calculate overall stats
  const overallStats = useMemo(() => {
    if (!data?.sessions) return { total: 0, present: 0, late: 0, absent: 0, rate: 0 }
    
    const stats = data.sessions.reduce(
      (acc, session) => ({
        total: acc.total + session.stats.total,
        present: acc.present + session.stats.present,
        late: acc.late + session.stats.late,
        absent: acc.absent + session.stats.absent,
      }),
      { total: 0, present: 0, late: 0, absent: 0 }
    )
    
    const rate = stats.total > 0 
      ? Math.round(((stats.present + stats.late) / stats.total) * 100) 
      : 0
    
    return { ...stats, rate }
  }, [data?.sessions])

  const formattedDate = new Date(selectedDate).toLocaleDateString("ar-TN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  })

  const isToday = selectedDate === new Date().toISOString().split("T")[0]

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 ml-2" />
            طباعة
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!data?.sessions?.length}>
            <Download className="h-4 w-4 ml-2" />
            {tc("export")}
          </Button>
        </div>
      </PageHeader>

      {/* Date Selector & Search */}
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <Button variant="outline" size="icon" onClick={() => handleDateChange(-1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-4 flex-1 justify-center">
                <div className="relative">
                  <Button 
                    variant="ghost" 
                    className="flex items-center gap-2 text-lg font-medium"
                    onClick={() => setShowCalendar(!showCalendar)}
                  >
                    <Calendar className="h-5 w-5 text-primary" />
                    <span>{formattedDate}</span>
                    {isToday && (
                      <Badge variant="secondary" className="text-xs">اليوم</Badge>
                    )}
                  </Button>
                  
                  {showCalendar && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setShowCalendar(false)} 
                      />
                      <Card className="absolute top-full mt-2 right-0 z-50 w-72 shadow-lg">
                        <MiniCalendar 
                          selectedDate={selectedDate} 
                          onDateChange={(date) => {
                            setSelectedDate(date)
                            setShowCalendar(false)
                          }} 
                        />
                      </Card>
                    </>
                  )}
                </div>
                
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-40"
                  dir="ltr"
                />
                
                {!isToday && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])}
                  >
                    العودة لليوم
                  </Button>
                )}
              </div>
              
              <Button variant="outline" size="icon" onClick={() => handleDateChange(1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="البحث عن طالب..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overall Stats */}
      <div className="grid gap-4 sm:grid-cols-5">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Users className="h-5 w-5 text-blue-700 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{overallStats.total}</p>
              <p className="text-xs text-muted-foreground">إجمالي الطلاب</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <CheckCircle className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{overallStats.present}</p>
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
              <p className="text-2xl font-bold">{overallStats.late}</p>
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
              <p className="text-2xl font-bold">{overallStats.absent}</p>
              <p className="text-xs text-muted-foreground">{tc("absent")}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-linear-to-br from-primary/10 to-primary/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{overallStats.rate}%</p>
              <p className="text-xs text-muted-foreground">نسبة الحضور</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Refresh Button */}
      {isFetching && !isLoading && (
        <div className="flex justify-center">
          <Badge variant="secondary" className="gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            جاري التحديث...
          </Badge>
        </div>
      )}

      {/* Sessions with Attendance */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-48 mb-4" />
                <div className="space-y-3">
                  {[...Array(4)].map((_, j) => (
                    <Skeleton key={j} className="h-14 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-center">
            <XCircle className="h-12 w-12 mx-auto mb-3 text-destructive opacity-50" />
            <p className="text-destructive font-medium">{tc("serverError")}</p>
            <p className="text-sm text-muted-foreground mt-1">يرجى المحاولة مرة أخرى</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-4 w-4 ml-2" />
              إعادة المحاولة
            </Button>
          </CardContent>
        </Card>
      ) : filteredSessions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Calendar className="h-16 w-16 mx-auto mb-4 opacity-30" />
            {searchQuery ? (
              <>
                <p className="font-medium text-lg">{tc("noResults")}</p>
                <p className="text-sm mt-1">جرب البحث باسم مختلف</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setSearchQuery("")}
                >
                  مسح البحث
                </Button>
              </>
            ) : (
              <>
                <p className="font-medium text-lg">{t("noAttendance")}</p>
                <p className="text-sm mt-1">{getDayName(data?.dayOfWeek || 0)}</p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" defaultValue={filteredSessions.map(s => s._id)} className="space-y-4">
          {filteredSessions.map((session) => {
            const attendanceRate = session.stats.total > 0 
              ? Math.round(((session.stats.present + session.stats.late) / session.stats.total) * 100)
              : 0

            return (
              <AccordionItem key={session._id} value={session._id} className="border rounded-lg overflow-hidden bg-card">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex-1 text-right">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-base">{session.name}</h3>
                        <Badge variant="outline" className="text-xs font-normal">
                          {session.startTime} - {session.endTime}
                        </Badge>
                        <Badge 
                          variant="secondary" 
                          className={`text-xs ${attendanceRate >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : attendanceRate >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}
                        >
                          {attendanceRate}% حضور
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <User className="h-3 w-3" />
                        <span>{session.teacher?.fullName}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle className="h-4 w-4" />
                          <span className="font-medium">{session.stats.present}</span>
                        </span>
                        <span className="flex items-center gap-1 text-amber-600">
                          <Clock className="h-4 w-4" />
                          <span className="font-medium">{session.stats.late}</span>
                        </span>
                        <span className="flex items-center gap-1 text-red-600">
                          <XCircle className="h-4 w-4" />
                          <span className="font-medium">{session.stats.absent}</span>
                        </span>
                      </div>
                      <span className="text-muted-foreground font-medium">
                        {session.stats.total} طالب
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  {/* Bulk Actions */}
                  <div className="flex items-center justify-between mb-4 pb-3 border-b">
                    <span className="text-sm text-muted-foreground">
                      {session.students.length} طالب في هذه الحصة
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" disabled={bulkLoading === session._id}>
                          {bulkLoading === session._id ? (
                            <Loader2 className="h-4 w-4 animate-spin ml-2" />
                          ) : (
                            <MoreVertical className="h-4 w-4 ml-2" />
                          )}
                          إجراءات جماعية
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => handleBulkAction(session._id, ATTENDANCE_STATUS.PRESENT, session.students)}
                        >
                          <CheckCheck className="h-4 w-4 ml-2 text-emerald-600" />
                          {t("markAttendance")} - {tc("present")}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleBulkAction(session._id, ATTENDANCE_STATUS.ABSENT, session.students)}
                        >
                          <UserX className="h-4 w-4 ml-2 text-red-600" />
                          {t("markAttendance")} - {tc("absent")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleBulkAction(session._id, ATTENDANCE_STATUS.LATE, session.students)}
                        >
                          <Clock className="h-4 w-4 ml-2 text-amber-600" />
                          {t("markAttendance")} - {tc("late")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {session.students.length === 0 ? (
                    <p className="text-center py-4 text-muted-foreground">
                      لا يوجد طلاب مسجلون في هذه الحصة
                    </p>
                  ) : (
                    <TooltipProvider>
                    <div className="space-y-2">
                      {session.students.map((student) => {
                        const changeKey = `${session._id}-${student._id}`
                        const currentStatus = pendingChanges[changeKey] || student.status
                        const isSaving = savingStudent === changeKey
                        const isPaid = paymentStatus?.[student._id]

                        return (
                          <div
                            key={student._id}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${getStatusBgColor(currentStatus)}`}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 border-2 border-background">
                                <AvatarFallback className="text-sm font-medium">
                                  {getInitials(student)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{getStudentName(student)}</p>
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
                                      {isPaid ? "الاشتراك الشهري مدفوع" : "الاشتراك الشهري غير مدفوع"}
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                                {student.checkInTime && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    <span dir="ltr">
                                      {new Date(student.checkInTime).toLocaleTimeString("ar-TN", {
                                        hour: "2-digit",
                                        minute: "2-digit"
                                      })}
                                    </span>
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isSaving && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                              <Select
                                value={currentStatus}
                                onValueChange={(value) => handleStatusChange(session._id, student._id, value)}
                                disabled={isSaving}
                              >
                                <SelectTrigger className="w-40 bg-background">
                                  <div className="flex items-center gap-2">
                                    {getStatusIcon(currentStatus)}
                                    <span>{getAttendanceStatusLabel(currentStatus)}</span>
                                  </div>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={ATTENDANCE_STATUS.PRESENT}>
                                    <div className="flex items-center gap-2">
                                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                                      {tc("present")}
                                    </div>
                                  </SelectItem>
                                  <SelectItem value={ATTENDANCE_STATUS.LATE}>
                                    <div className="flex items-center gap-2">
                                      <Clock className="h-4 w-4 text-amber-600" />
                                      {tc("late")}
                                    </div>
                                  </SelectItem>
                                  <SelectItem value={ATTENDANCE_STATUS.ABSENT}>
                                    <div className="flex items-center gap-2">
                                      <XCircle className="h-4 w-4 text-red-600" />
                                      {tc("absent")}
                                    </div>
                                  </SelectItem>
                                  <SelectItem value={ATTENDANCE_STATUS.JUSTIFIED_ABSENCE}>
                                    <div className="flex items-center gap-2">
                                      <XCircle className="h-4 w-4 text-blue-600" />
                                      {tc("excused")}
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    </TooltipProvider>
                  )}
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      )}
    </div>
  )
}
