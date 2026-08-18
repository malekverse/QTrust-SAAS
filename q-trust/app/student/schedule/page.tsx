"use client"

import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DAYS_OF_WEEK } from "@/lib/constants"
import { CalendarClock, Clock, DoorOpen, MapPin, User } from "lucide-react"

async function fetchMySchedule() {
  const res = await fetch("/api/student/schedule")
  if (!res.ok) throw new Error("fetchError")
  return res.json()
}

const COLORS = [
  "bg-blue-500/15 border-blue-300 dark:border-blue-700",
  "bg-emerald-500/15 border-emerald-300 dark:border-emerald-700",
  "bg-purple-500/15 border-purple-300 dark:border-purple-700",
  "bg-amber-500/15 border-amber-300 dark:border-amber-700",
  "bg-rose-500/15 border-rose-300 dark:border-rose-700",
  "bg-cyan-500/15 border-cyan-300 dark:border-cyan-700",
]

export default function StudentSchedulePage() {
  const t = useTranslations("student.schedule")
  const tc = useTranslations("common")
  const { data, isLoading } = useQuery({
    queryKey: ["my-schedule"],
    queryFn: fetchMySchedule,
  })

  const sessions = data?.sessions || []
  const byDay = data?.byDay || {}

  // Assign colors by session
  const colorMap: Record<string, string> = {}
  sessions.forEach((s: any, i: number) => {
    colorMap[s._id] = COLORS[i % COLORS.length]
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("title")} description={t("description")} />
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded w-1/2 mb-4" />
                <div className="h-16 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")}>
        <Badge variant="outline" className="text-sm">
          <CalendarClock className="h-3.5 w-3.5 ml-1" />
          {t("circleCount", { count: sessions.length })}
        </Badge>
      </PageHeader>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CalendarClock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">{t("noSchedule")}</h3>
            <p className="text-muted-foreground">{t("noSchedule")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop: Weekly grid */}
          <div className="hidden md:block">
            <div className="grid grid-cols-7 gap-2">
              {DAYS_OF_WEEK.map((day) => {
                const daySessions = byDay[day.value] || []
                const isToday = day.value === new Date().getDay()
                return (
                  <div key={day.value}>
                    <div
                      className={`text-center text-sm font-medium p-2 rounded-t-lg ${
                        isToday
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {tc(`days.${String(day.value)}`)}
                    </div>
                    <div className="border border-t-0 rounded-b-lg min-h-[120px] p-1.5 space-y-1.5">
                      {daySessions.length === 0 ? (
                        <div className="text-center text-xs text-muted-foreground py-6">—</div>
                      ) : (
                        daySessions.map((s: any) => (
                          <div
                            key={s._id}
                            className={`p-2 rounded-md border ${colorMap[s._id]}`}
                          >
                            <div className="font-medium text-xs truncate">{s.name}</div>
                            <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1" dir="ltr">
                              <Clock className="h-2.5 w-2.5" />
                              {s.startTime} - {s.endTime}
                            </div>
                            {s.teacher && (
                              <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                <User className="h-2.5 w-2.5" />
                                {s.teacher}
                              </div>
                            )}
                            {s.room && (
                              <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                <DoorOpen className="h-2.5 w-2.5" />
                                {s.room.name}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Mobile: List by day */}
          <div className="md:hidden space-y-4">
            {DAYS_OF_WEEK.map((day) => {
              const daySessions = byDay[day.value] || []
              if (daySessions.length === 0) return null
              const isToday = day.value === new Date().getDay()
              return (
                <Card key={day.value} className={isToday ? "ring-2 ring-primary" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="font-semibold">{tc(`days.${String(day.value)}`)}</h3>
                      {isToday && (
                        <Badge variant="outline" className="student-surface-emerald-chip text-xs font-semibold">
                          {t("today")}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-3">
                      {daySessions.map((s: any) => (
                        <div key={s._id} className={`p-3 rounded-lg border ${colorMap[s._id]}`}>
                          <div className="font-medium text-sm">{s.name}</div>
                          <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1" dir="ltr">
                              <Clock className="h-3 w-3" />
                              {s.startTime} - {s.endTime}
                            </span>
                            {s.teacher && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {s.teacher}
                              </span>
                            )}
                            {s.room && (
                              <span className="flex items-center gap-1">
                                <DoorOpen className="h-3 w-3" />
                                {s.room.name}
                                {s.room.location && (
                                  <>
                                    <MapPin className="h-3 w-3 mr-1" />
                                    {s.room.location}
                                  </>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
