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
  Heart,
  Loader2,
  Plus,
  CheckCircle,
  Search,
  ThumbsUp,
  AlertTriangle,
} from "lucide-react"
import { BEHAVIOR_TYPE, BEHAVIOR_TYPE_LABELS } from "@/lib/constants"
import { useToast } from "@/components/ui/toast"

interface Student {
  _id: string
  fullName: string
}

interface BehaviorLog {
  _id: string
  studentId: string | { _id: string; fullName?: string; firstName?: string; lastName?: string }
  type: string
  description: string
  date: string
}

const TYPE_COLORS: Record<string, string> = {
  POSITIVE: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  CONCERN: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
}

export function BehaviorEntry({
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

  const [type, setType] = useState<string>(BEHAVIOR_TYPE.POSITIVE)
  const [description, setDescription] = useState("")

  const { data: existingLogs, isLoading } = useQuery<BehaviorLog[]>({
    queryKey: ["behavior-logs", sessionId, occurrenceId],
    queryFn: async () => {
      const res = await fetch(`/api/behavior?occurrenceId=${occurrenceId}`)
      if (!res.ok) return []
      return res.json()
    },
    enabled: !!occurrenceId,
  })

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/behavior", {
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
      queryClient.invalidateQueries({ queryKey: ["behavior-logs", sessionId, occurrenceId] })
      setDialogOpen(false)
      setDescription("")
      setType(BEHAVIOR_TYPE.POSITIVE)
      success("تم الحفظ", "تم تسجيل الملاحظة السلوكية بنجاح")
    },
    onError: (err: Error) => {
      showError("خطأ", err.message)
    },
  })

  const openForStudent = (student: Student) => {
    setSelectedStudent(student)
    setDescription("")
    setType(BEHAVIOR_TYPE.POSITIVE)
    setDialogOpen(true)
  }

  const handleSave = () => {
    if (!selectedStudent) return
    if (!description.trim()) {
      showError("بيانات ناقصة", "يرجى كتابة وصف الملاحظة")
      return
    }
    createMutation.mutate({
      studentId: selectedStudent._id,
      sessionOccurrenceId: occurrenceId,
      date: selectedDate,
      type,
      description: description.trim(),
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
                          {log.type === BEHAVIOR_TYPE.POSITIVE ? (
                            <ThumbsUp className="h-2.5 w-2.5 ml-1" />
                          ) : (
                            <AlertTriangle className="h-2.5 w-2.5 ml-1" />
                          )}
                          {log.description.length > 30 ? `${log.description.slice(0, 30)}…` : log.description}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {logs.length > 0 && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                <Button variant="outline" size="sm" onClick={() => openForStudent(student)}>
                  <Plus className="h-3.5 w-3.5 ml-1" />
                  ملاحظة
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {filteredStudents.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Heart className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p>لا يوجد طلاب</p>
        </div>
      )}

      {/* Add Behavior Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              ملاحظة سلوكية — {selectedStudent?.fullName}
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
                  {Object.entries(BEHAVIOR_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">الوصف</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="مثال: ساعد زميله في المراجعة"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              حفظ الملاحظة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
