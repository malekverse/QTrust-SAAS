"use client"

import { use, useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
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
import { useToast } from "@/components/ui/toast"
import {
  ArrowRight,
  Save,
  Loader2,
  Mail,
  User,
  Calendar,
  BookOpen,
  Users,
  Trash2
} from "lucide-react"
import { updateUserSchema } from "@/lib/validations"
import { IslamicDivider } from "@/components/layout/islamic-divider"
import { z } from "zod"

interface Teacher {
  _id: string
  fullName: string
  email: string
  role: string
  isActive: boolean
  isEmailVerified: boolean
  createdAt: string
  sessionsCount?: number
  studentsCount?: number
}

type TeacherFormData = {
  fullName: string
  email: string
  isActive: boolean
}

async function fetchTeacher(id: string): Promise<Teacher> {
  const res = await fetch(`/api/teachers/${id}`)
  if (!res.ok) throw new Error("Failed to fetch teacher")
  return res.json()
}

async function updateTeacher(id: string, data: TeacherFormData) {
  const res = await fetch(`/api/teachers/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.message || "Failed to update teacher")
  }
  return res.json()
}

async function deleteTeacher(id: string) {
  const res = await fetch(`/api/teachers/${id}`, {
    method: "DELETE",
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.message || "Failed to delete teacher")
  }
  return res.json()
}

export default function TeacherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const t = useTranslations("admin.teachers")
  const tc = useTranslations("common")

  const teacherFormSchema = useMemo(() => z.object({
    fullName: z.string().min(2, t("validationNameMin")),
    email: z.string().email(t("validationEmailInvalid")),
    isActive: z.boolean(),
  }), [t])

  const { data: teacher, isLoading } = useQuery({
    queryKey: ["teacher", id],
    queryFn: () => fetchTeacher(id),
  })

  const updateMutation = useMutation({
    mutationFn: (data: TeacherFormData) => updateTeacher(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher", id] })
      queryClient.invalidateQueries({ queryKey: ["teachers"] })
      success(t("updated"), t("updatedSuccess"))
      setIsEditing(false)
    },
    onError: (err: Error) => {
      error(tc("error"), err.message || t("updateError"))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteTeacher(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] })
      success(t("deleted"), t("deletedSuccess"))
      router.push("/admin/teachers")
    },
    onError: (err: Error) => {
      error(tc("error"), err.message || t("deleteError"))
    },
  })

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TeacherFormData>({
    resolver: zodResolver(teacherFormSchema),
  })

  useEffect(() => {
    if (teacher) {
      reset({
        fullName: teacher.fullName,
        email: teacher.email,
        isActive: teacher.isActive,
      })
    }
  }, [teacher, reset])

  const isActive = watch("isActive")

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
  }

  const onSubmit = (data: TeacherFormData) => {
    updateMutation.mutate(data)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32" />
        <div className="flex gap-6">
          <Skeleton className="h-64 flex-1" />
          <Skeleton className="h-64 w-72" />
        </div>
      </div>
    )
  }

  if (!teacher) {
    return <div>{t("notFound")}</div>
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" asChild>
        <Link href="/admin/teachers">
          <ArrowRight className="ml-2 h-4 w-4" />
          {t("backToList")}
        </Link>
      </Button>

      {/* Header */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Teacher Info Card */}
        <Card className="flex-1">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {getInitials(teacher.fullName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-2xl font-bold">{teacher.fullName}</h1>
                  <Badge variant={teacher.isActive ? "success" : "destructive"}>
                    {teacher.isActive ? t("statusActive") : t("statusDisabled")}
                  </Badge>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <span dir="ltr">{teacher.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>{t("joinedOn")} {new Date(teacher.createdAt).toLocaleDateString("ar-TN")}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  {isEditing ? tc("cancel") : tc("edit")}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Card */}
        <Card className="w-full md:w-72">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{t("statistics")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{teacher.sessionsCount || 0}</p>
                <p className="text-xs text-muted-foreground">{t("assignedSessions")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Users className="h-5 w-5 text-blue-700 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{teacher.studentsCount || 0}</p>
                <p className="text-xs text-muted-foreground">{tc("student")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Form */}
      {isEditing && (
        <>
          <IslamicDivider />
          <Card>
            <CardHeader>
              <CardTitle>{t("editDetails")}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">{t("fullName")}</Label>
                    <Input id="fullName" {...register("fullName")} />
                    {errors.fullName && (
                      <p className="text-sm text-destructive">{errors.fullName.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">{t("email")}</Label>
                    <Input id="email" type="email" dir="ltr" {...register("email")} />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email.message}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                  <div>
                    <Label>{t("accountStatus")}</Label>
                    <p className="text-sm text-muted-foreground">
                      {isActive ? t("accountActive") : t("accountDisabled")}
                    </p>
                  </div>
                  <Switch
                    checked={isActive}
                    onCheckedChange={(checked) => setValue("isActive", checked)}
                  />
                </div>

                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? (
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="ml-2 h-4 w-4" />
                  )}
                  {t("saveChanges")}
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTeacher")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirmation")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              {tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
