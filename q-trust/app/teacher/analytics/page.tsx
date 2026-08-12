import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import dbConnect from "@/lib/db"
import SessionTemplate from "@/models/SessionTemplate"
import StudentSession from "@/models/StudentSession"
import SessionOccurrence from "@/models/SessionOccurrence"
import Attendance from "@/models/Attendance"
import Student from "@/models/Student"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Calendar,
  CheckCircle,
  Clock
} from "lucide-react"
import { IslamicDivider } from "@/components/layout/islamic-divider"

async function getTeacherAnalytics(teacherId: string) {
  const tenantId = (await auth())?.user?.tenantId
  if (!tenantId) {
    return {
      totalStudents: 0,
      totalSessions: 0,
      totalOccurrences: 0,
      overallRate: 0,
      presentCount: 0,
      lateCount: 0,
      absentCount: 0,
      sessionStats: [],
    }
  }
  await dbConnect()

  // Get teacher's sessions
  const sessions = await SessionTemplate.find({
    tenantId,
    teacherId,
    isActive: true,
  }).lean()

  const sessionIds = sessions.map((s: any) => s._id)

  // Get all students in teacher's sessions
  const studentSessions = await StudentSession.find({
    tenantId,
    sessionTemplateId: { $in: sessionIds },
    isActive: true,
  })
    .populate("studentId", "fullName")
    .lean()

  const uniqueStudentIds = [...new Set(studentSessions.map((ss: any) => ss.studentId?._id?.toString()))]

  // Get all occurrences for these sessions
  const occurrences = await SessionOccurrence.find({
    tenantId,
    sessionTemplateId: { $in: sessionIds },
  }).lean()

  const occurrenceIds = occurrences.map((o: any) => o._id)

  // Get attendance records
  const attendanceRecords = await Attendance.find({
    tenantId,
    sessionOccurrenceId: { $in: occurrenceIds },
  }).lean()

  // Calculate stats
  const totalRecords = attendanceRecords.length
  const presentCount = attendanceRecords.filter((a: any) => 
    a.status === "PRESENT" || a.status === "LATE"
  ).length
  const lateCount = attendanceRecords.filter((a: any) => a.status === "LATE").length
  const absentCount = attendanceRecords.filter((a: any) => a.status === "ABSENT").length

  const overallRate = totalRecords > 0 
    ? Math.round((presentCount / totalRecords) * 100) 
    : 0

  // Per-session stats
  const sessionStats = await Promise.all(
    sessions.map(async (session: any) => {
      const sessionOccurrences = occurrences.filter(
        (o: any) => o.sessionTemplateId.toString() === session._id.toString()
      )
      const sessionOccurrenceIds = sessionOccurrences.map((o: any) => o._id)
      
      const sessionAttendance = attendanceRecords.filter((a: any) =>
        sessionOccurrenceIds.some((id: any) => id.toString() === a.sessionOccurrenceId.toString())
      )
      
      const sessionPresent = sessionAttendance.filter((a: any) =>
        a.status === "PRESENT" || a.status === "LATE"
      ).length
      
      const studentCount = await StudentSession.countDocuments({
        tenantId,
        sessionTemplateId: session._id,
        isActive: true,
      })

      return {
        ...session,
        studentCount,
        totalOccurrences: sessionOccurrences.length,
        totalAttendance: sessionAttendance.length,
        presentCount: sessionPresent,
        rate: sessionAttendance.length > 0 
          ? Math.round((sessionPresent / sessionAttendance.length) * 100)
          : 0
      }
    })
  )

  return {
    totalStudents: uniqueStudentIds.length,
    totalSessions: sessions.length,
    totalOccurrences: occurrences.length,
    overallRate,
    presentCount,
    lateCount,
    absentCount,
    sessionStats,
  }
}

export default async function TeacherAnalyticsPage() {
  const session = await auth()
  if (!session) redirect("/auth/login")

  const analytics = await getTeacherAnalytics(session.user.id)

  return (
    <div className="space-y-6">
      <PageHeader
        title="الإحصائيات"
        description="تحليلات الحضور لحصصك"
      />

      {/* Overview Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{analytics.totalStudents}</p>
              <p className="text-xs text-muted-foreground">إجمالي الطلاب</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Calendar className="h-5 w-5 text-blue-700 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{analytics.totalOccurrences}</p>
              <p className="text-xs text-muted-foreground">حصة منعقدة</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <TrendingUp className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{analytics.overallRate}%</p>
              <p className="text-xs text-muted-foreground">نسبة الحضور</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <Clock className="h-5 w-5 text-amber-700 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{analytics.lateCount}</p>
              <p className="text-xs text-muted-foreground">حالات تأخر</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <IslamicDivider />

      {/* Per-Session Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            إحصائيات الحصص
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.sessionStats.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              لا توجد بيانات متاحة
            </p>
          ) : (
            <div className="space-y-4">
              {analytics.sessionStats.map((stat: any) => (
                <div 
                  key={stat._id.toString()}
                  className="p-4 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-medium">{stat.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {stat.studentCount} طالب • {stat.totalOccurrences} حصة
                      </p>
                    </div>
                    <Badge 
                      variant={stat.rate >= 80 ? "success" : stat.rate >= 60 ? "warning" : "destructive"}
                    >
                      {stat.rate}%
                    </Badge>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-500"
                      style={{ width: `${stat.rate}%` }}
                    />
                  </div>
                  
                  <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                    <span>
                      <CheckCircle className="h-3 w-3 inline ml-1" />
                      {stat.presentCount} حضور
                    </span>
                    <span>
                      {stat.totalAttendance - stat.presentCount} غياب
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Motivational Quote */}
      <Card className="bg-gradient-to-l from-primary/5 to-transparent border-primary/20">
        <CardContent className="p-6 text-center">
          <p className="text-xl font-arabic text-primary mb-2">
            ﴿ وَقُلِ اعْمَلُوا فَسَيَرَى اللَّهُ عَمَلَكُمْ وَرَسُولُهُ وَالْمُؤْمِنُونَ ﴾
          </p>
          <p className="text-sm text-muted-foreground">سورة التوبة - الآية 105</p>
        </CardContent>
      </Card>
    </div>
  )
}

