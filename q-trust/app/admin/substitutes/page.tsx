"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Pagination } from "@/components/ui/pagination"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
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
import { UserCog, Plus, Loader2, Trash2, Calendar, ArrowLeftRight } from "lucide-react"
import { useToast } from "@/components/ui/toast"

interface Assignment {
  _id: string
  sessionTemplateId?: { _id: string; name: string }
  substituteUserId?: { _id: string; fullName: string }
  validFrom: string
  validTo: string
  notes?: string
  active: boolean
}
interface SessionTemplate {
  _id: string
  name: string
  teacherId?: { _id: string; fullName: string }
}
interface Teacher {
  _id: string
  fullName: string
}

async function fetchAssignments(page: number): Promise<{ data: Assignment[]; pagination: { page: number; pages: number; total: number } }> {
  const res = await fetch(`/api/substitutes?page=${page}`)
  if (!res.ok) throw new Error("فشل تحميل التكليفات")
  return res.json()
}
async function fetchSessions(): Promise<SessionTemplate[]> {
  const res = await fetch("/api/sessions?limit=200")
  if (!res.ok) return []
  return (await res.json()).data
}
async function fetchTeachers(): Promise<Teacher[]> {
  const res = await fetch("/api/teachers?limit=200")
  if (!res.ok) return []
  return (await res.json()).data
}

const todayStr = () => new Date().toISOString().split("T")[0]

export default function SubstitutesPage() {
  const queryClient = useQueryClient()
  const { success, error: toastError } = useToast()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [sessionTemplateId, setSessionTemplateId] = useState("")
  const [substituteUserId, setSubstituteUserId] = useState("")
  const [validFrom, setValidFrom] = useState(todayStr())
  const [validTo, setValidTo] = useState(todayStr())
  const [notes, setNotes] = useState("")
  const [page, setPage] = useState(1)

  const t = useTranslations("admin.substitutes")
  const tc = useTranslations("common")

  const { data: subsResponse, isLoading } = useQuery({ queryKey: ["substitutes", page], queryFn: () => fetchAssignments(page) })
  const assignments = subsResponse?.data
  const pagination = subsResponse?.pagination
  const { data: sessions } = useQuery({ queryKey: ["sessions-for-sub"], queryFn: fetchSessions })
  const { data: teachers } = useQuery({ queryKey: ["teachers-for-sub"], queryFn: fetchTeachers })

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/substitutes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionTemplateId, substituteUserId, validFrom, validTo, notes }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({ message: "فشل الحفظ" }))
        throw new Error(d.message)
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["substitutes"] })
      setDialogOpen(false)
      resetForm()
      success("تم التكليف", "تم تعيين المعلم النائب")
    },
    onError: (err: Error) => toastError("خطأ", err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/substitutes/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("فشل الحذف")
      return true
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["substitutes"] })
      success("تم الحذف", "تم إلغاء التكليف")
    },
    onError: (err: Error) => toastError("خطأ", err.message),
  })

  const resetForm = () => {
    setSessionTemplateId("")
    setSubstituteUserId("")
    setValidFrom(todayStr())
    setValidTo(todayStr())
    setNotes("")
  }

  const openCreate = () => {
    resetForm()
    setDialogOpen(true)
  }

  const canSave = sessionTemplateId && substituteUserId && validFrom && validTo

  // The original teacher of the selected session (excluded from substitute list).
  const selectedSession = sessions?.find((s) => s._id === sessionTemplateId)
  const originalTeacherId = selectedSession?.teacherId?._id
  const eligibleSubs = (teachers || []).filter((t) => t._id !== originalTeacherId)

  const fmt = (s: string) =>
    new Date(s).toLocaleDateString("ar-TN", { day: "numeric", month: "short", year: "numeric" })

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")}>
        <Button onClick={openCreate}>
          <Plus className="ml-2 h-4 w-4" />
          {t("addSubstitute")}
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : !assignments || assignments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <UserCog className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
            <p className="font-medium text-muted-foreground">{t("noSubstitutes")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              كلّف معلماً بتغطية حصة عند غياب المعلم الأصلي
            </p>
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="ml-2 h-4 w-4" />
              {t("addSubstitute")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <Card key={a._id} className="transition-all hover:shadow-sm">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{a.substituteUserId?.fullName || "معلم"}</span>
                    <span className="text-sm text-muted-foreground">ينوب في</span>
                    <span className="font-medium">{a.sessionTemplateId?.name || "حصة"}</span>
                    {a.active ? (
                      <Badge className="bg-emerald-600 text-white">نشط الآن</Badge>
                    ) : (
                      <Badge variant="outline">غير نشط</Badge>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {fmt(a.validFrom)} — {fmt(a.validTo)}
                    {a.notes && <span className="mr-2">• {a.notes}</span>}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => {
                    if (confirm("إلغاء هذا التكليف؟")) deleteMutation.mutate(a._id)
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pagination && (
        <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} onPageChange={setPage} />
      )}

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تكليف معلم نائب</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>الحصة</Label>
              <Select
                value={sessionTemplateId}
                onValueChange={(v) => {
                  setSessionTemplateId(v)
                  setSubstituteUserId("")
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectSession")} />
                </SelectTrigger>
                <SelectContent>
                  {(sessions || []).map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.name}
                      {s.teacherId?.fullName ? ` — ${s.teacherId.fullName}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("substituteTeacher")}</Label>
              <Select value={substituteUserId} onValueChange={setSubstituteUserId} disabled={!sessionTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder={sessionTemplateId ? t("selectTeacher") : "اختر الحصة أولاً"} />
                </SelectTrigger>
                <SelectContent>
                  {eligibleSubs.map((t) => (
                    <SelectItem key={t._id} value={t._id}>
                      {t.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("startDate")}</Label>
                <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("endDate")}</Label>
                <Input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} dir="ltr" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{tc("notes")} ({tc("optional")})</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="سبب النيابة..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={() => createMutation.mutate()} disabled={!canSave || createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              تكليف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
