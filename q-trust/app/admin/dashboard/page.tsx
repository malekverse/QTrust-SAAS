import { Suspense } from "react"
import Link from "next/link"
import { PageHeader } from "@/components/layout/page-header"
import { GreetingCard } from "@/components/layout/greeting-card"
import { StatCard } from "@/components/layout/stat-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { IslamicDivider } from "@/components/layout/islamic-divider"
import { 
  Users, 
  GraduationCap, 
  Calendar, 
  ClipboardCheck, 
  TrendingUp, 
  Clock, 
  BarChart3, 
  Activity,
  Plus,
  ArrowLeft,
  UserPlus,
  CalendarPlus,
  QrCode,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Smartphone,
  MessageSquareWarning,
  BookOpen,
  CreditCard,
  DoorOpen,
  CalendarClock,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import dbConnect from "@/lib/db"
import User from "@/models/User"
import Student from "@/models/Student"
import SessionTemplate from "@/models/SessionTemplate"
import SessionOccurrence from "@/models/SessionOccurrence"
import Attendance from "@/models/Attendance"
import AttendanceClaim from "@/models/AttendanceClaim"
import ActivityLog from "@/models/ActivityLog"
import MonthlyPayment from "@/models/MonthlyPayment"
import Room from "@/models/Room"
import StudentSession from "@/models/StudentSession"
import mongoose from "mongoose"
import { auth } from "@/lib/auth"
import { ROLES, ATTENDANCE_STATUS, SESSION_STATUS, CLAIM_STATUS, DEFAULT_QR_SETTINGS } from "@/lib/constants"
import { AttendanceCharts } from "./attendance-charts"
import { formatDistanceToNow } from "date-fns"
import { ar } from "date-fns/locale"
import { getTranslations } from "next-intl/server"

export const dynamic = 'force-dynamic'

async function DashboardStats() {
  try {
    const tenantId = (await auth())?.user?.tenantId
    if (!tenantId) return <StatsLoading />
    await dbConnect()
    const t = await getTranslations("admin.dashboard")

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [teacherCount, studentCount, sessionCount, todayAttendance] = await Promise.all([
      User.countDocuments({ tenantId, role: ROLES.TEACHER, isActive: true }),
      Student.countDocuments({ tenantId, isActive: true }),
      SessionTemplate.countDocuments({ tenantId, isActive: true }),
      Attendance.aggregate([
        { $match: { tenantId: new mongoose.Types.ObjectId(tenantId) } },
        {
          $lookup: {
            from: "sessionoccurrences",
            localField: "sessionOccurrenceId",
            foreignField: "_id",
            as: "occurrence"
          }
        },
        { $unwind: "$occurrence" },
        {
          $match: {
            "occurrence.date": { $gte: today, $lt: tomorrow }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            present: {
              $sum: {
                $cond: [{ $in: ["$status", ["PRESENT", "LATE"]] }, 1, 0]
              }
            }
          }
        }
      ])
    ])

    const attendanceRate = todayAttendance.length > 0 && todayAttendance[0].total > 0
      ? Math.round((todayAttendance[0].present / todayAttendance[0].total) * 100)
      : 0

    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/admin/teachers" className="group">
          <StatCard
            title={t("activeTeachers")}
            value={teacherCount}
            subtitle={t("teachersSubtitle")}
            icon={Users}
            className="transition-all group-hover:border-primary/50 group-hover:shadow-md"
          />
        </Link>
        <Link href="/admin/students" className="group">
          <StatCard
            title={t("registeredStudents")}
            value={studentCount}
            subtitle={t("activeStudentSubtitle")}
            icon={GraduationCap}
            className="transition-all group-hover:border-primary/50 group-hover:shadow-md"
          />
        </Link>
        <Link href="/admin/sessions" className="group">
          <StatCard
            title={t("activeSessions")}
            value={sessionCount}
            subtitle={t("weeklySessionSubtitle")}
            icon={Calendar}
            className="transition-all group-hover:border-primary/50 group-hover:shadow-md"
          />
        </Link>
        <Link href="/admin/attendance" className="group">
          <StatCard
            title={t("todayAttendanceRate")}
            value={`${attendanceRate}%`}
            subtitle={t("ofTotalStudents")}
            icon={ClipboardCheck}
            className="transition-all group-hover:border-primary/50 group-hover:shadow-md"
          />
        </Link>
      </div>
    )
  } catch (error) {
    console.error("Error fetching dashboard stats:", error)
    return <StatsLoading />
  }
}

async function getWeeklyAttendanceData() {
  try {
    const tenantId = (await auth())?.user?.tenantId
    if (!tenantId) return { weeklyData: [], distribution: [] }
    await dbConnect()
    const tc = await getTranslations("common")

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    sevenDaysAgo.setHours(0, 0, 0, 0)

    const weeklyData = await Attendance.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId) } },
      {
        $lookup: {
          from: "sessionoccurrences",
          localField: "sessionOccurrenceId",
          foreignField: "_id",
          as: "occurrence"
        }
      },
      { $unwind: "$occurrence" },
      {
        $match: {
          "occurrence.date": { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$occurrence.date" }
          },
          total: { $sum: 1 },
          present: {
            $sum: { $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0] }
          },
          late: {
            $sum: { $cond: [{ $eq: ["$status", "LATE"] }, 1, 0] }
          },
          absent: {
            $sum: { $cond: [{ $eq: ["$status", "ABSENT"] }, 1, 0] }
          }
        }
      },
      { $sort: { "_id": 1 } }
    ])

    const distribution = await Attendance.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId) } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ])

    return {
      weeklyData: weeklyData.map((d: any) => ({
        date: d._id,
        rate: d.total > 0 ? Math.round(((d.present + d.late) / d.total) * 100) : 0,
        present: d.present,
        late: d.late,
        absent: d.absent
      })),
      distribution: distribution.map((d: any) => ({
        name: d._id === "PRESENT" ? tc("present") : d._id === "LATE" ? tc("late") : d._id === "ABSENT" ? tc("absent") : tc("excused"),
        value: d.count,
        color: d._id === "PRESENT" ? "hsl(156, 71%, 25%)" : 
               d._id === "LATE" ? "hsl(42, 87%, 50%)" : 
               d._id === "ABSENT" ? "hsl(0, 84%, 60%)" : "hsl(209, 52%, 29%)"
      }))
    }
  } catch (error) {
    console.error("Error fetching weekly data:", error)
    return { weeklyData: [], distribution: [] }
  }
}

function StatsLoading() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Quick Actions Component
async function PortalOverview() {
  try {
    const tenantId = (await auth())?.user?.tenantId
    if (!tenantId) return null
    await dbConnect()
    const t = await getTranslations("admin.dashboard")

    const [portalAccounts, pendingClaims, totalStudents] = await Promise.all([
      Student.countDocuments({ tenantId, hasPortalAccess: true }),
      AttendanceClaim.countDocuments({ tenantId, status: CLAIM_STATUS.PENDING }),
      Student.countDocuments({ tenantId, isActive: true }),
    ])

    // Force model registration
    void AttendanceClaim

    if (portalAccounts === 0 && pendingClaims === 0) return null

    return (
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            {t("studentPortal")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 p-3 rounded-xl border admin-stat-tile--emerald">
              <GraduationCap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{portalAccounts}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-500">{t("activePortalAccounts")}</p>
              </div>
            </div>
            {pendingClaims > 0 && (
              <Link href="/admin/claims" className="group">
                <div className="flex items-center gap-3 p-3 rounded-xl border admin-stat-tile--amber transition-all group-hover:border-amber-400 group-hover:shadow-sm">
                  <MessageSquareWarning className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{pendingClaims}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-500">{t("pendingClaimsReview")}</p>
                  </div>
                </div>
              </Link>
            )}
            <div className="flex items-center gap-3 p-3 rounded-xl border admin-stat-tile--blue">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-lg font-bold text-blue-700 dark:text-blue-400">
                  {totalStudents > 0 ? Math.round((portalAccounts / totalStudents) * 100) : 0}%
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-500">{t("portalActivationRate")}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  } catch (error) {
    console.error("Error fetching portal stats:", error)
    return null
  }
}

async function PaymentOverview() {
  try {
    const tenantId = (await auth())?.user?.tenantId
    if (!tenantId) return null
    await dbConnect()
    const t = await getTranslations("admin.dashboard")
    const tc = await getTranslations("common")

    void MonthlyPayment

    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    const [totalStudents, paidCount] = await Promise.all([
      Student.countDocuments({ tenantId, isActive: true }),
      MonthlyPayment.countDocuments({
        tenantId,
        month: currentMonth,
        year: currentYear,
        isPaid: true,
      }),
    ])

    const unpaidCount = totalStudents - paidCount
    const paymentRate = totalStudents > 0
      ? Math.round((paidCount / totalStudents) * 100)
      : 0

    return (
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            {`${t("subscriptionsForMonth")} ${tc('months.' + currentMonth)} ${currentYear}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 p-3 rounded-xl border admin-stat-tile--emerald">
              <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{paidCount}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-500">{t("paidThisMonth")}</p>
              </div>
            </div>
            {unpaidCount > 0 && (
              <Link href="/admin/subscriptions" className="group">
                <div className="flex items-center gap-3 p-3 rounded-xl border admin-stat-tile--red transition-all group-hover:border-red-400 group-hover:shadow-sm">
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <div>
                    <p className="text-lg font-bold text-red-700 dark:text-red-400">{unpaidCount}</p>
                    <p className="text-xs text-red-600 dark:text-red-500">{t("notPaidYet")}</p>
                  </div>
                </div>
              </Link>
            )}
            <div className="flex items-center gap-3 p-3 rounded-xl border admin-stat-tile--blue">
              <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{paymentRate}%</p>
                <p className="text-xs text-blue-600 dark:text-blue-500">{t("collectionRate")}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  } catch (error) {
    console.error("Error fetching payment stats:", error)
    return null
  }
}

async function RoomOverview() {
  try {
    const tenantId = (await auth())?.user?.tenantId
    if (!tenantId) return null
    await dbConnect()
    const t = await getTranslations("admin.dashboard")

    void Room
    void SessionTemplate
    void StudentSession

    const [totalRooms, activeSessions] = await Promise.all([
      Room.countDocuments({ tenantId, isActive: true }),
      SessionTemplate.countDocuments({ tenantId, isActive: true }),
    ])

    const roomsWithSessions = await SessionTemplate.distinct("roomId", {
      tenantId,
      isActive: true,
      roomId: { $ne: null },
    })
    const usedRooms = roomsWithSessions.length
    const sessionsWithoutRoom = await SessionTemplate.countDocuments({
      tenantId,
      isActive: true,
      $or: [{ roomId: null }, { roomId: { $exists: false } }],
    })

    if (totalRooms === 0) return null

    return (
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <DoorOpen className="h-5 w-5 text-primary" />
            {t("roomsAndSchedule")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <Link href="/admin/rooms" className="group">
              <div className="flex items-center gap-3 p-3 rounded-xl border admin-stat-tile--violet transition-all group-hover:border-violet-400 group-hover:shadow-sm">
                <DoorOpen className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                <div>
                  <p className="text-lg font-bold text-violet-700 dark:text-violet-400">
                    {usedRooms}/{totalRooms}
                  </p>
                  <p className="text-xs text-violet-600 dark:text-violet-500">{t("roomsUsed")}</p>
                </div>
              </div>
            </Link>
            <Link href="/admin/schedule" className="group">
              <div className="flex items-center gap-3 p-3 rounded-xl border admin-stat-tile--blue transition-all group-hover:border-blue-400 group-hover:shadow-sm">
                <CalendarClock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{activeSessions}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-500">{t("activeSession")}</p>
                </div>
              </div>
            </Link>
            {sessionsWithoutRoom > 0 && (
              <Link href="/admin/schedule" className="group">
                <div className="flex items-center gap-3 p-3 rounded-xl border admin-stat-tile--amber transition-all group-hover:border-amber-400 group-hover:shadow-sm">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{sessionsWithoutRoom}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-500">{t("withoutRoom")}</p>
                  </div>
                </div>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    )
  } catch (error) {
    console.error("Error fetching room stats:", error)
    return null
  }
}

async function QuickActions() {
  const t = await getTranslations("admin.dashboard")
  return (
    <Card className="bg-gradient-to-br from-primary/5 via-transparent to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Plus className="h-5 w-5 text-primary" />
          {t("quickActions")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Button variant="outline" className="h-auto py-4 flex-col gap-2 hover:border-primary hover:bg-primary/5" asChild>
            <Link href="/admin/students">
              <UserPlus className="h-6 w-6 text-emerald-600" />
              <span>{t("addStudent")}</span>
            </Link>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col gap-2 hover:border-primary hover:bg-primary/5" asChild>
            <Link href="/admin/sessions">
              <CalendarPlus className="h-6 w-6 text-blue-600" />
              <span>{t("addSession")}</span>
            </Link>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col gap-2 hover:border-primary hover:bg-primary/5" asChild>
            <Link href="/admin/attendance">
              <ClipboardCheck className="h-6 w-6 text-amber-600" />
              <span>{t("manageAttendance")}</span>
            </Link>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col gap-2 hover:border-primary hover:bg-primary/5" asChild>
            <Link href="/admin/students/qr-cards">
              <QrCode className="h-6 w-6 text-purple-600" />
              <span>{t("printCards")}</span>
            </Link>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col gap-2 hover:border-primary hover:bg-primary/5" asChild>
            <Link href="/admin/subscriptions">
              <CreditCard className="h-6 w-6 text-pink-600" />
              <span>{t("manageSubscriptions")}</span>
            </Link>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col gap-2 hover:border-primary hover:bg-primary/5" asChild>
            <Link href="/admin/claims">
              <MessageSquareWarning className="h-6 w-6 text-orange-600" />
              <span>{t("reviewClaims")}</span>
            </Link>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col gap-2 hover:border-primary hover:bg-primary/5" asChild>
            <Link href="/admin/rooms">
              <DoorOpen className="h-6 w-6 text-violet-600" />
              <span>{t("manageRooms")}</span>
            </Link>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col gap-2 hover:border-primary hover:bg-primary/5" asChild>
            <Link href="/admin/schedule">
              <CalendarClock className="h-6 w-6 text-indigo-600" />
              <span>{t("schedule")}</span>
            </Link>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col gap-2 hover:border-primary hover:bg-primary/5" asChild>
            <Link href="/admin/documents">
              <BookOpen className="h-6 w-6 text-teal-600" />
              <span>{t("manageLibrary")}</span>
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

async function TodaysSessions() {
  try {
    const t = await getTranslations("admin.dashboard")
    const tc = await getTranslations("common")
    const tenantId = (await auth())?.user?.tenantId
    if (!tenantId) return <SessionsLoading />
    await dbConnect()

    const today = new Date()
    const dayOfWeek = today.getDay()
    
    // Use UTC date for consistency with how occurrences are stored
    const todayStart = new Date(Date.UTC(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      0, 0, 0, 0
    ))
    // Also create a local date for start/end times
    const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0)

    const sessions = await SessionTemplate.find({
      tenantId,
      dayOfWeek,
      isActive: true,
    })
      .populate("teacherId", "fullName")
      .sort({ startTime: 1 })
      .limit(5)
      .lean()

    if (sessions.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">{t("noUpcoming")}</p>
          <p className="text-sm mt-1">{tc('days.' + String(dayOfWeek))}</p>
        </div>
      )
    }

    // Auto-create occurrences for today's sessions if they don't exist
    for (const session of sessions) {
      try {
        const existingOccurrence = await SessionOccurrence.findOne({
          tenantId,
          sessionTemplateId: session._id,
          date: todayStart,
        })

        if (!existingOccurrence) {
          const [startHour, startMin] = session.startTime.split(":").map(Number)
          const [endHour, endMin] = session.endTime.split(":").map(Number)

          // Use local time for session start/end (sessions are in local time)
          const startDateTime = new Date(todayLocal)
          startDateTime.setHours(startHour, startMin, 0, 0)

          const endDateTime = new Date(todayLocal)
          endDateTime.setHours(endHour, endMin, 0, 0)

          const qrOpenOffset = session.qrOpenOffsetBeforeMin ?? DEFAULT_QR_SETTINGS.openOffsetBeforeMin
          const qrCloseOffset = session.qrCloseOffsetAfterMin ?? DEFAULT_QR_SETTINGS.closeOffsetAfterMin

          const qrOpenDateTime = new Date(startDateTime.getTime() - qrOpenOffset * 60 * 1000)
          const qrCloseDateTime = new Date(endDateTime.getTime() + qrCloseOffset * 60 * 1000)

          await SessionOccurrence.create({
            tenantId,
            sessionTemplateId: session._id,
            teacherId: session.teacherId,
            date: todayStart,
            startDateTime,
            endDateTime,
            qrOpenDateTime,
            qrCloseDateTime,
            status: SESSION_STATUS.SCHEDULED,
          })
        }
      } catch (occError) {
        console.error(`[Dashboard] Error creating occurrence for ${session.name}:`, occError)
      }
    }

    const now = new Date()
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

    return (
      <div className="space-y-3">
        {sessions.map((session: any) => {
          const isOngoing = currentTime >= session.startTime && currentTime <= session.endTime
          const isPast = currentTime > session.endTime
          const isUpcoming = currentTime < session.startTime

          return (
            <Link
              key={session._id.toString()}
              href={`/admin/sessions/${session._id}`}
              className="flex items-center justify-between p-3 rounded-lg bg-primary/5 hover:bg-primary/10 border border-transparent hover:border-primary/10 dark:bg-muted/50 dark:hover:bg-muted dark:border-transparent transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                  isOngoing 
                    ? 'bg-emerald-500/20 text-emerald-600' 
                    : isPast 
                      ? 'bg-muted text-muted-foreground' 
                      : 'bg-primary/10 text-primary'
                }`}>
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{session.name}</p>
                    {isOngoing && (
                      <Badge variant="default" className="bg-emerald-500 text-xs">{t("ongoingNow")}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {session.teacherId?.fullName || t("notAssigned")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <p className={`font-medium ${isPast ? 'text-muted-foreground' : 'text-primary'}`} dir="ltr">
                  {session.startTime} - {session.endTime}
                </p>
                <ArrowLeft className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          )
        })}
        <div className="pt-2 border-t">
          <Button variant="ghost" size="sm" className="w-full" asChild>
            <Link href="/admin/sessions">
              {t("viewAllSessions")}
              <ArrowLeft className="h-4 w-4 mr-2" />
            </Link>
          </Button>
        </div>
      </div>
    )
  } catch (error) {
    console.error("Error fetching sessions:", error)
    return <SessionsLoading />
  }
}

function SessionsLoading() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center justify-between p-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div>
              <Skeleton className="h-4 w-32 mb-1" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  )
}

function ActivityLoading() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="w-2 h-2 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-32 mb-1" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  )
}

const activityTypeConfig: Record<string, { color: string; icon: any }> = {
  ATTENDANCE_CHECK_IN: { color: "bg-emerald-500", icon: CheckCircle },
  STUDENT_CREATED: { color: "bg-blue-500", icon: UserPlus },
  STUDENT_UPDATED: { color: "bg-cyan-500", icon: Users },
  TEACHER_CREATED: { color: "bg-purple-500", icon: UserPlus },
  TEACHER_UPDATED: { color: "bg-violet-500", icon: Users },
  SESSION_CREATED: { color: "bg-amber-500", icon: CalendarPlus },
  SESSION_UPDATED: { color: "bg-orange-500", icon: Calendar },
  ATTENDANCE_UPDATED: { color: "bg-teal-500", icon: ClipboardCheck },
}

async function RecentActivity() {
  try {
    const t = await getTranslations("admin.dashboard")
    const activityLabels: Record<string, string> = {
      ATTENDANCE_CHECK_IN: t("activityCheckIn"),
      STUDENT_CREATED: t("activityStudentCreated"),
      STUDENT_UPDATED: t("activityStudentUpdated"),
      TEACHER_CREATED: t("activityTeacherCreated"),
      TEACHER_UPDATED: t("activityTeacherUpdated"),
      SESSION_CREATED: t("activitySessionCreated"),
      SESSION_UPDATED: t("activitySessionUpdated"),
      ATTENDANCE_UPDATED: t("activityAttendanceUpdated"),
    }
    const tenantId = (await auth())?.user?.tenantId
    if (!tenantId) return <ActivityLoading />
    await dbConnect()

    const activities = await ActivityLog.find({ tenantId })
      .sort({ createdAt: -1 })
      .limit(8)
      .lean()

    if (activities.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>{t("noActivity")}</p>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {activities.map((activity: any) => {
          const config = activityTypeConfig[activity.type] || { color: "bg-gray-500", icon: Activity }
          return (
            <div key={activity._id.toString()} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
              <div className={`w-2 h-2 rounded-full mt-2 ${config.color}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{activityLabels[activity.type] || activity.type}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {activity.description}
                </p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(activity.createdAt), { 
                  addSuffix: true, 
                  locale: ar 
                })}
              </span>
            </div>
          )
        })}
      </div>
    )
  } catch (error) {
    console.error("Error fetching activity:", error)
    return <ActivityLoading />
  }
}

// Alerts Component
async function SystemAlerts() {
  try {
    const tenantId = (await auth())?.user?.tenantId
    if (!tenantId) return null
    await dbConnect()
    const t = await getTranslations("admin.dashboard")

    const [inactiveStudents, inactiveTeachers, lowAttendanceSessions] = await Promise.all([
      Student.countDocuments({ tenantId, isActive: false }),
      User.countDocuments({ tenantId, role: ROLES.TEACHER, isActive: false }),
      // Could add more complex queries for sessions with low attendance
      Promise.resolve(0)
    ])

    const alerts = []
    
    if (inactiveStudents > 0) {
      alerts.push({
        type: "warning",
        message: `${inactiveStudents} ${t("inactiveStudentAlert")}`,
        link: "/admin/students"
      })
    }
    
    if (inactiveTeachers > 0) {
      alerts.push({
        type: "warning", 
        message: `${inactiveTeachers} ${t("inactiveTeacherAlert")}`,
        link: "/admin/teachers"
      })
    }

    if (alerts.length === 0) {
      return (
        <div className="flex items-center gap-2 rounded-lg p-3 admin-alert-strip--success">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">{t("allSystemsNormal")}</span>
        </div>
      )
    }

    return (
      <div className="space-y-2">
        {alerts.map((alert, i) => (
          <Link 
            key={i} 
            href={alert.link}
            className="flex items-center gap-2 rounded-lg p-3 admin-alert-strip--warning transition-colors"
          >
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm font-medium flex-1">{alert.message}</span>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        ))}
      </div>
    )
  } catch (error) {
    return null
  }
}

function ChartLoading() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

async function ChartsSection() {
  const t = await getTranslations("admin.dashboard")
  const data = await getWeeklyAttendanceData()
  
  if (data.weeklyData.length === 0 && data.distribution.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">{t("noChartData")}</p>
          <p className="text-sm mt-1">{t("chartDataHint")}</p>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-semibold">{t("weeklyAttendanceTrend")}</CardTitle>
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <AttendanceCharts type="trend" data={data.weeklyData} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-semibold">{t("attendanceDistribution")}</CardTitle>
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <AttendanceCharts type="distribution" data={data.distribution} />
        </CardContent>
      </Card>
    </div>
  )
}

export default async function AdminDashboardPage() {
  const t = await getTranslations("admin.dashboard")

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <GreetingCard />

      {/* Page Header */}
      <PageHeader
        title={t("title")}
        description={t("overviewDescription")}
      />

      {/* System Alerts */}
      <Suspense fallback={null}>
        <SystemAlerts />
      </Suspense>

      {/* Stats Grid */}
      <Suspense fallback={<StatsLoading />}>
        <DashboardStats />
      </Suspense>

      {/* Student Portal Overview */}
      <Suspense fallback={null}>
        <PortalOverview />
      </Suspense>

      {/* Payment Overview */}
      <Suspense fallback={null}>
        <PaymentOverview />
      </Suspense>

      {/* Room Overview */}
      <Suspense fallback={null}>
        <RoomOverview />
      </Suspense>

      {/* Quick Actions */}
      <Suspense fallback={null}>
        <QuickActions />
      </Suspense>

      <IslamicDivider />

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's Sessions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold">{t("todaySessions")}</CardTitle>
            <Calendar className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Suspense fallback={<SessionsLoading />}>
              <TodaysSessions />
            </Suspense>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold">{t("recentActivity")}</CardTitle>
            <Activity className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Suspense fallback={<ActivityLoading />}>
              <RecentActivity />
            </Suspense>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <Suspense fallback={<ChartLoading />}>
        <ChartsSection />
      </Suspense>

      {/* Quran Quote */}
      <Card className="bg-gradient-to-l from-primary/5 to-transparent border-primary/20">
        <CardContent className="p-6 text-center">
          <p className="text-xl font-arabic text-primary mb-2">
            ﴿ وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ ﴾
          </p>
          <p className="text-sm text-muted-foreground">سورة القمر - الآية 17</p>
        </CardContent>
      </Card>
    </div>
  )
}
