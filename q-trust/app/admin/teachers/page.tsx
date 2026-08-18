"use client"

import { useState, useEffect, useMemo } from "react"
import { useTranslations } from "next-intl"
import { Pagination } from "@/components/ui/pagination"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Pencil, 
  Trash2, 
  Mail,
  Loader2,
  UserCheck,
  UserX,
  Eye,
  EyeOff,
  Users,
  RefreshCw,
  Calendar,
  Shield,
  GraduationCap
} from "lucide-react"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createUserSchema, type CreateUserInput } from "@/lib/validations"
import { ROLES } from "@/lib/constants"
import { useToast } from "@/components/ui/toast"
import { EmailInput } from "@/components/ui/email-input"

interface Teacher {
  _id: string
  fullName: string
  email: string
  isActive: boolean
  isEmailVerified: boolean
  createdAt: string
}

async function fetchTeachers(page: number): Promise<{ data: Teacher[]; pagination: { page: number; pages: number; total: number } }> {
  const res = await fetch(`/api/teachers?page=${page}`)
  if (!res.ok) throw new Error("Failed to fetch teachers")
  return res.json()
}

async function createTeacher(data: CreateUserInput) {
  const res = await fetch("/api/teachers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.message || "Failed to create teacher")
  }
  return res.json()
}

async function updateTeacher(id: string, data: Partial<Teacher>) {
  const res = await fetch(`/api/teachers/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update teacher")
  return res.json()
}

async function deleteTeacher(id: string) {
  const res = await fetch(`/api/teachers/${id}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to delete teacher")
  return res.json()
}

export default function TeachersPage() {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const [search, setSearch] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<"all" | "active" | "inactive">("all")
  const [showPassword, setShowPassword] = useState(false)
  const [page, setPage] = useState(1)
  const t = useTranslations("admin.teachers")
  const tc = useTranslations("common")

  useEffect(() => {
    setMounted(true)
  }, [])

  const { data: teachersResponse, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["teachers", page],
    queryFn: () => fetchTeachers(page),
    retry: 3,
    retryDelay: 1000,
  })
  const teachers = teachersResponse?.data
  const teachersPagination = teachersResponse?.pagination

  const createMutation = useMutation({
    mutationFn: createTeacher,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] })
      setIsCreateOpen(false)
      reset()
      setShowPassword(false)
      success(tc("success"), t("teacherCreated", { name: data.fullName }))
    },
    onError: (err: Error) => {
      error(t("createFailed"), err.message || t("createError"))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Teacher> }) =>
      updateTeacher(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] })
      success(t("updated"), t("updatedSuccess"))
    },
    onError: (err: Error) => {
      error(t("updateError"), err.message || t("updateError"))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTeacher,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] })
      setDeleteId(null)
      success(t("deleted"), t("deletedSuccess"))
    },
    onError: (err: Error) => {
      error(t("deleteError"), err.message || t("deleteError"))
    },
  })

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      role: ROLES.TEACHER,
    },
  })

  const onCreateSubmit = (data: CreateUserInput) => {
    createMutation.mutate({ ...data, role: ROLES.TEACHER })
  }

  // Filter and stats
  const { filteredTeachers, stats } = useMemo(() => {
    if (!teachers) return { filteredTeachers: [], stats: { total: 0, active: 0, inactive: 0 } }

    const active = teachers.filter(t => t.isActive).length
    const inactive = teachers.length - active

    let filtered = teachers

    // Filter by tab
    if (activeTab === "active") {
      filtered = filtered.filter(t => t.isActive)
    } else if (activeTab === "inactive") {
      filtered = filtered.filter(t => !t.isActive)
    }

    // Filter by search
    if (search) {
      filtered = filtered.filter(teacher =>
        teacher.fullName.toLowerCase().includes(search.toLowerCase()) ||
        teacher.email.toLowerCase().includes(search.toLowerCase())
      )
    }

    return {
      filteredTeachers: filtered,
      stats: { total: teachers.length, active, inactive }
    }
  }, [teachers, search, activeTab])

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
  }

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
          {mounted ? (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { reset(); setShowPassword(false); }}>
                  <Plus className="ml-2 h-4 w-4" />
                  {t("addTeacher")}
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("addTeacherTitle")}</DialogTitle>
                <DialogDescription>
                  {t("addTeacherDescription")}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onCreateSubmit)}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">{t("fullName")} *</Label>
                    <Input
                      id="fullName"
                      placeholder={t("fullNamePlaceholder")}
                      {...register("fullName")}
                    />
                    {errors.fullName && (
                      <p className="text-sm text-destructive">{errors.fullName.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">{t("email")} *</Label>
                    <Controller
                      name="email"
                      control={control}
                      render={({ field }) => (
                        <EmailInput
                          id="email"
                          placeholder="teacher@example.com"
                          value={field.value || ''}
                          onChange={field.onChange}
                          error={!!errors.email}
                        />
                      )}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">{t("password")} *</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        dir="ltr"
                        className="text-left pl-10"
                        {...register("password")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {t("passwordHint")}
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setIsCreateOpen(false); setShowPassword(false); }}
                  >
                    {tc("cancel")}
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && (
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    )}
                    {t("addTeacher")}
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
          ) : (
            <Button onClick={() => { reset(); setShowPassword(false); }}>
              <Plus className="ml-2 h-4 w-4" />
              {t("addTeacher")}
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card 
          className={`cursor-pointer transition-all ${activeTab === 'all' ? 'ring-2 ring-primary' : 'hover:border-primary/50'}`}
          onClick={() => setActiveTab('all')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Users className="h-5 w-5 text-blue-700 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">{t("totalTeachers")}</p>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all ${activeTab === 'active' ? 'ring-2 ring-primary' : 'hover:border-primary/50'}`}
          onClick={() => setActiveTab('active')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <UserCheck className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.active}</p>
              <p className="text-xs text-muted-foreground">{t("activeTeachers")}</p>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all ${activeTab === 'inactive' ? 'ring-2 ring-primary' : 'hover:border-primary/50'}`}
          onClick={() => setActiveTab('inactive')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/20">
              <UserX className="h-5 w-5 text-red-700 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.inactive}</p>
              <p className="text-xs text-muted-foreground">{tc("inactive")}</p>
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
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full sm:w-auto">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all">{tc("all")}</TabsTrigger>
                <TabsTrigger value="active">{tc("active")}</TabsTrigger>
                <TabsTrigger value="inactive">{tc("inactive")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Teachers Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredTeachers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-50" />
              {search ? (
                <>
                  <p className="font-medium">{tc("noResults")}</p>
                  <p className="text-sm mt-1">{t("tryDifferentSearch")}</p>
                  <Button variant="outline" className="mt-4" onClick={() => setSearch("")}>
                    {t("clearSearch")}
                  </Button>
                </>
              ) : activeTab !== "all" ? (
                <>
                  <p className="font-medium">{t("noTeachersInCategory")}</p>
                  <Button variant="outline" className="mt-4" onClick={() => setActiveTab("all")}>
                    {t("showAllTeachers")}
                  </Button>
                </>
              ) : (
                <>
                  <p className="font-medium">{t("noTeachers")}</p>
                  <p className="text-sm mt-1">{t("startByAdding")}</p>
                  <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
                    <Plus className="h-4 w-4 ml-2" />
                    {t("addTeacher")}
                  </Button>
                </>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("teacherCol")}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t("email")}</TableHead>
                  <TableHead>{tc("status")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("dateAdded")}</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeachers.map((teacher) => (
                  <TableRow key={teacher._id} className="group">
                    <TableCell>
                      <Link href={`/admin/teachers/${teacher._id}`} className="flex items-center gap-3 hover:text-primary transition-colors">
                        <Avatar className="border-2 border-background shadow-sm">
                          <AvatarFallback className="bg-primary/10 text-primary font-medium">
                            {getInitials(teacher.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <span className="font-medium block">{teacher.fullName}</span>
                          <span className="text-xs text-muted-foreground sm:hidden" dir="ltr">
                            {teacher.email}
                          </span>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <a 
                        href={`mailto:${teacher.email}`}
                        className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                        dir="ltr"
                      >
                        <Mail className="h-3 w-3" />
                        {teacher.email}
                      </a>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={teacher.isActive ? "success" : "destructive"}
                          className="font-normal"
                        >
                          {teacher.isActive ? tc("active") : t("statusDisabled")}
                        </Badge>
                        {teacher.isEmailVerified && (
                          <Badge variant="outline" className="text-xs font-normal">
                            <Shield className="h-3 w-3 ml-1" />
                            {t("verified")}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(teacher.createdAt).toLocaleDateString("ar-TN")}
                      </div>
                    </TableCell>
                    <TableCell>
                      {mounted ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/teachers/${teacher._id}`}>
                                <Eye className="ml-2 h-4 w-4" />
                                {tc("details")}
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/teachers/${teacher._id}`}>
                                <Pencil className="ml-2 h-4 w-4" />
                                {tc("edit")}
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                updateMutation.mutate({
                                  id: teacher._id,
                                  data: { isActive: !teacher.isActive },
                                })
                              }
                            >
                              {teacher.isActive ? (
                                <>
                                  <UserX className="ml-2 h-4 w-4" />
                                  {t("disableAccount")}
                                </>
                              ) : (
                                <>
                                  <UserCheck className="ml-2 h-4 w-4" />
                                  {t("enableAccount")}
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteId(teacher._id)}
                            >
                              <Trash2 className="ml-2 h-4 w-4" />
                              {tc("delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Results Count */}
      {!isLoading && filteredTeachers.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          {t("showingCount", { shown: filteredTeachers.length, total: stats.total })}
        </p>
      )}

      {teachersPagination && (
        <Pagination page={teachersPagination.page} pages={teachersPagination.pages} total={teachersPagination.total} onPageChange={setPage} />
      )}

      {/* Delete Confirmation */}
      {mounted && (
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{tc("deleteConfirm")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("deleteConfirmDescription")}
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
