"use client"

import { useState, useEffect, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Pencil, 
  Trash2,
  Loader2,
  Users,
  Clock,
  Calendar,
  CalendarCheck,
  CalendarX,
  RefreshCw,
  ChevronLeft,
  ArrowLeft,
  BookOpen
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { sessionTemplateFormSchema, type SessionTemplateFormInput } from "@/lib/validations"
import { DAYS_OF_WEEK, DEFAULT_QR_SETTINGS } from "@/lib/constants"
import { DoorOpen } from "lucide-react"
import { DateInput } from "@/components/ui/date-input"
import { useToast } from "@/components/ui/toast"
import Link from "next/link"
import { useTranslations } from "next-intl"

interface SessionTemplate {
  _id: string
  name: string
  teacherId: { _id: string; fullName: string }
  roomId?: { _id: string; name: string; capacity: number }
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive: boolean
  studentCount?: number
}

interface RoomOption {
  _id: string
  name: string
  capacity: number
  isActive: boolean
}

interface Teacher {
  _id: string
  fullName: string
}

async function fetchSessions(): Promise<SessionTemplate[]> {
  const res = await fetch("/api/sessions?limit=200")
  if (!res.ok) throw new Error("Failed to fetch sessions")
  return (await res.json()).data
}

async function fetchTeachers(): Promise<Teacher[]> {
  const res = await fetch("/api/teachers?limit=200")
  if (!res.ok) throw new Error("Failed to fetch teachers")
  return (await res.json()).data
}

async function fetchRooms(): Promise<RoomOption[]> {
  const res = await fetch("/api/rooms?limit=200")
  if (!res.ok) throw new Error("Failed to fetch rooms")
  return (await res.json()).data
}

async function createSession(data: SessionTemplateFormInput) {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.message || "Failed to create session")
  }
  return res.json()
}

async function updateSession(id: string, data: Partial<SessionTemplateFormInput> & { isActive?: boolean }) {
  const res = await fetch(`/api/sessions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.message || "Failed to update session")
  }
  return res.json()
}

async function deleteSession(id: string) {
  const res = await fetch(`/api/sessions/${id}`, {
    method: "DELETE",
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.message || "Failed to delete session")
  }
  return res.json()
}

// Session Card Component
function SessionCard({ session, onEdit, onDelete }: { 
  session: SessionTemplate
  onEdit: (session: SessionTemplate) => void
  onDelete: (id: string) => void 
}) {
  const t = useTranslations("admin.sessions")
  const tc = useTranslations("common")
  const today = new Date().getDay()
  const isToday = session.dayOfWeek === today
  const now = new Date()
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  const isOngoing = isToday && currentTime >= session.startTime && currentTime <= session.endTime

  return (
    <Card className={`group transition-all hover:shadow-md ${isOngoing ? 'ring-2 ring-emerald-500' : ''} ${!session.isActive ? 'opacity-60' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              isOngoing 
                ? 'bg-emerald-500/20 text-emerald-600' 
                : 'bg-primary/10 text-primary'
            }`}>
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{session.name}</h3>
                {isOngoing && (
                  <Badge variant="default" className="bg-emerald-500 text-xs animate-pulse">
                    {t("ongoingNow")}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {session.teacherId?.fullName || t("unassigned")}
              </p>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <Badge variant="outline" className="font-normal">
                  <Calendar className="h-3 w-3 ml-1" />
                  {tc('days.' + String(session.dayOfWeek))}
                </Badge>
                <span className="text-sm font-medium text-primary" dir="ltr">
                  {session.startTime} - {session.endTime}
                </span>
                {session.roomId && (
                  <Badge variant="secondary" className="font-normal">
                    <DoorOpen className="h-3 w-3 ml-1" />
                    {session.roomId.name}
                    <span className="text-muted-foreground mr-1">
                      ({session.studentCount || 0}/{session.roomId.capacity})
                    </span>
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant={session.isActive ? "success" : "destructive"} className="font-normal">
              {session.isActive ? tc("active") : tc("inactive")}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem asChild>
                  <Link href={`/admin/sessions/${session._id}`}>
                    <Users className="ml-2 h-4 w-4" />
                    {t("manageStudents")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(session)}>
                  <Pencil className="ml-2 h-4 w-4" />
                  {tc("edit")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDelete(session._id)}
                >
                  <Trash2 className="ml-2 h-4 w-4" />
                  {tc("delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {/* Quick action */}
        <div className="mt-4 pt-3 border-t">
          <Button variant="ghost" size="sm" className="w-full justify-between" asChild>
            <Link href={`/admin/sessions/${session._id}`}>
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                {t("manageEnrolledStudents")}
              </span>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function SessionsPage() {
  const t = useTranslations("admin.sessions")
  const tc = useTranslations("common")
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const [search, setSearch] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingSession, setEditingSession] = useState<SessionTemplate | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string>("all")

  useEffect(() => {
    setMounted(true)
  }, [])

  const { data: sessions, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["sessions"],
    queryFn: fetchSessions,
    retry: 3,
    retryDelay: 1000,
  })

  const { data: teachers } = useQuery({
    queryKey: ["teachers"],
    queryFn: fetchTeachers,
  })

  const { data: rooms } = useQuery({
    queryKey: ["rooms"],
    queryFn: fetchRooms,
  })

  const activeRooms = rooms?.filter((r: RoomOption) => r.isActive) || []

  const createMutation = useMutation({
    mutationFn: createSession,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] })
      setIsCreateOpen(false)
      reset()
      success(t("createSuccess"), t("createSuccessMsg", { name: data.name }))
    },
    onError: (err: Error) => {
      error(t("createError"), err.message || t("createErrorMsg"))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SessionTemplateFormInput> & { isActive?: boolean } }) =>
      updateSession(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] })
      setIsEditOpen(false)
      setEditingSession(null)
      resetEdit()
      success(t("updateSuccess"), t("updateSuccessMsg"))
    },
    onError: (err: Error) => {
      error(t("updateError"), err.message || t("updateErrorMsg"))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] })
      setDeleteId(null)
      success(t("deleteSuccess"), t("deleteSuccessMsg"))
    },
    onError: (err: Error) => {
      error(t("deleteError"), err.message || t("deleteErrorMsg"))
    },
  })

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<SessionTemplateFormInput>({
    resolver: zodResolver(sessionTemplateFormSchema),
    defaultValues: {
      qrOpenOffsetBeforeMin: DEFAULT_QR_SETTINGS.openOffsetBeforeMin,
      qrCloseOffsetAfterMin: DEFAULT_QR_SETTINGS.closeOffsetAfterMin,
    },
  })

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    control: controlEdit,
    setValue: setValueEdit,
    formState: { errors: errorsEdit },
  } = useForm<SessionTemplateFormInput>({
    resolver: zodResolver(sessionTemplateFormSchema),
  })

  useEffect(() => {
    if (editingSession) {
      setValueEdit("name", editingSession.name)
      setValueEdit("teacherId", editingSession.teacherId._id)
      setValueEdit("dayOfWeek", editingSession.dayOfWeek)
      setValueEdit("startTime", editingSession.startTime)
      setValueEdit("endTime", editingSession.endTime)
      setValueEdit("effectiveFromDate", new Date().toISOString().split("T")[0])
      setValueEdit("qrOpenOffsetBeforeMin", DEFAULT_QR_SETTINGS.openOffsetBeforeMin)
      setValueEdit("qrCloseOffsetAfterMin", DEFAULT_QR_SETTINGS.closeOffsetAfterMin)
      if (editingSession.roomId) {
        setValueEdit("roomId", editingSession.roomId._id)
      }
    }
  }, [editingSession, setValueEdit])

  const onCreateSubmit = (data: SessionTemplateFormInput) => {
    createMutation.mutate(data)
  }

  const onEditSubmit = (data: SessionTemplateFormInput) => {
    if (!editingSession) return
    updateMutation.mutate({ id: editingSession._id, data })
  }

  const handleEditClick = (session: SessionTemplate) => {
    setEditingSession(session)
    setIsEditOpen(true)
  }

  // Filter and organize sessions
  const { filteredSessions, stats, sessionsByDay } = useMemo(() => {
    if (!sessions) return { filteredSessions: [], stats: { total: 0, active: 0, inactive: 0 }, sessionsByDay: {} }

    const active = sessions.filter(s => s.isActive).length
    const inactive = sessions.length - active

    // Group by day
    const byDay: Record<number, SessionTemplate[]> = {}
    sessions.forEach(session => {
      if (!byDay[session.dayOfWeek]) byDay[session.dayOfWeek] = []
      byDay[session.dayOfWeek].push(session)
    })

    // Sort each day's sessions by start time
    Object.values(byDay).forEach(daySessions => {
      daySessions.sort((a, b) => a.startTime.localeCompare(b.startTime))
    })

    let filtered = sessions

    // Filter by day
    if (selectedDay !== "all") {
      filtered = filtered.filter(s => s.dayOfWeek === parseInt(selectedDay))
    }

    // Filter by search
    if (search) {
      filtered = filtered.filter(session =>
        session.name.toLowerCase().includes(search.toLowerCase()) ||
        session.teacherId?.fullName?.toLowerCase().includes(search.toLowerCase())
      )
    }

    // Sort by day and time
    filtered.sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
      return a.startTime.localeCompare(b.startTime)
    })

    return {
      filteredSessions: filtered,
      stats: { total: sessions.length, active, inactive },
      sessionsByDay: byDay
    }
  }, [sessions, search, selectedDay])

  const today = new Date().getDay()

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
      >
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ml-2 ${isFetching ? 'animate-spin' : ''}`} />
            {tc("refresh")}
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={(open) => {
            setIsCreateOpen(open)
            if (!open) reset()
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="ml-2 h-4 w-4" />
                {t("addSession")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{t("addSession")}</DialogTitle>
                <DialogDescription>
                  {t("createDescription")}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onCreateSubmit)}>
                <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t("sessionName")} *</Label>
                    <Input
                      id="name"
                      placeholder={t("sessionNamePlaceholder")}
                      {...register("name")}
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive">{errors.name.message}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="teacherId">{t("teacher")} *</Label>
                    <Controller
                      name="teacherId"
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder={t("selectTeacher")} />
                          </SelectTrigger>
                          <SelectContent>
                            {teachers?.map((teacher) => (
                              <SelectItem key={teacher._id} value={teacher._id}>
                                {teacher.fullName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.teacherId && (
                      <p className="text-sm text-destructive">{errors.teacherId.message}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label>{t("roomLabel")}</Label>
                    <Controller
                      name="roomId"
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <SelectTrigger>
                            <SelectValue placeholder={t("selectRoomOptional")} />
                          </SelectTrigger>
                          <SelectContent>
                            {activeRooms.map((room: RoomOption) => (
                              <SelectItem key={room._id} value={room._id}>
                                {room.name} ({room.capacity} {t("seat")})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dayOfWeek">{t("day")} *</Label>
                    <Controller
                      name="dayOfWeek"
                      control={control}
                      render={({ field }) => (
                        <Select
                          onValueChange={(val) => field.onChange(parseInt(val))}
                          value={field.value?.toString()}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t("day")} />
                          </SelectTrigger>
                          <SelectContent>
                            {DAYS_OF_WEEK.map((day) => (
                              <SelectItem key={day.value} value={day.value.toString()}>
                                {tc('days.' + String(day.value))}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.dayOfWeek && (
                      <p className="text-sm text-destructive">{errors.dayOfWeek.message}</p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startTime">{t("startTime")} *</Label>
                      <Input
                        id="startTime"
                        type="time"
                        dir="ltr"
                        {...register("startTime")}
                      />
                      {errors.startTime && (
                        <p className="text-sm text-destructive">{errors.startTime.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endTime">{t("endTime")} *</Label>
                      <Input
                        id="endTime"
                        type="time"
                        dir="ltr"
                        {...register("endTime")}
                      />
                      {errors.endTime && (
                        <p className="text-sm text-destructive">{errors.endTime.message}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="effectiveFromDate">{t("effectiveFrom")} *</Label>
                    <Controller
                      name="effectiveFromDate"
                      control={control}
                      render={({ field }) => (
                        <DateInput
                          id="effectiveFromDate"
                          value={field.value || ''}
                          onChange={field.onChange}
                          error={!!errors.effectiveFromDate}
                          showCalendarButton
                        />
                      )}
                    />
                    {errors.effectiveFromDate && (
                      <p className="text-sm text-destructive">{errors.effectiveFromDate.message}</p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="qrOpenOffsetBeforeMin">{t("qrOpenBefore")}</Label>
                      <Input
                        id="qrOpenOffsetBeforeMin"
                        type="number"
                        min={0}
                        max={60}
                        {...register("qrOpenOffsetBeforeMin", { valueAsNumber: true })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="qrCloseOffsetAfterMin">{t("qrCloseAfter")}</Label>
                      <Input
                        id="qrCloseOffsetAfterMin"
                        type="number"
                        min={0}
                        max={120}
                        {...register("qrCloseOffsetAfterMin", { valueAsNumber: true })}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">{t("sessionDescriptionLabel")}</Label>
                    <Textarea
                      id="description"
                      placeholder={t("sessionDescriptionPlaceholder")}
                      {...register("description")}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateOpen(false)}
                  >
                    {tc("cancel")}
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && (
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    )}
                    {t("addSession")}
                  </Button>
                </DialogFooter>
                {createMutation.error && (
                  <p className="text-sm text-destructive mt-2 text-center">
                    {createMutation.error.message}
                  </p>
                )}
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Calendar className="h-5 w-5 text-blue-700 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">{t("title")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <CalendarCheck className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.active}</p>
              <p className="text-xs text-muted-foreground">{t("activeSessions")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/20">
              <CalendarX className="h-5 w-5 text-red-700 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.inactive}</p>
              <p className="text-xs text-muted-foreground">{t("inactiveSessions")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={selectedDay} onValueChange={setSelectedDay}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder={t("selectDay")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allDays")}</SelectItem>
                {DAYS_OF_WEEK.map((day) => (
                  <SelectItem key={day.value} value={day.value.toString()}>
                    <div className="flex items-center gap-2">
                      {tc('days.' + String(day.value))}
                      {day.value === today && (
                        <Badge variant="secondary" className="text-xs">{t("today")}</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Sessions Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredSessions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            {search || selectedDay !== "all" ? (
              <>
                <p className="font-medium">{tc("noResults")}</p>
                <p className="text-sm mt-1">{t("tryDifferentSearch")}</p>
                <Button 
                  variant="outline" 
                  className="mt-4" 
                  onClick={() => { setSearch(""); setSelectedDay("all") }}
                >
                  {t("clearFilters")}
                </Button>
              </>
            ) : (
              <>
                <p className="font-medium">{t("noSessions")}</p>
                <p className="text-sm mt-1">{t("startAddSession")}</p>
                <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
                  <Plus className="h-4 w-4 ml-2" />
                  {t("addSession")}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSessions.map((session) => (
            <SessionCard
              key={session._id}
              session={session}
              onEdit={handleEditClick}
              onDelete={setDeleteId}
            />
          ))}
        </div>
      )}

      {/* Results Count */}
      {!isLoading && filteredSessions.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          {t("showingCount", { count: filteredSessions.length, total: stats.total })}
        </p>
      )}

      {/* Edit Dialog */}
      {mounted && (
        <Dialog open={isEditOpen} onOpenChange={(open) => {
          setIsEditOpen(open)
          if (!open) {
            setEditingSession(null)
            resetEdit()
          }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{tc("edit")}</DialogTitle>
              <DialogDescription>
                {t("editDescription")}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmitEdit(onEditSubmit)}>
              <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">{t("sessionName")} *</Label>
                  <Input
                    id="edit-name"
                    placeholder={t("editSessionNamePlaceholder")}
                    {...registerEdit("name")}
                  />
                  {errorsEdit.name && (
                    <p className="text-sm text-destructive">{errorsEdit.name.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-teacherId">{t("teacher")} *</Label>
                  <Controller
                    name="teacherId"
                    control={controlEdit}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectTeacher")} />
                        </SelectTrigger>
                        <SelectContent>
                          {teachers?.map((teacher) => (
                            <SelectItem key={teacher._id} value={teacher._id}>
                              {teacher.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>{t("roomLabel")}</Label>
                  <Controller
                    name="roomId"
                    control={controlEdit}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectRoomOptional")} />
                        </SelectTrigger>
                        <SelectContent>
                          {activeRooms.map((room: RoomOption) => (
                            <SelectItem key={room._id} value={room._id}>
                              {room.name} ({room.capacity} {t("seat")})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-dayOfWeek">{t("day")} *</Label>
                  <Controller
                    name="dayOfWeek"
                    control={controlEdit}
                    render={({ field }) => (
                      <Select 
                        onValueChange={(val) => field.onChange(parseInt(val))} 
                        value={field.value?.toString()}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectDay")} />
                        </SelectTrigger>
                        <SelectContent>
                          {DAYS_OF_WEEK.map((day) => (
                            <SelectItem key={day.value} value={day.value.toString()}>
                              {tc('days.' + String(day.value))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-startTime">{t("startTime")} *</Label>
                    <Input
                      id="edit-startTime"
                      type="time"
                      dir="ltr"
                      {...registerEdit("startTime")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-endTime">{t("endTime")} *</Label>
                    <Input
                      id="edit-endTime"
                      type="time"
                      dir="ltr"
                      {...registerEdit("endTime")}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-effectiveFromDate">{t("effectiveFrom")} *</Label>
                  <Controller
                    name="effectiveFromDate"
                    control={controlEdit}
                    render={({ field }) => (
                      <DateInput
                        id="edit-effectiveFromDate"
                        value={field.value || ''}
                        onChange={field.onChange}
                        error={!!errorsEdit.effectiveFromDate}
                        showCalendarButton
                      />
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-qrOpenOffsetBeforeMin">{t("qrOpenBefore")}</Label>
                    <Input
                      id="edit-qrOpenOffsetBeforeMin"
                      type="number"
                      min={0}
                      max={60}
                      {...registerEdit("qrOpenOffsetBeforeMin", { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-qrCloseOffsetAfterMin">{t("qrCloseAfter")}</Label>
                    <Input
                      id="edit-qrCloseOffsetAfterMin"
                      type="number"
                      min={0}
                      max={120}
                      {...registerEdit("qrCloseOffsetAfterMin", { valueAsNumber: true })}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-description">{t("sessionDescriptionLabel")}</Label>
                  <Textarea
                    id="edit-description"
                    placeholder={t("sessionDescriptionPlaceholder")}
                    {...registerEdit("description")}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditOpen(false)}
                >
                  {tc("cancel")}
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && (
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  )}
                  {tc("save")}
                </Button>
              </DialogFooter>
              {updateMutation.error && (
                <p className="text-sm text-destructive mt-2 text-center">
                  {updateMutation.error.message}
                </p>
              )}
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation */}
      {mounted && (
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{tc("deleteConfirm")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("deleteConfirmMsg")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              >
                {deleteMutation.isPending && (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                )}
                {tc("delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
