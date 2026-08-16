"use client"

import { useQuery } from "@tanstack/react-query"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertTriangle,
  TrendingUp,
  GraduationCap,
  ShieldAlert,
  CircleDollarSign,
  CheckCircle,
} from "lucide-react"

interface DropoutRow {
  studentId: string
  name: string
  consecutiveAbsences: number
  absenceRate: number
  totalSessions: number
  level: "HIGH" | "MEDIUM"
}
interface RevenueMonth {
  month: number
  year: number
  label: string
  collected: number
  paidCount: number
}
interface TeacherRow {
  teacherId: string
  name: string
  finished: number
  cancelled: number
  scheduled: number
  total: number
  fulfillmentRate: number | null
}
interface Analytics {
  dropoutRisk: DropoutRow[]
  revenue: {
    months: RevenueMonth[]
    avgMonthlyCollected: number
    projectedNext: number
    totalCollected: number
  }
  teachers: TeacherRow[]
}

async function fetchAnalytics(): Promise<Analytics> {
  const res = await fetch("/api/analytics")
  if (!res.ok) throw new Error("فشل تحميل التحليلات")
  return res.json()
}

export default function AnalyticsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["analytics"], queryFn: fetchAnalytics })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="التحليلات" description="مؤشرات المتابعة والأداء" />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            تعذّر تحميل التحليلات
          </CardContent>
        </Card>
      </div>
    )
  }

  const maxCollected = Math.max(1, ...data.revenue.months.map((m) => m.collected))
  const highRisk = data.dropoutRisk.filter((r) => r.level === "HIGH").length

  return (
    <div className="space-y-6">
      <PageHeader title="التحليلات" description="مؤشرات المتابعة والأداء المبنية على بياناتك" />

      {/* Summary tiles */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-red-500/15 p-2">
              <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.dropoutRisk.length}</p>
              <p className="text-xs text-muted-foreground">طلاب في خطر الانقطاع ({highRisk} مرتفع)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-emerald-500/15 p-2">
              <CircleDollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold" dir="ltr">
                {data.revenue.totalCollected.toFixed(0)} د.ت
              </p>
              <p className="text-xs text-muted-foreground">محصّل آخر 6 أشهر</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-blue-500/15 p-2">
              <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold" dir="ltr">
                {data.revenue.projectedNext.toFixed(0)} د.ت
              </p>
              <p className="text-xs text-muted-foreground">توقّع الشهر القادم (متوسط)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5" />
            المداخيل الشهرية
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between gap-2 sm:gap-4" style={{ height: 180 }}>
            {data.revenue.months.map((m) => (
              <div key={`${m.year}-${m.month}`} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-xs font-medium" dir="ltr">
                  {m.collected > 0 ? m.collected.toFixed(0) : ""}
                </span>
                <div className="flex w-full items-end justify-center" style={{ height: 120 }}>
                  <div
                    className="w-full max-w-[48px] rounded-t-md bg-gradient-to-t from-primary/70 to-primary transition-all"
                    style={{ height: `${Math.max(2, (m.collected / maxCollected) * 100)}%` }}
                    title={`${m.collected} د.ت — ${m.paidCount} دفعة`}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            المتوسط الشهري: <span dir="ltr">{data.revenue.avgMonthlyCollected.toFixed(2)} د.ت</span>
            {" • "}
            المبالغ من الدفعات المسجّلة بمبلغ محدّد فقط
          </p>
        </CardContent>
      </Card>

      {/* Dropout risk */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5" />
            طلاب في خطر الانقطاع
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.dropoutRisk.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <CheckCircle className="mx-auto mb-2 h-10 w-10 text-emerald-500 opacity-70" />
              <p>لا يوجد طلاب في خطر الانقطاع حالياً — ما شاء الله</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الطالب</TableHead>
                  <TableHead>المستوى</TableHead>
                  <TableHead>غيابات متتالية</TableHead>
                  <TableHead className="hidden sm:table-cell">نسبة الغياب</TableHead>
                  <TableHead className="hidden sm:table-cell">عدد الحصص</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.dropoutRisk.map((r) => (
                  <TableRow key={r.studentId}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          r.level === "HIGH"
                            ? "border-red-500/40 text-red-700 dark:text-red-400"
                            : "border-amber-500/40 text-amber-700 dark:text-amber-400"
                        }
                      >
                        {r.level === "HIGH" ? "مرتفع" : "متوسط"}
                      </Badge>
                    </TableCell>
                    <TableCell dir="ltr" className="text-start">{r.consecutiveAbsences}</TableCell>
                    <TableCell className="hidden sm:table-cell" dir="ltr">{r.absenceRate}%</TableCell>
                    <TableCell className="hidden sm:table-cell" dir="ltr">{r.totalSessions}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Teacher fulfillment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <GraduationCap className="h-5 w-5" />
            أداء المعلمين
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.teachers.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">لا توجد بيانات حصص بعد</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المعلم</TableHead>
                  <TableHead>مكتملة</TableHead>
                  <TableHead>ملغاة</TableHead>
                  <TableHead className="hidden sm:table-cell">مجدولة</TableHead>
                  <TableHead>نسبة الإنجاز</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.teachers.map((t) => (
                  <TableRow key={t.teacherId}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell dir="ltr" className="text-start">{t.finished}</TableCell>
                    <TableCell dir="ltr" className="text-start">{t.cancelled}</TableCell>
                    <TableCell className="hidden sm:table-cell" dir="ltr">{t.scheduled}</TableCell>
                    <TableCell>
                      {t.fulfillmentRate === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Badge
                          variant="outline"
                          className={
                            t.fulfillmentRate >= 80
                              ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                              : t.fulfillmentRate >= 50
                              ? "border-amber-500/40 text-amber-700 dark:text-amber-400"
                              : "border-red-500/40 text-red-700 dark:text-red-400"
                          }
                        >
                          {t.fulfillmentRate}%
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
