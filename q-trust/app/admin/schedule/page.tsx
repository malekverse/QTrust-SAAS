"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/toast"
import { DAYS_OF_WEEK } from "@/lib/constants"
import {
  CalendarClock,
  AlertTriangle,
  Wand2,
  DoorOpen,
  Users,
  Clock,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Filter,
} from "lucide-react"
import Link from "next/link"

async function fetchSchedule(roomId?: string, teacherId?: string) {
  const params = new URLSearchParams()
  if (roomId) params.set("roomId", roomId)
  if (teacherId) params.set("teacherId", teacherId)
  const res = await fetch(`/api/schedule?${params}`)
  if (!res.ok) throw new Error("فشل في جلب الجدول")
  return res.json()
}

async function fetchConflicts() {
  const res = await fetch("/api/schedule/conflicts")
  if (!res.ok) throw new Error("فشل في فحص التعارضات")
  return res.json()
}

async function autoAssignRooms(confirm: boolean) {
  const res = await fetch("/api/schedule/auto-assign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirm }),
  })
  if (!res.ok) throw new Error("فشل في التعيين التلقائي")
  return res.json()
}

/** 30-minute rows; pixel height must match each grid row’s `height: SLOT_PX`. */
const SLOT_MINUTES = 30
const SLOT_PX = 40
const GRID_START_HOUR = 6

function parseTimeToMinutes(time: string): number {
  const parts = time.trim().split(":").map((p) => parseInt(p, 10))
  const h = Number.isFinite(parts[0]) ? parts[0] : 0
  const m = Number.isFinite(parts[1]) ? parts[1] : 0
  return h * 60 + m
}

/** Row index of the 30-min slot that contains `time` (grid starts at GRID_START_HOUR). */
function timeToRow(time: string): number {
  const mins = parseTimeToMinutes(time)
  return Math.floor((mins - GRID_START_HOUR * 60) / SLOT_MINUTES)
}

/** Exact block height from start→end (handles arbitrary minutes, not only :00/:30). */
function sessionBlockHeightPx(start: string, end: string): number {
  const a = parseTimeToMinutes(start)
  const b = parseTimeToMinutes(end)
  const durM = Math.max(1, b - a)
  return Math.max(SLOT_PX * 0.5, (durM / SLOT_MINUTES) * SLOT_PX)
}

/** Vertical offset inside the start row for starts not aligned to the slot boundary. */
function sessionTopOffsetPx(start: string): number {
  const mins = parseTimeToMinutes(start)
  const rel = mins - GRID_START_HOUR * 60
  const inSlot = ((rel % SLOT_MINUTES) + SLOT_MINUTES) % SLOT_MINUTES
  return (inSlot / SLOT_MINUTES) * SLOT_PX
}

/** `top` / `height` inside one full-height day column (height = nRows × SLOT_PX). */
function sessionRectInDayColumn(
  s: { startTime: string; endTime: string },
  minRow: number,
  nRows: number
): { top: number; height: number } | null {
  const sr = timeToRow(s.startTime)
  const rawTop = (sr - minRow) * SLOT_PX + sessionTopOffsetPx(s.startTime)
  const rawH = sessionBlockHeightPx(s.startTime, s.endTime)
  const colBottom = nRows * SLOT_PX
  const top = Math.max(0, rawTop)
  const bottom = Math.min(colBottom, rawTop + rawH)
  const height = bottom - top
  if (height < 4) return null
  return { top, height }
}

const TIME_SLOTS = Array.from({ length: 32 }, (_, i) => {
  const h = Math.floor(i / 2) + GRID_START_HOUR
  const m = i % 2 === 0 ? "00" : "30"
  return `${h.toString().padStart(2, "0")}:${m}`
})

/** Translucent tints only — text color comes from `.schedule-slot-cell` in globals.css. */
const SLOT_TINTS = [
  "bg-blue-500/20 border-blue-300 dark:border-blue-700",
  "bg-emerald-500/20 border-emerald-300 dark:border-emerald-700",
  "bg-purple-500/20 border-purple-300 dark:border-purple-700",
  "bg-amber-500/20 border-amber-300 dark:border-amber-700",
  "bg-rose-500/20 border-rose-300 dark:border-rose-700",
  "bg-cyan-500/20 border-cyan-300 dark:border-cyan-700",
  "bg-orange-500/20 border-orange-300 dark:border-orange-700",
  "bg-indigo-500/20 border-indigo-300 dark:border-indigo-700",
]

export default function SchedulePage() {
  const queryClient = useQueryClient()
  const { success, error: showError } = useToast()
  const [filterRoom, setFilterRoom] = useState<string>("all")
  const [filterTeacher, setFilterTeacher] = useState<string>("all")
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false)
  const [autoAssignDialogOpen, setAutoAssignDialogOpen] = useState(false)
  const [autoAssignPreview, setAutoAssignPreview] = useState<any>(null)
  const [selectedSession, setSelectedSession] = useState<any>(null)

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["schedule", filterRoom, filterTeacher],
    queryFn: () =>
      fetchSchedule(
        filterRoom !== "all" ? filterRoom : undefined,
        filterTeacher !== "all" ? filterTeacher : undefined
      ),
  })

  const { data: conflictData, refetch: refetchConflicts } = useQuery({
    queryKey: ["schedule-conflicts"],
    queryFn: fetchConflicts,
    enabled: false,
  })

  const autoAssignMutation = useMutation({
    mutationFn: (confirm: boolean) => autoAssignRooms(confirm),
    onSuccess: (result) => {
      if (result.applied) {
        queryClient.invalidateQueries({ queryKey: ["schedule"] })
        queryClient.invalidateQueries({ queryKey: ["sessions"] })
        queryClient.invalidateQueries({ queryKey: ["rooms"] })
        setAutoAssignDialogOpen(false)
        setAutoAssignPreview(null)
        success("تم التعيين", result.message)
      } else {
        setAutoAssignPreview(result)
      }
    },
    onError: (err: Error) => showError("خطأ", err.message),
  })

  const sessions = data?.sessions || []
  const rooms = data?.rooms || []
  const teachers = data?.teachers || []

  // Build a color map by room or teacher
  const colorMap: Record<string, string> = {}
  let ci = 0
  for (const s of sessions) {
    const key = (s.roomId as any)?._id?.toString() || s._id.toString()
    if (!colorMap[key]) {
      colorMap[key] = SLOT_TINTS[ci % SLOT_TINTS.length]
      ci++
    }
  }

  // Find min/max times for the grid
  let minRow = 8 // default 10:00
  let maxRow = 20 // default 16:00
  for (const s of sessions) {
    const sr = timeToRow(s.startTime)
    const er = timeToRow(s.endTime)
    if (sr < minRow) minRow = sr
    if (er > maxRow) maxRow = er
  }
  minRow = Math.max(0, minRow - 1)
  maxRow = Math.min(TIME_SLOTS.length - 1, maxRow + 1)
  const visibleSlots = TIME_SLOTS.slice(minRow, maxRow + 1)
  const scheduleRowCount = visibleSlots.length

  const handleCheckConflicts = async () => {
    await refetchConflicts()
    setConflictDialogOpen(true)
  }

  const handleAutoAssign = () => {
    setAutoAssignPreview(null)
    setAutoAssignDialogOpen(true)
    autoAssignMutation.mutate(false)
  }

  const noSessionsWithoutRooms = sessions.filter((s: any) => !s.roomId).length

  return (
    <div className="space-y-6">
      <PageHeader title="الجدول الزمني" description="إدارة الجدول الأسبوعي للحصص والقاعات">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ml-2 ${isFetching ? "animate-spin" : ""}`} />
            تحديث
          </Button>
          <Button variant="outline" size="sm" onClick={handleCheckConflicts}>
            <AlertTriangle className="h-4 w-4 ml-2" />
            فحص التعارضات
          </Button>
          <Button
            size="sm"
            onClick={handleAutoAssign}
            disabled={noSessionsWithoutRooms === 0}
          >
            <Wand2 className="h-4 w-4 ml-2" />
            تعيين تلقائي
            {noSessionsWithoutRooms > 0 && (
              <Badge variant="secondary" className="mr-2 text-xs">
                {noSessionsWithoutRooms}
              </Badge>
            )}
          </Button>
        </div>
      </PageHeader>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              تصفية:
            </div>
            <Select value={filterRoom} onValueChange={setFilterRoom}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="جميع القاعات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع القاعات</SelectItem>
                {rooms.map((r: any) => (
                  <SelectItem key={r._id} value={r._id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterTeacher} onValueChange={setFilterTeacher}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="جميع المعلمين" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع المعلمين</SelectItem>
                {teachers.map((t: any) => (
                  <SelectItem key={t._id} value={t._id}>
                    {t.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2 text-sm">
              <Badge variant="outline">{sessions.length} حصة</Badge>
              {noSessionsWithoutRooms > 0 && (
                <Badge variant="destructive">{noSessionsWithoutRooms} بدون قاعة</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Grid */}
      {isLoading ? (
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-96 bg-muted rounded" />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Header: same column template as body so lines align (RTL: col 1 = الوقت). */}
              <div
                className="grid border-b sticky top-0 z-20 bg-card"
                style={{
                  gridTemplateColumns: "minmax(52px, 72px) repeat(7, minmax(0, 1fr))",
                }}
              >
                <div className="p-3 text-center text-xs font-medium text-muted-foreground border-l">
                  الوقت
                </div>
                {DAYS_OF_WEEK.map((day) => (
                  <div
                    key={day.value}
                    className={`p-3 text-center text-xs font-medium border-l ${
                      day.value === new Date().getDay()
                        ? "bg-primary/10 text-primary font-bold"
                        : "text-muted-foreground"
                    }`}
                  >
                    {day.label}
                  </div>
                ))}
              </div>

              {/* Body: time rows + one tall column per day so session height matches the time scale. */}
              <div
                className="grid border-b border-border"
                style={{
                  gridTemplateColumns: "minmax(52px, 72px) repeat(7, minmax(0, 1fr))",
                  gridTemplateRows: `repeat(${scheduleRowCount}, ${SLOT_PX}px)`,
                }}
              >
                {visibleSlots.map((slot, idx) => {
                  const isHour = slot.endsWith(":00")
                  return (
                    <div
                      key={`t-${slot}`}
                      className="relative border-l border-b border-border"
                      style={{ gridColumn: 1, gridRow: idx + 1 }}
                    >
                      <span
                        className={`absolute -top-[7px] inset-x-0 text-center text-[10px] leading-none ${
                          isHour
                            ? "font-semibold text-foreground/70"
                            : "text-muted-foreground/60"
                        }`}
                      >
                        {slot}
                      </span>
                    </div>
                  )
                })}

                {DAYS_OF_WEEK.map((day, dayIdx) => {
                  const col = dayIdx + 2
                  const inDay = sessions.filter((s: any) => s.dayOfWeek === day.value)
                  return (
                    <div
                      key={`day-${day.value}`}
                      className="relative min-h-0 border-l border-border"
                      style={{
                        gridColumn: col,
                        gridRow: `1 / ${scheduleRowCount + 1}`,
                      }}
                    >
                      <div
                        className="pointer-events-none absolute inset-0 z-0"
                        aria-hidden
                        style={{
                          backgroundImage: `repeating-linear-gradient(
                            to bottom,
                            transparent 0,
                            transparent ${SLOT_PX - 1}px,
                            hsl(var(--border)) ${SLOT_PX - 1}px,
                            hsl(var(--border)) ${SLOT_PX}px
                          )`,
                        }}
                      />
                      {inDay.map((s: any) => {
                        const rect = sessionRectInDayColumn(s, minRow, scheduleRowCount)
                        if (!rect) return null
                        const roomKey = (s.roomId as any)?._id?.toString() || s._id.toString()
                        const color = colorMap[roomKey]
                        const room = s.roomId as any
                        return (
                          <button
                            key={s._id}
                            type="button"
                            onClick={() => setSelectedSession(s)}
                            className={`schedule-slot-cell absolute left-1 right-1 z-1 rounded border p-1 text-[11px] leading-snug cursor-pointer overflow-hidden text-start shadow-sm transition-[box-shadow,ring-color] hover:ring-2 hover:ring-black/10 dark:hover:ring-white/15 ${color}`}
                            style={{
                              top: `${rect.top}px`,
                              height: `${rect.height}px`,
                            }}
                          >
                            <div className="font-semibold truncate">{s.name}</div>
                            <div className="schedule-slot-meta truncate font-medium" dir="ltr">
                              {s.startTime}-{s.endTime}
                            </div>
                            {room && (
                              <div className="schedule-slot-meta truncate font-medium">
                                {room.name}
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Session Detail Popover */}
      <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedSession?.name}</DialogTitle>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span dir="ltr">{selectedSession.startTime} - {selectedSession.endTime}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  {DAYS_OF_WEEK.find((d) => d.value === selectedSession.dayOfWeek)?.label}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  {selectedSession.studentCount || 0} طالب
                  {selectedSession.roomId && (
                    <span className="text-muted-foreground">/ {selectedSession.roomId.capacity}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <DoorOpen className="h-4 w-4 text-muted-foreground" />
                  {selectedSession.roomId?.name || "بدون قاعة"}
                </div>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">المعلم: </span>
                {selectedSession.teacherId?.fullName || "غير محدد"}
              </div>
              <Button asChild className="w-full">
                <Link href={`/admin/sessions/${selectedSession._id}`}>
                  إدارة الحصة
                </Link>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Conflicts Dialog */}
      <Dialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              تقرير التعارضات
            </DialogTitle>
          </DialogHeader>
          {conflictData ? (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {conflictData.summary.total === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-3" />
                  <p className="font-medium">لا توجد تعارضات</p>
                  <p className="text-sm text-muted-foreground">الجدول نظيف</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <Card>
                      <CardContent className="p-3">
                        <p className="text-2xl font-bold text-destructive">{conflictData.summary.roomConflicts}</p>
                        <p className="text-xs text-muted-foreground">تعارض قاعات</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3">
                        <p className="text-2xl font-bold text-destructive">{conflictData.summary.teacherConflicts}</p>
                        <p className="text-xs text-muted-foreground">تعارض معلمين</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3">
                        <p className="text-2xl font-bold text-amber-600">{conflictData.summary.overCapacity}</p>
                        <p className="text-xs text-muted-foreground">تجاوز سعة</p>
                      </CardContent>
                    </Card>
                  </div>
                  {conflictData.conflicts.map((c: any, i: number) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border ${
                        c.severity === "error"
                          ? "bg-destructive/10 border-destructive/30"
                          : "bg-amber-500/10 border-amber-500/30"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {c.severity === "error" ? (
                          <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                        )}
                        <p className="text-sm">{c.message}</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Auto-Assign Dialog */}
      <Dialog open={autoAssignDialogOpen} onOpenChange={setAutoAssignDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              تعيين تلقائي للقاعات
            </DialogTitle>
          </DialogHeader>
          {autoAssignMutation.isPending && !autoAssignPreview ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin ml-2" />
              <span>جاري الحساب...</span>
            </div>
          ) : autoAssignPreview ? (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {autoAssignPreview.assignments.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    تعيينات مقترحة ({autoAssignPreview.assignments.length})
                  </h4>
                  {autoAssignPreview.assignments.map((a: any) => (
                    <div key={a.sessionId} className="p-2 rounded border mb-2 bg-emerald-500/5">
                      <div className="font-medium text-sm">{a.sessionName}</div>
                      <div className="text-xs text-muted-foreground">
                        ← {a.roomName} • {a.reason}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {autoAssignPreview.unassignable.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive" />
                    لا يمكن تعيينهم ({autoAssignPreview.unassignable.length})
                  </h4>
                  {autoAssignPreview.unassignable.map((u: any) => (
                    <div key={u.sessionId} className="p-2 rounded border mb-2 bg-destructive/5">
                      <div className="font-medium text-sm">{u.sessionName}</div>
                      <div className="text-xs text-muted-foreground">{u.reason}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAutoAssignDialogOpen(false)}>
              إلغاء
            </Button>
            {autoAssignPreview?.assignments?.length > 0 && (
              <Button
                onClick={() => autoAssignMutation.mutate(true)}
                disabled={autoAssignMutation.isPending}
              >
                {autoAssignMutation.isPending && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
                تطبيق ({autoAssignPreview.assignments.length})
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
