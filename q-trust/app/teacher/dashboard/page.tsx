import { Suspense } from "react"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/page-header"
import { GreetingCard } from "@/components/layout/greeting-card"
import { StatCard } from "@/components/layout/stat-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { IslamicDivider } from "@/components/layout/islamic-divider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Users, Calendar, ClipboardCheck, Clock, ArrowLeft } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import dbConnect from "@/lib/db"
import SessionTemplate from "@/models/SessionTemplate"
import StudentSession from "@/models/StudentSession"
import SessionOccurrence from "@/models/SessionOccurrence"
import Attendance from "@/models/Attendance"
import { getDayName } from "@/lib/utils"
import { SESSION_STATUS, DEFAULT_QR_SETTINGS } from "@/lib/constants"
import Link from "next/link"

async function TeacherStats({ teacherId }: { teacherId: string }) {
  await dbConnect()

  // Get session template IDs first
  const sessionIds = await SessionTemplate.find({ teacherId, isActive: true })
    .select("_id")
    .lean()
    .then(sessions => sessions.map(s => s._id))

  const [sessionCount, studentIds] = await Promise.all([
    SessionTemplate.countDocuments({ teacherId, isActive: true }),
    StudentSession.distinct("studentId", {
      sessionTemplateId: { $in: sessionIds },
      isActive: true,
    }),
  ])
  
  const studentCount = studentIds.length

  // Calculate today's attendance rate
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const todayOccurrences = await SessionOccurrence.find({
    teacherId,
    date: today,
  })

  let attendanceRate = 0
  if (todayOccurrences.length > 0) {
    const occurrenceIds = todayOccurrences.map(o => o._id)
    const totalAttendance = await Attendance.countDocuments({
      sessionOccurrenceId: { $in: occurrenceIds },
    })
    const presentCount = await Attendance.countDocuments({
      sessionOccurrenceId: { $in: occurrenceIds },
      status: { $in: ["PRESENT", "LATE"] },
    })
    attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard
        title="حصصي"
        value={sessionCount}
        subtitle="حصة أسبوعية"
        icon={Calendar}
      />
      <StatCard
        title="طلابي"
        value={studentCount}
        subtitle="طالب مسجل"
        icon={Users}
      />
      <StatCard
        title="نسبة الحضور اليوم"
        value={`${attendanceRate}%`}
        subtitle="من إجمالي الطلاب"
        icon={ClipboardCheck}
      />
    </div>
  )
}

async function TodaysSessions({ teacherId }: { teacherId: string }) {
  await dbConnect()

  const today = new Date()
  const dayOfWeek = today.getDay()

  // Use UTC date for occurrence lookup consistency
  const todayStart = new Date(Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    0, 0, 0, 0
  ))
  // Local date for session times
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0)

  const sessions = await SessionTemplate.find({
    teacherId,
    dayOfWeek,
    isActive: true,
  })
    .sort({ startTime: 1 })
    .lean()

  // Get student counts and attendance for each session
  const sessionsWithData = await Promise.all(
    sessions.map(async (session: any) => {
      const studentCount = await StudentSession.countDocuments({
        sessionTemplateId: session._id,
        isActive: true,
      })

      // Get today's occurrence - create if it doesn't exist
      let occurrence = await SessionOccurrence.findOne({
        sessionTemplateId: session._id,
        date: todayStart,
      })

      // Auto-create occurrence if it doesn't exist
      if (!occurrence) {
        try {
          const [startHour, startMin] = session.startTime.split(":").map(Number)
          const [endHour, endMin] = session.endTime.split(":").map(Number)

          // Use local time for session start/end
          const startDateTime = new Date(todayLocal)
          startDateTime.setHours(startHour, startMin, 0, 0)

          const endDateTime = new Date(todayLocal)
          endDateTime.setHours(endHour, endMin, 0, 0)

          const qrOpenOffset = session.qrOpenOffsetBeforeMin ?? DEFAULT_QR_SETTINGS.openOffsetBeforeMin
          const qrCloseOffset = session.qrCloseOffsetAfterMin ?? DEFAULT_QR_SETTINGS.closeOffsetAfterMin

          const qrOpenDateTime = new Date(startDateTime.getTime() - qrOpenOffset * 60 * 1000)
          const qrCloseDateTime = new Date(endDateTime.getTime() + qrCloseOffset * 60 * 1000)

          occurrence = await SessionOccurrence.create({
            sessionTemplateId: session._id,
            teacherId: session.teacherId,
            date: todayStart,
            startDateTime,
            endDateTime,
            qrOpenDateTime,
            qrCloseDateTime,
            status: SESSION_STATUS.SCHEDULED,
          })
        } catch (occError) {
          console.error(`[Teacher Dashboard] Error creating occurrence:`, occError)
        }
      }

      let presentCount = 0
      if (occurrence) {
        presentCount = await Attendance.countDocuments({
          sessionOccurrenceId: occurrence._id,
          status: { $in: ["PRESENT", "LATE"] },
        })
      }

      return {
        ...session,
        studentCount,
        presentCount,
        occurrenceId: occurrence?._id?.toString(),
      }
    })
  )

  if (sessionsWithData.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>لا توجد حصص مجدولة لهذا اليوم</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {sessionsWithData.map((session: any) => (
        <div
          key={session._id.toString()}
          className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-medium">{session.name}</p>
              <p className="text-sm text-muted-foreground">
                {session.studentCount} طالب • {session.presentCount} حاضر
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" dir="ltr">
              {session.startTime} - {session.endTime}
            </Badge>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/teacher/sessions/${session._id}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

function StatsLoading() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {[...Array(3)].map((_, i) => (
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

function SessionsLoading() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-lg" />
            <div>
              <Skeleton className="h-4 w-32 mb-1" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-6 w-24" />
        </div>
      ))}
    </div>
  )
}

export default async function TeacherDashboardPage() {
  const session = await auth()
  if (!session) redirect("/auth/login")

  const teacherId = session.user.id

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <GreetingCard />

      {/* Page Header */}
      <PageHeader
        title="لوحة التحكم"
        description="نظرة عامة على حصصك وطلابك"
      />

      {/* Stats Grid */}
      <Suspense fallback={<StatsLoading />}>
        <TeacherStats teacherId={teacherId} />
      </Suspense>

      <IslamicDivider />

      {/* Today's Sessions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-semibold">حصص اليوم</CardTitle>
          <Badge variant="outline">{getDayName(new Date().getDay())}</Badge>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<SessionsLoading />}>
            <TodaysSessions teacherId={teacherId} />
          </Suspense>
        </CardContent>
      </Card>

      {/* Quran Quote */}
      <Card className="bg-gradient-to-l from-primary/5 to-transparent border-primary/20">
        <CardContent className="p-6 text-center">
          <p className="text-xl font-arabic text-primary mb-2">
            ﴿ خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ ﴾
          </p>
          <p className="text-sm text-muted-foreground">حديث شريف - صحيح البخاري</p>
        </CardContent>
      </Card>
    </div>
  )
}

