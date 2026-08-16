"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, Clock, GraduationCap, MapPin, CheckCircle2, XCircle, AlertCircle, Info } from "lucide-react"
import { ATTENDANCE_STATUS, SESSION_STATUS } from "@/lib/constants"

interface SessionData {
  _id: string
  name: string
  teacher: string
  dayOfWeek: number
  dayName: string
  startTime: string
  endTime: string
  isActive: boolean
  description?: string
  upcomingOccurrences: {
    _id: string
    date: string
    status: string
    attendanceStatus: string | null
    checkInTime: string | null
  }[]
}

interface WeeklyDay {
  dayOfWeek: number
  dayName: string
  sessions: SessionData[]
}

export default function StudentSessions() {
  const t = useTranslations("student.sessions")
  const tc = useTranslations("common")
  const [sessions, setSessions] = useState<SessionData[]>([])
  const [weeklyCalendar, setWeeklyCalendar] = useState<WeeklyDay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("calendar")

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    setError(null)
    try {
      const res = await fetch("/api/student/sessions")
      if (res.ok) {
        const data = await res.json()
        setSessions(data.sessions)
        setWeeklyCalendar(data.weeklyCalendar)
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

  const todayDayOfWeek = new Date().getDay()

  const getStatusBadge = (status: string) => {
    switch (status) {
      case SESSION_STATUS.SCHEDULED:
        return (
          <Badge variant="outline" className="student-surface-sky-chip font-semibold">
            قادمة
          </Badge>
        )
      case SESSION_STATUS.IN_PROGRESS:
        return (
          <Badge variant="outline" className="student-surface-emerald-chip font-semibold">
            جارية
          </Badge>
        )
      case SESSION_STATUS.FINISHED:
        return <Badge variant="outline" className="text-muted-foreground">انتهت</Badge>
      case SESSION_STATUS.CANCELLED:
        return <Badge variant="destructive">ملغاة</Badge>
      default:
        return null
    }
  }

  const getAttendanceIcon = (status: string | null) => {
    switch (status) {
      case ATTENDANCE_STATUS.PRESENT:
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" />
      case ATTENDANCE_STATUS.LATE:
        return <AlertCircle className="h-5 w-5 text-amber-500" />
      case ATTENDANCE_STATUS.ABSENT:
        return <XCircle className="h-5 w-5 text-red-500" />
      case ATTENDANCE_STATUS.JUSTIFIED_ABSENCE:
        return <Info className="h-5 w-5 text-blue-500" />
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-dashed border-muted-foreground/30" />
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12 space-y-3">
        <Calendar className="h-12 w-12 mx-auto text-muted-foreground/40" />
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={() => { setLoading(true); fetchSessions() }}>
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
          <Calendar className="h-7 w-7 text-primary" />
          {t("title")}
        </h1>
        <p className="text-muted-foreground mt-1">{t("description")}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-sm">
          <TabsTrigger value="calendar">الجدول الأسبوعي</TabsTrigger>
          <TabsTrigger value="list">قائمة الحلقات</TabsTrigger>
        </TabsList>

        {/* Weekly Calendar View */}
        <TabsContent value="calendar" className="mt-4 space-y-4">
          {weeklyCalendar.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">{t("noSessions")}</p>
              </CardContent>
            </Card>
          ) : (
            weeklyCalendar.map((day) => (
              <Card 
                key={day.dayOfWeek} 
                className={`transition-all ${day.dayOfWeek === todayDayOfWeek ? 'border-primary/40 shadow-md' : ''}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${day.dayOfWeek === todayDayOfWeek ? 'bg-primary animate-pulse' : 'bg-muted-foreground/30'}`} />
                      {day.dayName}
                    </CardTitle>
                    {day.dayOfWeek === todayDayOfWeek && (
                      <Badge variant="outline" className="student-surface-emerald-chip text-xs font-semibold">
                        اليوم
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {day.sessions.map((s) => (
                    <div 
                      key={s._id} 
                      className={`p-4 rounded-xl border transition-all hover:shadow-sm ${
                        !s.isActive ? 'opacity-60 bg-muted/30' : 'bg-background hover:bg-muted/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-foreground">{s.name}</h4>
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <GraduationCap className="h-4 w-4" />
                              {s.teacher}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {s.startTime} - {s.endTime}
                            </span>
                          </div>
                          {s.description && (
                            <p className="text-xs text-muted-foreground mt-2 bg-muted/50 rounded-md px-2 py-1">
                              {s.description}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0">
                          {!s.isActive ? (
                            <Badge variant="outline" className="text-muted-foreground">{tc("inactive")}</Badge>
                          ) : (
                            <Badge variant="outline" className="student-surface-emerald-chip">{tc("active")}</Badge>
                          )}
                        </div>
                      </div>

                      {/* Upcoming occurrences */}
                      {s.upcomingOccurrences.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <p className="text-xs font-medium text-muted-foreground mb-2">الحصص القادمة:</p>
                          <div className="flex flex-wrap gap-2">
                            {s.upcomingOccurrences.map((occ) => {
                              const occDate = new Date(occ.date)
                              const dateStr = occDate.toLocaleDateString('ar-TN', { day: 'numeric', month: 'short' })
                              return (
                                <div 
                                  key={occ._id} 
                                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/50 text-xs"
                                >
                                  {getAttendanceIcon(occ.attendanceStatus)}
                                  <span>{dateStr}</span>
                                  {getStatusBadge(occ.status)}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* List View */}
        <TabsContent value="list" className="mt-4 space-y-4">
          {sessions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">{t("noSessions")}</p>
              </CardContent>
            </Card>
          ) : (
            sessions.map((s) => (
              <Card key={s._id} className="overflow-hidden card-lift">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{s.name}</h3>
                        {s.isActive ? (
                          <Badge variant="outline" className="student-surface-emerald-chip">{tc("active")}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">{tc("inactive")}</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-2">
                          <GraduationCap className="h-4 w-4 text-primary" />
                          {s.teacher}
                        </span>
                        <span className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-primary" />
                          {s.dayName}
                        </span>
                        <span className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-primary" />
                          {s.startTime} - {s.endTime}
                        </span>
                      </div>
                      {s.description && (
                        <p className="text-sm text-muted-foreground mt-3 bg-muted/40 rounded-lg px-3 py-2">
                          {s.description}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
