"use client"

import { use } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DAYS_OF_WEEK } from "@/lib/constants"
import { ArrowRight, DoorOpen, Users, MapPin, Calendar } from "lucide-react"
import Link from "next/link"

async function fetchRoom(id: string) {
  const res = await fetch(`/api/rooms/${id}`)
  if (!res.ok) throw new Error("Failed to fetch room")
  return res.json()
}

export default function RoomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const t = useTranslations("admin.rooms")
  const tc = useTranslations("common")

  const { data: room, isLoading, isError } = useQuery({
    queryKey: ["room", id],
    queryFn: () => fetchRoom(id),
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-48 animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (isError || !room) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-destructive">{t("fetchError")}</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/admin/rooms">{tc("back")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const sessions = room.sessions || []

  return (
    <div className="space-y-6">
      <PageHeader
        title={room.name}
        description={room.description || t("detailsDefault")}
      >
        <Button asChild variant="outline">
          <Link href="/admin/rooms">
            <ArrowRight className="h-4 w-4 ml-2" />
            {tc("back")}
          </Link>
        </Button>
      </PageHeader>

      {/* Room Info Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("capacity")}</p>
              <p className="text-xl font-semibold">{room.capacity}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("activeSessions")}</p>
              <p className="text-xl font-semibold">{sessions.length}</p>
            </div>
          </CardContent>
        </Card>
        {room.location && (
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("location")}</p>
                <p className="text-sm font-medium">{room.location}</p>
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <DoorOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("roomStatus")}</p>
              <Badge variant={room.isActive ? "success" : "destructive"}>
                {room.isActive ? t("activeStatus") : t("disabledStatus")}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Features */}
      {room.features?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("features")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {room.features.map((f: string) => (
                <Badge key={f} variant="outline" className="text-sm py-1 px-3">
                  {t('featureLabels.' + f)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly Availability Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("weeklySchedule")}</CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t("noSessionsForRoom")}</p>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {DAYS_OF_WEEK.map((day) => {
                const daySessions = sessions.filter((s: any) => s.dayOfWeek === day.value)
                return (
                  <div key={day.value} className="min-h-[100px]">
                    <div className="text-center text-xs font-medium text-muted-foreground mb-2 pb-1 border-b">
                      {tc('days.' + String(day.value))}
                    </div>
                    <div className="space-y-1">
                      {daySessions.map((s: any) => (
                        <Link
                          key={s._id}
                          href={`/admin/sessions/${s._id}`}
                          className="block p-2 rounded-md bg-primary/10 hover:bg-primary/20 transition-colors text-xs"
                        >
                          <div className="font-medium truncate">{s.name}</div>
                          <div className="text-muted-foreground mt-0.5">
                            {s.startTime} - {s.endTime}
                          </div>
                          <div className="text-muted-foreground">
                            {s.studentCount} {t("studentSuffix")}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sessions List */}
      {sessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("linkedSessions")} ({sessions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sessions.map((s: any) => {
                const dayLabel = tc('days.' + String(s.dayOfWeek))
                const teacher = s.teacherId as any
                const utilPercent = room.capacity > 0
                  ? Math.round((s.studentCount / room.capacity) * 100)
                  : 0

                return (
                  <div
                    key={s._id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-1">
                      <Link href={`/admin/sessions/${s._id}`} className="font-medium hover:underline">
                        {s.name}
                      </Link>
                      <div className="text-sm text-muted-foreground">
                        {dayLabel} | {s.startTime} - {s.endTime}
                        {teacher?.fullName && ` | ${teacher.fullName}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-left">
                        <div className="text-sm font-medium">{s.studentCount}/{room.capacity}</div>
                        <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              utilPercent > 100 ? "bg-destructive" :
                              utilPercent >= 80 ? "bg-amber-500" :
                              "bg-emerald-500"
                            }`}
                            style={{ width: `${Math.min(utilPercent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
