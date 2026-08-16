"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CalendarCheck,
  Clock,
  Flame,
  BookOpen,
  BarChart3,
  Star,
  TrendingUp,
  GraduationCap,
} from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { GRADE_TYPE_LABELS } from "@/lib/constants"

interface DashboardData {
  student: {
    firstName: string
    lastName: string
    displayName: string
    photoUrl?: string
  }
  stats: {
    attendanceRate: number
    streak: number
    totalSessions: number
    presentCount: number
    lateCount: number
    absentCount: number
    justifiedCount: number
    performanceAverage: number
    completedJuz: number
    totalJuz: number
    enrolledSessions: number
  }
  nextSession: {
    name: string
    teacher: string
    dayOfWeek: number
    dayName: string
    startTime: string
    endTime: string
    isToday: boolean
    daysUntil: number
  } | null
  monthlyAttendance: {
    month: string
    present: number
    absent: number
    total: number
  }[]
  recentGrades: {
    _id: string
    title: string
    type: string
    score: number
    maxScore: number
    date: string
    percentage: number
  }[]
}

function getGreetingMessage(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "صباح الخير"
  if (hour < 17) return "مساء النور"
  return "مساء الخير"
}

export default function StudentDashboard() {
  const t = useTranslations("student.dashboard")
  const tc = useTranslations("common")
  const { data: session } = useSession()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboard()
  }, [])

  const fetchDashboard = async () => {
    try {
      const res = await fetch("/api/student/dashboard")
      if (res.ok) {
        const json = await res.json()
        setData(json)
      } else {
        const errData = await res.json().catch(() => null)
        setError(errData?.message || "حدث خطأ أثناء تحميل البيانات")
      }
    } catch (err) {
      console.error("Error fetching dashboard:", err)
      setError("حدث خطأ في الاتصال بالخادم")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <DashboardSkeleton />
  }

  if (error || !data) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-muted-foreground">{error || "حدث خطأ أثناء تحميل البيانات"}</p>
        <Button variant="outline" onClick={() => { setError(null); setLoading(true); fetchDashboard() }}>
          إعادة المحاولة
        </Button>
      </div>
    )
  }

  const firstName = data.student.firstName || session?.user?.fullName?.split(" ")[0] || ""

  return (
    <div className="space-y-6">
      {/* Hero Section - Greeting & Streak */}
      <Card className="bg-gradient-to-l from-primary/10 via-primary/5 to-secondary/10 border-primary/20 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-40 h-40 opacity-5">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <pattern id="islamic-hero" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M10 0L20 10L10 20L0 10Z" fill="currentColor" />
            </pattern>
            <rect width="100" height="100" fill="url(#islamic-hero)" />
          </svg>
        </div>
        <CardContent className="p-6 sm:p-8 relative">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-arabic font-bold text-primary">
                السلام عليكم، {firstName}
              </h1>
              <p className="text-muted-foreground font-arabic">
                {getGreetingMessage()} — نسأل الله أن يبارك في حفظك وعلمك
              </p>
            </div>
            {data.stats.streak > 0 && (
              <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 self-start">
                <Flame className="h-8 w-8 text-amber-500 animate-pulse" />
                <div>
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{data.stats.streak}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-500">يوم حضور متواصل</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Next Session Card */}
      {data.nextSession && (
        <Card className="border-primary/20 animate-fade-in stagger-1">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div
                className={`rounded-xl border p-3 ${
                  data.nextSession.isToday ? "student-surface-emerald-iconbox" : "student-surface-sky-iconbox"
                }`}
              >
                <CalendarCheck
                  className={`h-6 w-6 ${
                    data.nextSession.isToday
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-sky-600 dark:text-sky-400"
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-foreground">{t("nextSession")}</h3>
                  {data.nextSession.isToday && (
                    <Badge variant="outline" className="student-surface-emerald-chip text-xs font-semibold">
                      اليوم
                    </Badge>
                  )}
                </div>
                <p className="text-lg font-medium text-primary">{data.nextSession.name}</p>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <GraduationCap className="h-4 w-4" />
                    {data.nextSession.teacher}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {data.nextSession.startTime} - {data.nextSession.endTime}
                  </span>
                  <span>{data.nextSession.dayName}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 stagger-children">
        {/* Attendance Rate */}
        <Card className="overflow-hidden card-lift">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">{t("attendanceRate")}</p>
                <p className="text-2xl sm:text-3xl font-bold text-foreground">{data.stats.attendanceRate}%</p>
              </div>
              <div className="rounded-xl bg-emerald-500/10 p-2.5">
                <CalendarCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            {/* Radial progress */}
            <div className="mt-3">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div 
                  className="h-full rounded-full bg-emerald-500 transition-all duration-1000"
                  style={{ width: `${data.stats.attendanceRate}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Memorization Progress */}
        <Card className="overflow-hidden card-lift">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">تقدم الحفظ</p>
                <p className="text-2xl sm:text-3xl font-bold text-foreground">
                  {data.stats.completedJuz}<span className="text-sm text-muted-foreground font-normal">/{data.stats.totalJuz}</span>
                </p>
              </div>
              <div className="rounded-xl bg-primary/10 p-2.5">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="mt-3">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div 
                  className="h-full rounded-full bg-primary transition-all duration-1000"
                  style={{ width: `${(data.stats.completedJuz / data.stats.totalJuz) * 100}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">جزء مكتمل</p>
            </div>
          </CardContent>
        </Card>

        {/* Performance */}
        <Card className="overflow-hidden card-lift">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">معدل الأداء</p>
                <p className="text-2xl sm:text-3xl font-bold text-foreground">{data.stats.performanceAverage}%</p>
              </div>
              <div className="rounded-xl bg-amber-500/10 p-2.5">
                <Star className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <div className="mt-3">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div 
                  className="h-full rounded-full bg-amber-500 transition-all duration-1000"
                  style={{ width: `${data.stats.performanceAverage}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Enrolled Sessions */}
        <Card className="overflow-hidden card-lift">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">الحلقات المسجلة</p>
                <p className="text-2xl sm:text-3xl font-bold text-foreground">{data.stats.enrolledSessions}</p>
              </div>
              <div className="rounded-xl bg-blue-500/10 p-2.5">
                <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              {data.stats.presentCount} حضور من {data.stats.totalSessions} حصة
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts & Recent Grades Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Attendance Chart */}
        <Card className="lg:col-span-2 animate-fade-in stagger-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              اتجاه الحضور — آخر 3 أشهر
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.monthlyAttendance} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="presentGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(156, 71%, 25%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(156, 71%, 25%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="absentGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }} 
                    className="text-muted-foreground"
                  />
                  <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      direction: 'rtl',
                      textAlign: 'right'
                    }}
                    formatter={(value, name) => [
                      value,
                      name === 'present' ? tc("present") : tc("absent")
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="present"
                    stroke="hsl(156, 71%, 25%)"
                    strokeWidth={2}
                    fill="url(#presentGradient)"
                    name="present"
                  />
                  <Area
                    type="monotone"
                    dataKey="absent"
                    stroke="hsl(0, 84%, 60%)"
                    strokeWidth={2}
                    fill="url(#absentGradient)"
                    name="absent"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Grades */}
        <Card className="animate-fade-in stagger-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              {t("recentGrades")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentGrades.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>لا توجد تقييمات بعد</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.recentGrades.map((grade) => (
                  <div key={grade._id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{grade.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {GRADE_TYPE_LABELS[grade.type] || grade.type}
                      </p>
                    </div>
                    <div className="text-left mr-3">
                      <p className={`text-lg font-bold ${
                        grade.percentage >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                        grade.percentage >= 60 ? 'text-amber-600 dark:text-amber-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {grade.percentage}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">{grade.score}/{grade.maxScore}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-36 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="lg:col-span-2 h-80 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    </div>
  )
}
