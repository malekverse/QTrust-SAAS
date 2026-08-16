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
import { getDayName } from "@/lib/utils"
import { useToast } from "@/components/ui/toast"

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
        warning("تنبيه", `تم إضافة بعض الطلاب مع وجود ${data.conflicts.length} تعارض`)
      } else {
        setIsAddOpen(false)
        setSelectedStudents([])
        setCapacityWarning(null)
        success("تم الإضافة", `تم إضافة الطلاب للحصة`)
      }
    },
    onError: (err: Error) => {
      showError("فشل الإضافة", err.message || "حدث خطأ أثناء إضافة الطلاب")
    },
  })

  const removeMutation = useMutation({
    mutationFn: (studentId: string) => removeStudentFromSession(id, studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", id] })
      setRemoveStudentId(null)
      success("تم الإزالة", "تم إزالة الطالب من الحصة")
    },
    onError: (err: Error) => {
      showError("فشل الإزالة", err.message || "حدث خطأ أثناء إزالة الطالب")
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
            العودة للقائمة
          </Link>
        </Button>
        <Card>
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-destructive" />
            <p className="text-destructive font-medium">حدث خطأ أثناء تحميل بيانات الحصة</p>
            <p className="text-sm text-muted-foreground mt-1">يرجى المحاولة مرة أخرى</p>
            <Button className="mt-4" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 ml-2" />
              إعادة المحاولة
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
            العودة للقائمة
          </Link>
        </Button>
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            الحصة غير موجودة
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
            العودة للقائمة
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ml-2 ${isFetching ? 'animate-spin' : ''}`} />
            تحديث
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/attendance">
              <ClipboardCheck className="h-4 w-4 ml-2" />
              إدارة الحضور
            </Link>
          </Button>
        </div>
      </div>

      {/* Header */}
      <PageHeader
        title={session.name}
        description={`${getDayName(session.dayOfWeek)} • ${session.startTime} - ${session.endTime}`}
      >
        <div className="flex items-center gap-2">
          {isOngoing && (
            <Badge variant="default" className="bg-emerald-500 animate-pulse">
              جارية الآن
            </Badge>
          )}
          <Badge variant={session.isActive ? "success" : "destructive"}>
            {session.isActive ? "فعالة" : "معطلة"}
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
              <p className="text-sm text-muted-foreground">المعلم</p>
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
              <p className="text-sm text-muted-foreground">الوقت</p>
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
              <p className="text-sm text-muted-foreground">طلاب نشطون</p>
              <p className="font-medium">{stats.active} طالب</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <Users className="h-5 w-5 text-amber-700 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">إجمالي الطلاب</p>
              <p className="font-medium">{stats.total} طالب</p>
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
                  <p className="text-sm text-muted-foreground">القاعة</p>
                  <p className="font-medium">{session.roomId.name}</p>
                  {session.roomId.location && (
                    <p className="text-xs text-muted-foreground">{session.roomId.location}</p>
                  )}
                </div>
              </div>
              <div className="text-left">
                <div className="text-sm font-medium mb-1">
                  {stats.total}/{session.roomId.capacity} مقعد
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
            <CardTitle className="text-lg">الطلاب المسجلون</CardTitle>
            {session.students.length > 0 && (
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث في الطلاب..."
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
                إضافة طلاب
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>إضافة طلاب للحصة</DialogTitle>
                <DialogDescription>
                  اختر الطلاب الذين تريد إضافتهم لهذه الحصة ({availableStudents.length} متاح)
                </DialogDescription>
              </DialogHeader>

              {conflicts.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">تعارضات في المواعيد</span>
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
                  placeholder="البحث عن طالب..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-10"
                />
              </div>

              {selectedStudents.length > 0 && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-primary/10">
                  <span className="text-sm font-medium">تم اختيار {selectedStudents.length} طالب</span>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedStudents([])}>
                    إلغاء التحديد
                  </Button>
                </div>
              )}

              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {filteredAvailableStudents.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>{search ? "لا توجد نتائج للبحث" : "لا يوجد طلاب متاحون"}</p>
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
                              ولي الأمر: {student.parentName}
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
                  إلغاء
                </Button>
                <Button
                  onClick={() => addMutation.mutate({ studentIds: selectedStudents })}
                  disabled={selectedStudents.length === 0 || addMutation.isPending}
                >
                  {addMutation.isPending && (
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  )}
                  إضافة ({selectedStudents.length})
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {session.students.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="font-medium text-lg">لم يتم تسجيل أي طالب في هذه الحصة بعد</p>
              <p className="text-sm mt-1">ابدأ بإضافة طلاب للحصة</p>
              <Button className="mt-4" onClick={() => setIsAddOpen(true)}>
                <Plus className="h-4 w-4 ml-2" />
                إضافة طلاب
              </Button>
            </div>
          ) : filteredSessionStudents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>لا توجد نتائج للبحث</p>
              <Button variant="outline" className="mt-4" onClick={() => setStudentSearch("")}>
                مسح البحث
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
                          <Badge variant="outline" className="text-xs">غير نشط</Badge>
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
              عرض {filteredSessionStudents.length} من {session.students.length} طالب
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
              القاعة ممتلئة
            </AlertDialogTitle>
            <AlertDialogDescription>
              {capacityWarning?.message || "تم تجاوز سعة القاعة"}
              <br />
              <span className="font-medium">
                المقاعد المتاحة: {capacityWarning?.availableSlots || 0} من {capacityWarning?.capacity || 0}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 text-white hover:bg-amber-700"
              onClick={() => {
                setCapacityWarning(null)
                addMutation.mutate({ studentIds: selectedStudents, force: true })
              }}
            >
              إضافة رغم ذلك
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Confirmation */}
      <AlertDialog open={!!removeStudentId} onOpenChange={() => setRemoveStudentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>إزالة الطالب من الحصة</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من إزالة هذا الطالب من الحصة؟ يمكنك إعادة إضافته لاحقاً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removeStudentId && removeMutation.mutate(removeStudentId)}
            >
              {removeMutation.isPending && (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              )}
              إزالة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
