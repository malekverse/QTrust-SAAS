"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { Pagination } from "@/components/ui/pagination"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  UsersRound,
  Plus,
  Loader2,
  Phone,
  Trash2,
  Pencil,
  Search,
  Percent,
} from "lucide-react"
import { useToast } from "@/components/ui/toast"

interface FamilyBilling {
  perChildBase: number
  perChildDiscounted: number
  discountApplied: boolean
  familyTotal: number
}

interface Family {
  _id: string
  primaryGuardianName: string
  primaryGuardianPhone?: string
  primaryGuardianEmail?: string
  monthlyFeePerChildTND: number
  siblingDiscountPercent: number
  students: { _id: string; name: string }[]
  billing: FamilyBilling
}

interface StudentLite {
  _id: string
  displayName: string
  familyId?: string
}

async function fetchFamilies(page: number): Promise<{ data: Family[]; pagination: { page: number; pages: number; total: number } }> {
  const res = await fetch(`/api/families?page=${page}`)
  if (!res.ok) throw new Error("fetchError")
  return res.json()
}

async function fetchStudents(): Promise<StudentLite[]> {
  const res = await fetch("/api/students?limit=200")
  if (!res.ok) return []
  return (await res.json()).data
}

const emptyForm = {
  primaryGuardianName: "",
  primaryGuardianPhone: "",
  primaryGuardianEmail: "",
  monthlyFeePerChildTND: "",
  siblingDiscountPercent: "",
}

export default function FamiliesPage() {
  const queryClient = useQueryClient()
  const { success, error: toastError } = useToast()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Family | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())
  const [studentSearch, setStudentSearch] = useState("")
  const [page, setPage] = useState(1)
  const t = useTranslations("admin.families")
  const tc = useTranslations("common")

  const { data: familiesResponse, isLoading } = useQuery({ queryKey: ["families", page], queryFn: () => fetchFamilies(page) })
  const families = familiesResponse?.data
  const pagination = familiesResponse?.pagination
  const { data: students } = useQuery({ queryKey: ["students-lite"], queryFn: fetchStudents })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        primaryGuardianName: form.primaryGuardianName,
        primaryGuardianPhone: form.primaryGuardianPhone,
        primaryGuardianEmail: form.primaryGuardianEmail,
        monthlyFeePerChildTND: form.monthlyFeePerChildTND ? parseFloat(form.monthlyFeePerChildTND) : 0,
        siblingDiscountPercent: form.siblingDiscountPercent ? parseFloat(form.siblingDiscountPercent) : 0,
        studentIds: Array.from(selectedStudents),
      }
      const url = editing ? `/api/families/${editing._id}` : "/api/families"
      const method = editing ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({ message: "saveFailed" }))
        throw new Error(d.message)
      }
      // POST doesn't reconcile membership; do it via PATCH after create.
      if (!editing) {
        const created = await res.json()
        if (payload.studentIds.length > 0) {
          await fetch(`/api/families/${created._id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ studentIds: payload.studentIds }),
          })
        }
      }
      return true
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["families"] })
      queryClient.invalidateQueries({ queryKey: ["students-lite"] })
      setDialogOpen(false)
      success(tc("success"), editing ? t("familyUpdated") : t("familyAdded"))
    },
    onError: (err: Error) => toastError(tc("error"), err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/families/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("deleteFailed")
      return true
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["families"] })
      queryClient.invalidateQueries({ queryKey: ["students-lite"] })
      success(tc("deleted"), t("familyDeleted"))
    },
    onError: (err: Error) => toastError(tc("error"), err.message),
  })

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setSelectedStudents(new Set())
    setStudentSearch("")
    setDialogOpen(true)
  }

  const openEdit = (family: Family) => {
    setEditing(family)
    setForm({
      primaryGuardianName: family.primaryGuardianName,
      primaryGuardianPhone: family.primaryGuardianPhone || "",
      primaryGuardianEmail: family.primaryGuardianEmail || "",
      monthlyFeePerChildTND: String(family.monthlyFeePerChildTND ?? ""),
      siblingDiscountPercent: String(family.siblingDiscountPercent ?? ""),
    })
    setSelectedStudents(new Set(family.students.map((s) => s._id)))
    setStudentSearch("")
    setDialogOpen(true)
  }

  const toggleStudent = (id: string) => {
    setSelectedStudents((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filteredStudents = useMemo(() => {
    const list = students || []
    if (!studentSearch) return list
    const q = studentSearch.toLowerCase()
    return list.filter((s) => s.displayName?.toLowerCase().includes(q))
  }, [students, studentSearch])

  const canSave = form.primaryGuardianName.trim().length >= 2

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")}>
        <Button onClick={openCreate}>
          <Plus className="ml-2 h-4 w-4" />
          {t("addFamily")}
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : !families || families.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <UsersRound className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
            <p className="font-medium text-muted-foreground">{t("noFamilies")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("emptyStateHint")}
            </p>
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="ml-2 h-4 w-4" />
              {t("addFamily")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {families?.map((family) => (
            <Card key={family._id} className="transition-all hover:shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold">{family.primaryGuardianName}</h3>
                    {family.primaryGuardianPhone && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground" dir="ltr">
                        <Phone className="h-3 w-3" />
                        {family.primaryGuardianPhone}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(family)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => {
                        if (confirm(t("deleteConfirm", { name: family.primaryGuardianName }))) {
                          deleteMutation.mutate(family._id)
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Members */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {family.students.length === 0 ? (
                    <span className="text-xs text-muted-foreground">{t("noLinkedStudents")}</span>
                  ) : (
                    family.students.map((s) => (
                      <Badge key={s._id} variant="secondary" className="text-[11px]">
                        {s.name}
                      </Badge>
                    ))
                  )}
                </div>

                {/* Billing summary */}
                <div className="mt-4 rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {t("billingPerChild", { count: family.students.length, fee: family.monthlyFeePerChildTND || 0 })}
                    </span>
                    {family.billing.discountApplied && (
                      <Badge variant="outline" className="border-emerald-500/40 text-[10px] text-emerald-700 dark:text-emerald-400">
                        <Percent className="ml-0.5 h-2.5 w-2.5" />
                        {t("discountBadge", { percent: family.siblingDiscountPercent })}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="font-medium">{t("monthlyTotal")}</span>
                    <span className="text-lg font-bold" dir="ltr">
                      {family.billing.familyTotal.toFixed(2)} {tc("currencyTND")}
                    </span>
                  </div>
                  {family.billing.discountApplied && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground" dir="ltr">
                      {t("perChildAfterDiscount", { amount: family.billing.perChildDiscounted.toFixed(2) })}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pagination && (
        <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} onPageChange={setPage} />
      )}

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t("editFamily") : t("addFamily")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>{t("guardianName")}</Label>
              <Input
                value={form.primaryGuardianName}
                onChange={(e) => setForm({ ...form, primaryGuardianName: e.target.value })}
                placeholder={t("guardianNamePlaceholder")}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{tc("phone")}</Label>
                <Input
                  value={form.primaryGuardianPhone}
                  onChange={(e) => setForm({ ...form, primaryGuardianPhone: e.target.value })}
                  placeholder="+216"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{tc("email")}</Label>
                <Input
                  type="email"
                  value={form.primaryGuardianEmail}
                  onChange={(e) => setForm({ ...form, primaryGuardianEmail: e.target.value })}
                  dir="ltr"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("monthlyFeeLabel")}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.monthlyFeePerChildTND}
                  onChange={(e) => setForm({ ...form, monthlyFeePerChildTND: e.target.value })}
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("siblingDiscountLabel")}</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={form.siblingDiscountPercent}
                  onChange={(e) => setForm({ ...form, siblingDiscountPercent: e.target.value })}
                  dir="ltr"
                />
              </div>
            </div>

            {/* Student picker */}
            <div className="space-y-1.5">
              <Label>{t("linkedStudents")}</Label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("searchStudentPlaceholder")}
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="pr-10"
                />
              </div>
              <ScrollArea className="h-48 rounded-lg border p-2">
                <div className="space-y-1">
                  {filteredStudents.map((s) => {
                    const inOtherFamily =
                      s.familyId && (!editing || s.familyId !== editing._id)
                    return (
                      <label
                        key={s._id}
                        className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-muted"
                      >
                        <Checkbox
                          checked={selectedStudents.has(s._id)}
                          onCheckedChange={() => toggleStudent(s._id)}
                        />
                        <span className="text-sm">{s.displayName}</span>
                        {inOtherFamily && !selectedStudents.has(s._id) && (
                          <Badge variant="outline" className="mr-auto text-[10px] text-amber-600">
                            {t("inOtherFamily")}
                          </Badge>
                        )}
                      </label>
                    )
                  })}
                  {filteredStudents.length === 0 && (
                    <p className="p-3 text-center text-sm text-muted-foreground">{t("noStudentsFound")}</p>
                  )}
                </div>
              </ScrollArea>
              <p className="text-xs text-muted-foreground">
                {t("selectedCount", { count: selectedStudents.size })}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!canSave || saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              {tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
