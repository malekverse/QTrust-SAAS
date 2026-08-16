import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import dbConnect from "@/lib/db"
import SessionTemplate from "@/models/SessionTemplate"
import StudentSession from "@/models/StudentSession"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Clock,
  Users,
  Calendar,
  ArrowLeft
} from "lucide-react"
import { getDayName } from "@/lib/utils"
import { DAYS_OF_WEEK } from "@/lib/constants"
import Link from "next/link"

async function getTeacherSessions(teacherId: string) {
  const tenantId = (await auth())?.user?.tenantId
  if (!tenantId) return { sessions: [], groupedByDay: {} }
  await dbConnect()

  const sessions = await SessionTemplate.find({
    tenantId,
    teacherId,
    isActive: true,
  })
    .sort({ dayOfWeek: 1, startTime: 1 })
    .lean()

  // Get student count for each session
  const sessionsWithCount = await Promise.all(
    sessions.map(async (session: any) => {
      const studentCount = await StudentSession.countDocuments({
        tenantId,
        sessionTemplateId: session._id,
        isActive: true,
      })
      return { ...session, studentCount }
    })
  )

  // Group by day
  const groupedByDay = DAYS_OF_WEEK.reduce((acc: any, day) => {
    acc[day.value] = sessionsWithCount.filter((s: any) => s.dayOfWeek === day.value)
    return acc
  }, {})

  return { sessions: sessionsWithCount, groupedByDay }
}

export default async function TeacherSessionsPage() {
  const session = await auth()
  if (!session) redirect("/auth/login")

  const t = await getTranslations("teacher.sessions")
  const tc = await getTranslations("common")

  const { sessions, groupedByDay } = await getTeacherSessions(session.user.id)

  const daysWithSessions = DAYS_OF_WEEK.filter(
    (day) => groupedByDay[day.value]?.length > 0
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
      />

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">{t("noSessions")}</p>
            <p className="text-muted-foreground">
              تواصل مع الإدارة لإضافة حصص جديدة
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {daysWithSessions.map((day) => (
            <Card key={day.value}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  {day.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {groupedByDay[day.value].map((s: any) => (
                  <div
                    key={s._id.toString()}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Clock className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{s.name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>{s.studentCount} {tc("student")}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" dir="ltr">
                        {s.startTime} - {s.endTime}
                      </Badge>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/teacher/sessions/${s._id}`}>
                          <ArrowLeft className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("description")}</span>
            <Badge>{sessions.length} حصة</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

