"use client"

import { useState, use, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  ArrowRight, 
  Plus, 
  Search, 
  Trash2, 
  Users, 
  Clock,
  Calendar,
  User,
  Loader2,
  AlertTriangle,
  ClipboardCheck,
  Phone,
  RefreshCw,
  UserCheck,
  UserX,
  Eye,
  DoorOpen
} from "lucide-react"
import { useToast } from "@/components/ui/toast"
import { useTranslations } from "next-intl"

interface SessionDetail {
  _id: string
  name: string
  teacherId: { _id: string; fullName: string; email: string }
  roomId?: { _id: string; name: string; capacity: number; features?: string[]; location?: string }
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive: boolean
  students: Array<{
    _id: string
    fullName: string
    parentName?: string
    phone?: string
    isActive: boolean
  }>
}

interface Student {
  _id: string
  fullName: string
  parentName?: string
  isActive: boolean
}

async function fetchSession(id: string): Promise<SessionDetail> {
  const res = await fetch(`/api/sessions/${id}`)
  if (!res.ok) throw new Error("Failed to fetch session")
  return res.json()
}

async function fetchAllStudents(): Promise<Student[]> {
  const res = await fetch("/api/students?limit=200")
  if (!res.ok) throw new Error("Failed to fetch students")
  return (await res.json()).data
}

async function addStudentsToSession(sessionId: string, studentIds: string[], forceOverCapacity = false) {
  const res = await fetch(`/api/sessions/${sessionId}/students`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentIds, forceOverCapacity }),
  })
  if (!res.ok) throw new Error("Failed to add students")
  return res.json()
}

async function removeStudentFromSession(sessionId: string, studentId: string) {
  const res = await fetch(`/api/sessions/${sessionId}/students?studentId=${studentId}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to remove student")
  return res.json()
}

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const t = useTranslations("admin.sessions")
  const tc = useTranslations("common")
  const queryClient = useQueryClient()
  const { success, error: showError, warning } = useToast()
  const [search, setSearch] = useState("")
  const [studentSearch, setStudentSearch] = useState("")
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [removeStudentId, setRemoveStudentId] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<string[]>([])
  const [capacityWarning, setCapacityWarning] = useState<any>(null)

  const { data: session, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["session", id],
    queryFn: () => fetchSession(id),
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  })

  const { data: allStudents } = useQuery({
    queryKey: ["students"],
    queryFn: fetchAllStudents,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  })

  const addMutation = useMutation({
    mutationFn: ({ studentIds, force }: { studentIds: string[]; force?: boolean }) =>
      addStudentsToSession(id, studentIds, force),
    onSuccess: (data) => {
      if (data.capacityExceeded) {
        setCapacityWarning(data)
        return
      }
      queryClient.invalidateQueries({ queryKey: ["session", id] })
      if (data.conflicts?.length > 0) {
        setConflicts(data.conflicts)
        warning(t("conflictWarning"), t("addStudentsConflictMsg", { count: data.conflicts.length }))
      } else {
        setIsAddOpen(false)
        setSelectedStudents([])
        setCapacityWarning(null)
        success(t("addSuccess"), t("addStudentsSuccessMsg"))
      }
    },
    onError: (err: Error) => {
      showError(t("addError"), err.message || t("addStudentsErrorMsg"))
    },
  })

  const removeMutation = useMutation({
    mutationFn: (studentId: string) => removeStudentFromSession(id, studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", id] })
      setRemoveStudentId(null)
      success(t("removeSuccess"), t("removeSuccessMsg"))
    },
    onError: (err: Error) => {
      showError(t("removeError"), err.message || t("removeErrorMsg"))
    },
  })

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
  }

  // Filter students not already in session
  const availableStudents = useMemo(() => {
    if (!allStudents || !session) return []
    return allStudents.filter(
      (s) => !session.students.some((ss) => ss._id === s._id) && s.isActive
    )
  }, [allStudents, session])

  const filteredAvailableStudents = useMemo(() => {
    if (!search) return availableStudents
    return availableStudents.filter((s) =>
      s.fullName.toLowerCase().includes(search.toLowerCase())
    )
  }, [availableStudents, search])

  const filteredSessionStudents = useMemo(() => {
    if (!session?.students) return []
    if (!studentSearch) return session.students
    return session.students.filter((s) =>
      s.fullName.toLowerCase().includes(studentSearch.toLowerCase())
    )
  }, [session?.students, studentSearch])

  // Stats
  const stats = useMemo(() => {
    if (!session?.students) return { total: 0, active: 0, inactive: 0 }
    const active = session.students.filter(s => s.isActive).length
    return {
      total: session.students.length,
      active,
      inactive: session.students.length - active
    }
  }, [session?.students])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/admin/sessions">
            <ArrowRight className="ml-2 h-4 w-4" />
            {tc("back")}
          </Link>
        </Button>
        <Card>
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-destructive" />
            <p className="text-destructive font-medium">{tc("serverError")}</p>
            <p className="text-sm text-muted-foreground mt-1">{t("tryAgain")}</p>
            <Button className="mt-4" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 ml-2" />
              {tc("refresh")}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/admin/sessions">
            <ArrowRight className="ml-2 h-4 w-4" />
            {tc("back")}
          </Link>
        </Button>
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            {t("sessionNotFound")}
          </CardContent>
        </Card>
      </div>
    )
  }

  const today = new Date().getDay()
  const isToday = session.dayOfWeek === today
  const now = new Date()
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  const isOngoing = isToday && currentTime >= session.startTime && currentTime <= session.endTime

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href="/admin/sessions">
            <ArrowRight className="ml-2 h-4 w-4" />
            {tc("back")}
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ml-2 ${isFetching ? 'animate-spin' : ''}`} />
            {tc("refresh")}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/attendance">
              <ClipboardCheck className="h-4 w-4 ml-2" />
              {t("manageAttendance")}
            </Link>
          </Button>
        </div>
      </div>

      {/* Header */}
      <PageHeader
        title={session.name}
        description={`${tc('days.' + String(session.dayOfWeek))} • ${session.startTime} - ${session.endTime}`}
      >
        <div className="flex items-center gap-2">
          {isOngoing && (
            <Badge variant="default" className="bg-emerald-500 animate-pulse">
              {t("ongoingNow")}
            </Badge>
          )}
          <Badge variant={session.isActive ? "success" : "destructive"}>
            {session.isActive ? tc("active") : tc("inactive")}
          </Badge>
        </div>
      </PageHeader>

      {/* Info Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("teacher")}</p>
              <p className="font-medium">{session.teacherId?.fullName}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Clock className="h-5 w-5 text-blue-700 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("time")}</p>
              <p className="font-medium" dir="ltr">{session.startTime} - {session.endTime}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <UserCheck className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("studentCount")}</p>
              <p className="font-medium">{stats.active} {tc("student")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <Users className="h-5 w-5 text-amber-700 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{tc("total")}</p>
              <p className="font-medium">{stats.total} {tc("student")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Room Info */}
      {session.roomId && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-500/20">
                  <DoorOpen className="h-5 w-5 text-violet-700 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("room")}</p>
                  <p className="font-medium">{session.roomId.name}</p>
                  {session.roomId.location && (
                    <p className="text-xs text-muted-foreground">{session.roomId.location}</p>
                  )}
                </div>
              </div>
              <div className="text-left">
                <div className="text-sm font-medium mb-1">
                  {stats.total}/{session.roomId.capacity} {t("seat")}
                </div>
                <div className="h-2 w-24 bg-muted rounded-full overflow-hidden">
                  {(() => {
                    const pct = session.roomId.capacity > 0 ? Math.round((stats.total / session.roomId.capacity) * 100) : 0
                    return (
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct > 100 ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    )
                  })()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Students Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <CardTitle className="text-lg">{t("enrollStudents")}</CardTitle>
            {session.students.length > 0 && (
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("searchStudents")}
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="pr-10 h-9"
                />
              </div>
            )}
          </div>
          <Dialog open={isAddOpen} onOpenChange={(open) => {
            setIsAddOpen(open)
            if (!open) {
              setSelectedStudents([])
              setConflicts([])
              setSearch("")
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="ml-2 h-4 w-4" />
                {tc("add")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{t("enrollStudents")}</DialogTitle>
                <DialogDescription>
                  {t("enrollDescription", { count: availableStudents.length })}
                </DialogDescription>
              </DialogHeader>

              {conflicts.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">{t("scheduleConflicts")}</span>
                  </div>
                  <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                    {conflicts.map((c, i) => (
                      <li key={i}>• {c}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("searchStudent")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-10"
                />
              </div>

              {selectedStudents.length > 0 && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-primary/10">
                  <span className="text-sm font-medium">{t("selectedCount", { count: selectedStudents.length })}</span>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedStudents([])}>
                    {t("deselectAll")}
                  </Button>
                </div>
              )}

              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {filteredAvailableStudents.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>{search ? tc("noResults") : t("noAvailableStudents")}</p>
                    </div>
                  ) : (
                    filteredAvailableStudents.map((student) => (
                      <div
                        key={student._id}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedStudents.includes(student._id) 
                            ? 'bg-primary/10 border border-primary/30' 
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => {
                          setSelectedStudents((prev) =>
                            prev.includes(student._id)
                              ? prev.filter((id) => id !== student._id)
                              : [...prev, student._id]
                          )
                        }}
                      >
                        <Checkbox
                          checked={selectedStudents.includes(student._id)}
                          onCheckedChange={() => {}}
                        />
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {getInitials(student.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{student.fullName}</p>
                          {student.parentName && (
                            <p className="text-xs text-muted-foreground">
                              {t("parentLabel")} {student.parentName}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsAddOpen(false)}
                >
                  {tc("cancel")}
                </Button>
                <Button
                  onClick={() => addMutation.mutate({ studentIds: selectedStudents })}
                  disabled={selectedStudents.length === 0 || addMutation.isPending}
                >
                  {addMutation.isPending && (
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  )}
                  {t("addCount", { count: selectedStudents.length })}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {session.students.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="font-medium text-lg">{t("noStudentsYet")}</p>
              <p className="text-sm mt-1">{t("startAddStudents")}</p>
              <Button className="mt-4" onClick={() => setIsAddOpen(true)}>
                <Plus className="h-4 w-4 ml-2" />
                {tc("add")}
              </Button>
            </div>
          ) : filteredSessionStudents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>{tc("noResults")}</p>
              <Button variant="outline" className="mt-4" onClick={() => setStudentSearch("")}>
                {tc("reset")}
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSessionStudents.map((student) => (
                <div
                  key={student._id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors group ${
                    student.isActive 
                      ? 'bg-card hover:bg-muted/50' 
                      : 'bg-muted/30 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="border-2 border-background shadow-sm">
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">
                        {getInitials(student.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <Link 
                          href={`/admin/students/${student._id}`}
                          className="font-medium hover:text-primary transition-colors"
                        >
                          {student.fullName}
                        </Link>
                        {!student.isActive && (
                          <Badge variant="outline" className="text-xs">{tc("inactive")}</Badge>
                        )}
                      </div>
                      {student.phone && (
                        <a 
                          href={`tel:${student.phone}`}
                          className="text-xs text-muted-foreground flex items-center gap-1 hover:text-primary transition-colors"
                          dir="ltr"
                        >
                          <Phone className="h-3 w-3" />
                          {student.phone}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      asChild
                    >
                      <Link href={`/admin/students/${student._id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setRemoveStudentId(student._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Results count */}
          {session.students.length > 0 && filteredSessionStudents.length > 0 && (
            <p className="text-sm text-muted-foreground text-center mt-4">
              {t("showingStudentCount", { count: filteredSessionStudents.length, total: session.students.length })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Capacity Override Confirmation */}
      <AlertDialog open={!!capacityWarning} onOpenChange={() => setCapacityWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {t("roomFull")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {capacityWarning?.message || t("capacityExceeded")}
              <br />
              <span className="font-medium">
                {t("availableSeats", { available: capacityWarning?.availableSlots || 0, total: capacityWarning?.capacity || 0 })}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 text-white hover:bg-amber-700"
              onClick={() => {
                setCapacityWarning(null)
                addMutation.mutate({ studentIds: selectedStudents, force: true })
              }}
            >
              {t("addAnyway")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Confirmation */}
      <AlertDialog open={!!removeStudentId} onOpenChange={() => setRemoveStudentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("removeStudentTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("removeStudentConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removeStudentId && removeMutation.mutate(removeStudentId)}
            >
              {removeMutation.isPending && (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              )}
              {tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
