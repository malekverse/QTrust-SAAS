"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  BookOpen,
  Loader2,
  Plus,
  CheckCircle,
  Search,
} from "lucide-react"
import {
  HIFZ_TYPE,
  HIFZ_TYPE_LABELS,
  HIFZ_QUALITY,
  HIFZ_QUALITY_LABELS,
} from "@/lib/constants"
import { useToast } from "@/components/ui/toast"

interface Student {
  _id: string
  fullName: string
}

interface HifzLog {
  _id: string
  studentId: string | { _id: string; fullName?: string; firstName?: string; lastName?: string }
  type: string
  surah: string
  fromVerse: number
  toVerse: number
  quality: string
  mistakeCount?: number
  notes?: string
  date: string
}

const QUALITY_COLORS: Record<string, string> = {
  EXCELLENT: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  GOOD: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  NEEDS_REVIEW: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  WEAK: "bg-red-500/15 text-red-700 dark:text-red-400",
}

const TYPE_COLORS: Record<string, string> = {
  SABAQ: "bg-primary/15 text-primary",
  SABQI: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  MANZIL: "bg-teal-500/15 text-teal-700 dark:text-teal-400",
}

export function HifzEntry({
  sessionId,
  occurrenceId,
  students,
  selectedDate,
}: {
  sessionId: string
  occurrenceId: string
  students: Student[]
  selectedDate: string
}) {
  const queryClient = useQueryClient()
  const { success, error: showError } = useToast()
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)

  const [type, setType] = useState<string>(HIFZ_TYPE.SABAQ)
  const [surah, setSurah] = useState("")
  const [fromVerse, setFromVerse] = useState("")
  const [toVerse, setToVerse] = useState("")
  const [quality, setQuality] = useState<string>(HIFZ_QUALITY.GOOD)
  const [mistakeCount, setMistakeCount] = useState("")
  const [notes, setNotes] = useState("")

  const { data: existingLogs, isLoading } = useQuery<HifzLog[]>({
    queryKey: ["hifz-logs", sessionId, occurrenceId],
    queryFn: async () => {
      const res = await fetch(`/api/hifz?occurrenceId=${occurrenceId}`)
      if (!res.ok) return []
      return res.json()
    },
    enabled: !!occurrenceId,
  })

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/hifz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "فشل الحفظ" }))
        throw new Error(err.message)
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hifz-logs", sessionId, occurrenceId] })
      setDialogOpen(false)
      resetForm()
      success("تم الحفظ", "تم تسجيل التسميع بنجاح")
    },
    onError: (err: Error) => {
      showError("خطأ", err.message)
    },
  })

  const resetForm = () => {
    setType(HIFZ_TYPE.SABAQ)
    setSurah("")
    setFromVerse("")
    setToVerse("")
    setQuality(HIFZ_QUALITY.GOOD)
    setMistakeCount("")
    setNotes("")
  }

  const openForStudent = (student: Student) => {
    setSelectedStudent(student)
    resetForm()
    setDialogOpen(true)
  }

  const handleSave = () => {
    if (!selectedStudent) return
    const from = parseInt(fromVerse)
    const to = parseInt(toVerse)
    if (!surah || isNaN(from) || isNaN(to) || from < 1 || to < 1) {
      showError("بيانات ناقصة", "يرجى ملء السورة ورقم الآيات")
      return
    }
    createMutation.mutate({
      studentId: selectedStudent._id,
      sessionOccurrenceId: occurrenceId,
      date: selectedDate,
      type,
      surah,
      fromVerse: from,
      toVerse: to,
      quality,
      mistakeCount: mistakeCount ? parseInt(mistakeCount) : undefined,
      notes: notes || undefined,
    })
  }

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()

  const logsForStudent = (studentId: string) =>
    existingLogs?.filter((l) => {
      const id = typeof l.studentId === "string" ? l.studentId : l.studentId._id
      return id === studentId
    }) || []

  const filteredStudents = students.filter((s) =>
    s.fullName.toLowerCase().includes(search.toLowerCase())
  )

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <>
      {/* Search */}
      <div className="relative w-64 mb-4">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="بحث عن طالب..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-10"
        />
      </div>

      {/* Student rows */}
      <div className="space-y-2">
        {filteredStudents.map((student) => {
          const logs = logsForStudent(student._id)
          return (
            <div
              key={student._id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>{getInitials(student.fullName)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{student.fullName}</p>
                  {logs.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {logs.map((log) => (
                        <Badge
                          key={log._id}
                          variant="outline"
                          className={`text-[10px] ${TYPE_COLORS[log.type] || ""}`}
                        >
                          {HIFZ_TYPE_LABELS[log.type]?.split(" ")[0]} — {log.surah} ({log.fromVerse}-{log.toVerse})
                          <span className={`mr-1 ${QUALITY_COLORS[log.quality] || ""} px-1 rounded`}>
                            {HIFZ_QUALITY_LABELS[log.quality]}
                          </span>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {logs.length > 0 && (
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openForStudent(student)}
                >
                  <Plus className="h-3.5 w-3.5 ml-1" />
                  تسميع
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {filteredStudents.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p>لا يوجد طلاب</p>
        </div>
      )}

      {/* Add Hifz Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              تسجيل تسميع — {selectedStudent?.fullName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Type */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">النوع</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(HIFZ_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Surah */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">السورة</label>
              <Input
                value={surah}
                onChange={(e) => setSurah(e.target.value)}
                placeholder="مثال: البقرة"
              />
            </div>

            {/* Verse range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">من الآية</label>
                <Input
                  type="number"
                  min={1}
                  value={fromVerse}
                  onChange={(e) => setFromVerse(e.target.value)}
                  placeholder="1"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">إلى الآية</label>
                <Input
                  type="number"
                  min={1}
                  value={toVerse}
                  onChange={(e) => setToVerse(e.target.value)}
                  placeholder="20"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Quality */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">التقييم</label>
              <Select value={quality} onValueChange={setQuality}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(HIFZ_QUALITY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Mistake count */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">عدد الأخطاء (اختياري)</label>
              <Input
                type="number"
                min={0}
                value={mistakeCount}
                onChange={(e) => setMistakeCount(e.target.value)}
                placeholder="0"
                dir="ltr"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">ملاحظات (اختياري)</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ملاحظات إضافية..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              حفظ التسميع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
