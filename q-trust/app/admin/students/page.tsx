"use client"

import { useState, useMemo, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Pencil, 
  Trash2, 
  QrCode,
  Loader2,
  Eye,
  Download,
  Printer,
  Upload,
  Users,
  UserCheck,
  UserX,
  RefreshCw,
  GraduationCap,
  Phone,
  Calendar,
  FileText
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
import { z } from "zod"
import { 
  GENDER, 
  GENDER_LABELS, 
  ACTIVITY_AREAS, 
  ACTIVITY_AREA_LABELS, 
  EDUCATION_LEVELS,
  DECLARATION_TEXT 
} from "@/lib/constants"

// Type for student form
type StudentFormInput = {
  enrollmentNumber?: string
  cin?: string
  firstName: string
  lastName: string
  fatherName?: string
  gender: 'MALE' | 'FEMALE'
  profession?: string
  dateOfBirth?: string
  placeOfBirth?: string
  educationLevel?: string
  address?: string
  phone?: string
  email?: string
  activityAreas: string[]
  declarationAccepted: boolean
  signatureLocation?: string
  signatureDate?: string
  photoUrl?: string
  cinFrontUrl?: string
  cinBackUrl?: string
  notes?: string
}

// Schema for form validation
const studentFormSchema = z.object({
  enrollmentNumber: z.string().optional(),
  cin: z.string().optional().or(z.literal('')),
  firstName: z.string().min(2, 'الاسم يجب أن يكون على الأقل حرفين'),
  lastName: z.string().min(2, 'اللقب يجب أن يكون على الأقل حرفين'),
  fatherName: z.string().optional(),
  gender: z.enum([GENDER.MALE, GENDER.FEMALE]),
  profession: z.string().optional(),
  dateOfBirth: z.string().optional(),
  placeOfBirth: z.string().optional(),
  educationLevel: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().optional().or(z.literal('')),
  activityAreas: z.array(z.string()),
  declarationAccepted: z.boolean().refine(val => val === true, 'يجب الموافقة على الإقرار'),
  signatureLocation: z.string().optional(),
  signatureDate: z.string().optional(),
  photoUrl: z.string().optional(),
  cinFrontUrl: z.string().optional(),
  cinBackUrl: z.string().optional(),
  notes: z.string().optional()
})
import { useToast } from "@/components/ui/toast"
import { TunisiaPhoneInput } from "@/components/ui/tunisia-phone-input"
import { CINInput } from "@/components/ui/cin-input"
import { EmailInput } from "@/components/ui/email-input"
import { DateInput } from "@/components/ui/date-input"
import { FileUpload } from "@/components/ui/file-upload"
import Link from "next/link"

interface Student {
  _id: string
  firstName: string
  lastName: string
  fullName?: string
  displayName?: string
  fatherName?: string
  gender: 'MALE' | 'FEMALE'
  cin?: string
  phone?: string
  email?: string
  activityAreas?: string[]
  qrUuid: string
  isActive: boolean
  hasPortalAccess?: boolean
  createdAt: string
}

async function fetchStudents(): Promise<Student[]> {
  const res = await fetch("/api/students")
  if (!res.ok) throw new Error("Failed to fetch students")
  return res.json()
}

async function createStudent(data: StudentFormInput) {
  const res = await fetch("/api/students", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.message || "Failed to create student")
  }
  return res.json()
}

async function deleteStudent(id: string) {
  const res = await fetch(`/api/students/${id}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to delete student")
  return res.json()
}

async function fetchNextEnrollmentNumber(): Promise<string> {
  const res = await fetch("/api/students/next-enrollment")
  if (!res.ok) return ""
  const data = await res.json()
  return data.enrollmentNumber || ""
}

export default function StudentsPage() {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const [search, setSearch] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"all" | "active" | "inactive">("all")
  
  // Portal account states
  const [accountDialogOpen, setAccountDialogOpen] = useState(false)
  const [accountStudent, setAccountStudent] = useState<Student | null>(null)
  const [accountParentEmail, setAccountParentEmail] = useState("")
  const [accountParentPhone, setAccountParentPhone] = useState("")
  const [accountParentName, setAccountParentName] = useState("")
  const [accountCreating, setAccountCreating] = useState(false)
  const [accountResult, setAccountResult] = useState<{
    loginIdentifier: string
    tempPassword: string
    credentialType: string
  } | null>(null)
  const [resetPasswordResult, setResetPasswordResult] = useState<{
    tempPassword: string
    studentName: string
    loginIdentifier: string
  } | null>(null)
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false)

  const { data: students, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["students"],
    queryFn: fetchStudents,
    retry: 3,
    retryDelay: 1000,
  })

  // Fetch next enrollment number when dialog opens
  const { data: nextEnrollmentNumber } = useQuery({
    queryKey: ["nextEnrollmentNumber"],
    queryFn: fetchNextEnrollmentNumber,
    enabled: isCreateOpen,
  })

  const createMutation = useMutation({
    mutationFn: createStudent,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["students"] })
      queryClient.invalidateQueries({ queryKey: ["nextEnrollmentNumber"] })
      setIsCreateOpen(false)
      reset()
      success("تم التسجيل بنجاح", `تم إضافة الطالب ${data.firstName} ${data.lastName}`)
    },
    onError: (err: Error) => {
      error("فشل التسجيل", err.message || "حدث خطأ أثناء إضافة الطالب")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteStudent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] })
      setDeleteId(null)
      success("تم الحذف", "تم حذف الطالب بنجاح")
    },
    onError: (err: Error) => {
      error("فشل الحذف", err.message || "حدث خطأ أثناء حذف الطالب")
    },
  })

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<StudentFormInput>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: {
      gender: GENDER.MALE,
      activityAreas: [],
      declarationAccepted: false,
    }
  })

  const declarationAccepted = watch("declarationAccepted")

  // Set enrollment number when dialog opens
  useEffect(() => {
    if (isCreateOpen && nextEnrollmentNumber) {
      setValue("enrollmentNumber", nextEnrollmentNumber)
    }
  }, [isCreateOpen, nextEnrollmentNumber, setValue])

  const onCreateSubmit = (data: StudentFormInput) => {
    createMutation.mutate(data)
  }

  // Portal account management
  const openAccountDialog = (student: Student) => {
    setAccountStudent(student)
    setAccountParentEmail("")
    setAccountParentPhone("")
    setAccountParentName("")
    setAccountResult(null)
    setAccountDialogOpen(true)
  }

  const createPortalAccount = async () => {
    if (!accountStudent) return
    setAccountCreating(true)
    try {
      const res = await fetch("/api/admin/student-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: accountStudent._id,
          parentEmail: accountParentEmail || undefined,
          parentPhone: accountParentPhone || undefined,
          parentName: accountParentName || undefined
        })
      })
      const data = await res.json()
      if (res.ok) {
        setAccountResult({
          loginIdentifier: data.account.loginIdentifier,
          tempPassword: data.account.tempPassword,
          credentialType: data.account.credentialType
        })
        queryClient.invalidateQueries({ queryKey: ["students"] })
        success("تم إنشاء الحساب", `تم إنشاء حساب البوابة للطالب بنجاح`)
      } else {
        error("خطأ", data.message)
      }
    } catch {
      error("خطأ", "حدث خطأ أثناء إنشاء الحساب")
    } finally {
      setAccountCreating(false)
    }
  }

  const resetStudentPassword = async (studentId: string) => {
    try {
      const res = await fetch(`/api/admin/student-accounts/${studentId}/reset-password`, {
        method: "POST"
      })
      const data = await res.json()
      if (res.ok) {
        setResetPasswordResult({
          tempPassword: data.tempPassword,
          studentName: data.studentName,
          loginIdentifier: data.loginIdentifier
        })
        setResetPasswordDialogOpen(true)
      } else {
        error("خطأ", data.message)
      }
    } catch {
      error("خطأ", "حدث خطأ أثناء إعادة تعيين كلمة المرور")
    }
  }

  // Filter and stats
  const { filteredStudents, stats } = useMemo(() => {
    if (!students) return { filteredStudents: [], stats: { total: 0, active: 0, inactive: 0 } }

    const active = students.filter(s => s.isActive).length
    const inactive = students.length - active

    let filtered = students

    // Filter by tab
    if (activeTab === "active") {
      filtered = filtered.filter(s => s.isActive)
    } else if (activeTab === "inactive") {
      filtered = filtered.filter(s => !s.isActive)
    }

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(student => {
        const fullName = student.displayName || student.fullName || `${student.firstName} ${student.lastName}`
        return fullName.toLowerCase().includes(searchLower) ||
          student.fatherName?.toLowerCase().includes(searchLower) ||
          student.phone?.includes(search) ||
          student.cin?.includes(search)
      })
    }

    return {
      filteredStudents: filtered,
      stats: { total: students.length, active, inactive }
    }
  }, [students, search, activeTab])

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase()
  }

  const getStudentDisplayName = (student: Student) => {
    return student.displayName || student.fullName || `${student.firstName} ${student.lastName}`
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="إدارة الطلاب"
        description="إضافة وتعديل وحذف بيانات الطلاب"
      >
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ml-2 ${isFetching ? 'animate-spin' : ''}`} />
            تحديث
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/students/import">
              <Upload className="ml-2 h-4 w-4" />
              استيراد
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/students/qr-cards">
              <Printer className="ml-2 h-4 w-4" />
              طباعة البطاقات
            </Link>
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={(open) => {
            setIsCreateOpen(open)
            if (!open) reset()
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="ml-2 h-4 w-4" />
                إضافة طالب
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0 overflow-hidden">
              <DialogHeader className="px-6 py-4 border-b bg-linear-to-l from-primary/5 to-transparent">
                <DialogTitle className="text-xl flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <GraduationCap className="h-5 w-5 text-primary" />
                  </div>
                  تسجيل طالب جديد
                </DialogTitle>
                <DialogDescription>
                  أدخل بيانات الانخراط الكاملة للطالب الجديد
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onCreateSubmit)}>
                <div className="max-h-[60vh] overflow-y-auto scrollbar-islamic px-6 py-4" tabIndex={-1}>
                  <div className="space-y-6">
                    {/* Section A - المعلومات الشخصية */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-primary">
                        <FileText className="h-4 w-4" />
                        المعلومات الشخصية
                      </div>
                      <div className="space-y-4 rounded-xl border bg-card/50 p-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="enrollmentNumber" className="flex items-center gap-2">
                              رقم الانخراط
                              <span className="text-xs text-muted-foreground font-normal">(تلقائي)</span>
                            </Label>
                            <Input
                              id="enrollmentNumber"
                              placeholder="سيتم إنشاؤه تلقائياً"
                              autoFocus
                              {...register("enrollmentNumber")}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="cin">رقم ب. ت. و</Label>
                            <Controller
                              name="cin"
                              control={control}
                              render={({ field }) => (
                                <CINInput
                                  value={field.value || ''}
                                  onChange={field.onChange}
                                  error={!!errors.cin}
                                />
                              )}
                            />
                            {errors.cin && (
                              <p className="text-sm text-destructive">{errors.cin.message}</p>
                            )}
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="firstName">الاسم *</Label>
                            <Input
                              id="firstName"
                              {...register("firstName")}
                            />
                            {errors.firstName && (
                              <p className="text-sm text-destructive">{errors.firstName.message}</p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="lastName">اللقب *</Label>
                            <Input
                              id="lastName"
                              {...register("lastName")}
                            />
                            {errors.lastName && (
                              <p className="text-sm text-destructive">{errors.lastName.message}</p>
                            )}
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="fatherName">اسم الأب</Label>
                            <Input
                              id="fatherName"
                              {...register("fatherName")}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="gender">الجنس *</Label>
                            <Controller
                              name="gender"
                              control={control}
                              render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="اختر الجنس" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={GENDER.MALE}>{GENDER_LABELS.MALE}</SelectItem>
                                    <SelectItem value={GENDER.FEMALE}>{GENDER_LABELS.FEMALE}</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            />
                            {errors.gender && (
                              <p className="text-sm text-destructive">{errors.gender.message}</p>
                            )}
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="profession">المهنة</Label>
                            <Input
                              id="profession"
                              {...register("profession")}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="educationLevel">المستوى التعليمي</Label>
                            <Controller
                              name="educationLevel"
                              control={control}
                              render={({ field }) => (
                                <Select value={field.value || ''} onValueChange={field.onChange}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="اختر المستوى" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {EDUCATION_LEVELS.map(level => (
                                      <SelectItem key={level} value={level}>{level}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="dateOfBirth">تاريخ الولادة</Label>
                            <Controller
                              name="dateOfBirth"
                              control={control}
                              render={({ field }) => (
                                <DateInput
                                  id="dateOfBirth"
                                  value={field.value || ''}
                                  onChange={field.onChange}
                                  error={!!errors.dateOfBirth}
                                />
                              )}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="placeOfBirth">مكان الولادة</Label>
                            <Input
                              id="placeOfBirth"
                              {...register("placeOfBirth")}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="address">العنوان</Label>
                          <Input
                            id="address"
                            {...register("address")}
                          />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="phone">الهاتف</Label>
                            <Controller
                              name="phone"
                              control={control}
                              render={({ field }) => (
                                <TunisiaPhoneInput
                                  value={field.value || ''}
                                  onChange={field.onChange}
                                  error={!!errors.phone}
                                />
                              )}
                            />
                            {errors.phone && (
                              <p className="text-sm text-destructive">{errors.phone.message}</p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="email">البريد الإلكتروني</Label>
                            <Controller
                              name="email"
                              control={control}
                              render={({ field }) => (
                                <EmailInput
                                  id="email"
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
                        </div>
                      </div>
                    </div>

                    {/* Section B - مجال النشاط */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-primary">
                        <Users className="h-4 w-4" />
                        اختيار مجال النشاط داخل الجمعية
                      </div>
                      <div className="rounded-xl border bg-card/50 p-4">
                        <Controller
                          name="activityAreas"
                          control={control}
                          render={({ field }) => (
                            <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="مجالات النشاط">
                              {Object.entries(ACTIVITY_AREAS).map(([key, value]) => (
                                <div 
                                  key={key} 
                                  className="flex items-center gap-3 p-3 rounded-lg border bg-background/50 hover:bg-muted/50 transition-colors"
                                >
                                  <Checkbox
                                    id={`activity-${key}`}
                                    checked={field.value?.includes(value)}
                                    onCheckedChange={(checked) => {
                                      const current = field.value || []
                                      if (checked) {
                                        field.onChange([...current, value])
                                      } else {
                                        field.onChange(current.filter((v: string) => v !== value))
                                      }
                                    }}
                                  />
                                  <label 
                                    htmlFor={`activity-${key}`}
                                    className="text-sm cursor-pointer flex-1"
                                  >
                                    {ACTIVITY_AREA_LABELS[key as keyof typeof ACTIVITY_AREA_LABELS]}
                                  </label>
                                </div>
                              ))}
                            </div>
                          )}
                        />
                      </div>
                    </div>

                    {/* Section C - الإقرار */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-primary">
                        <FileText className="h-4 w-4" />
                        الإقرار <span className="text-destructive">*</span>
                      </div>
                      <div className="rounded-xl border bg-card/50 p-4 space-y-4">
                        <p className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg leading-relaxed">
                          {DECLARATION_TEXT}
                        </p>
                        <Controller
                          name="declarationAccepted"
                          control={control}
                          render={({ field }) => (
                            <div className="flex items-center gap-3 p-3 rounded-lg border bg-background/50 hover:bg-muted/50 transition-colors">
                              <Checkbox
                                id="declaration"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                              <label 
                                htmlFor="declaration"
                                className="text-sm font-medium cursor-pointer flex-1"
                              >
                                أوافق على الإقرار أعلاه
                              </label>
                            </div>
                          )}
                        />
                        {errors.declarationAccepted && (
                          <p className="text-sm text-destructive">{errors.declarationAccepted.message}</p>
                        )}
                      </div>
                    </div>

                    {/* Section D - معلومات الإمضاء */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-primary">
                        <Calendar className="h-4 w-4" />
                        معلومات الإمضاء
                      </div>
                      <div className="rounded-xl border bg-card/50 p-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="signatureLocation">الممضى في</Label>
                            <Input
                              id="signatureLocation"
                              placeholder="المدينة"
                              {...register("signatureLocation")}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="signatureDate">التاريخ</Label>
                            <Controller
                              name="signatureDate"
                              control={control}
                              render={({ field }) => (
                                <DateInput
                                  id="signatureDate"
                                  value={field.value || ''}
                                  onChange={field.onChange}
                                  error={!!errors.signatureDate}
                                />
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section E - المرفقات */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-primary">
                        <Upload className="h-4 w-4" />
                        المرفقات المطلوبة
                        <span className="text-xs text-muted-foreground font-normal">(اختياري)</span>
                      </div>
                      <div className="rounded-xl border bg-card/50 p-4 space-y-4">
                        <Controller
                          name="photoUrl"
                          control={control}
                          render={({ field }) => (
                            <FileUpload
                              label="صورة شمسية"
                              value={field.value}
                              onChange={field.onChange}
                              uploadType="photo"
                              accept="image/*"
                              maxSize={2}
                              previewType="image"
                              tabIndex={-1}
                            />
                          )}
                        />
                        <Controller
                          name="cinFrontUrl"
                          control={control}
                          render={({ field }) => (
                            <FileUpload
                              label="نسخة مصورة من بطاقة التعريف الوطنية (الجهة الأمامية)"
                              value={field.value}
                              onChange={field.onChange}
                              uploadType="cin_front"
                              accept="image/*,.pdf"
                              maxSize={5}
                              previewType="image"
                              tabIndex={-1}
                            />
                          )}
                        />
                        <Controller
                          name="cinBackUrl"
                          control={control}
                          render={({ field }) => (
                            <FileUpload
                              label="نسخة مصورة من بطاقة التعريف الوطنية (الجهة الخلفية)"
                              value={field.value}
                              onChange={field.onChange}
                              uploadType="cin_back"
                              accept="image/*,.pdf"
                              maxSize={5}
                              previewType="image"
                              tabIndex={-1}
                            />
                          )}
                        />
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-primary">
                        <FileText className="h-4 w-4" />
                        ملاحظات
                      </div>
                      <Textarea
                        id="notes"
                        placeholder="أي ملاحظات إضافية..."
                        className="min-h-[80px] resize-none"
                        {...register("notes")}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter className="px-6 py-4 border-t bg-muted/30">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsCreateOpen(false)}
                  >
                    إلغاء
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || !declarationAccepted}
                    className="min-w-[140px]"
                  >
                    {createMutation.isPending && (
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    )}
                    تسجيل الطالب
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
              <p className="text-xs text-muted-foreground">إجمالي الطلاب</p>
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
              <p className="text-xs text-muted-foreground">طالب نشط</p>
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
              <p className="text-xs text-muted-foreground">غير نشط</p>
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
                placeholder="البحث عن طالب بالاسم أو رقم الهاتف أو رقم ب.ت.و..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10"
              />
            </div>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full sm:w-auto">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all">الكل</TabsTrigger>
                <TabsTrigger value="active">نشط</TabsTrigger>
                <TabsTrigger value="inactive">غير نشط</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Students Table */}
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
          ) : filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-50" />
              {search ? (
                <>
                  <p className="font-medium">لا توجد نتائج للبحث</p>
                  <p className="text-sm mt-1">جرب البحث بكلمات مختلفة</p>
                  <Button variant="outline" className="mt-4" onClick={() => setSearch("")}>
                    مسح البحث
                  </Button>
                </>
              ) : activeTab !== "all" ? (
                <>
                  <p className="font-medium">لا يوجد طلاب في هذا التصنيف</p>
                  <Button variant="outline" className="mt-4" onClick={() => setActiveTab("all")}>
                    عرض جميع الطلاب
                  </Button>
                </>
              ) : (
                <>
                  <p className="font-medium">لا يوجد طلاب مسجلون</p>
                  <p className="text-sm mt-1">ابدأ بإضافة طالب جديد</p>
                  <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
                    <Plus className="h-4 w-4 ml-2" />
                    إضافة طالب
                  </Button>
                </>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الطالب</TableHead>
                  <TableHead className="hidden md:table-cell">الجنس</TableHead>
                  <TableHead className="hidden md:table-cell">اسم الأب</TableHead>
                  <TableHead className="hidden sm:table-cell">الهاتف</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead className="hidden lg:table-cell">تاريخ التسجيل</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student._id} className="group">
                    <TableCell>
                      <Link href={`/admin/students/${student._id}`} className="flex items-center gap-3 hover:text-primary transition-colors">
                        <Avatar className="border-2 border-background shadow-sm">
                          <AvatarFallback className="bg-primary/10 text-primary font-medium">
                            {getInitials(student.firstName, student.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <span className="font-medium block">{getStudentDisplayName(student)}</span>
                          {student.cin && (
                            <span className="text-xs text-muted-foreground" dir="ltr">
                              ب.ت.و: {student.cin}
                            </span>
                          )}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant={student.gender === 'MALE' ? 'secondary' : 'outline'}>
                        {student.gender === 'MALE' ? 'ذكر' : 'أنثى'}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {student.fatherName || "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {student.phone ? (
                        <a 
                          href={`tel:${student.phone}`} 
                          className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                          dir="ltr"
                        >
                          <Phone className="h-3 w-3" />
                          {student.phone.replace('+216', '+216 ')}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={student.isActive ? "success" : "destructive"}
                        className="font-normal"
                      >
                        {student.isActive ? "نشط" : "غير نشط"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(student.createdAt).toLocaleDateString("ar-TN")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/students/${student._id}`}>
                              <Eye className="ml-2 h-4 w-4" />
                              عرض التفاصيل
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/students/${student._id}/edit`}>
                              <Pencil className="ml-2 h-4 w-4" />
                              تعديل
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/students/${student._id}/qr`}>
                              <QrCode className="ml-2 h-4 w-4" />
                              رمز QR
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Download className="ml-2 h-4 w-4" />
                            تحميل QR
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {!student.hasPortalAccess ? (
                            <DropdownMenuItem onClick={() => openAccountDialog(student)}>
                              <UserCheck className="ml-2 h-4 w-4" />
                              إنشاء حساب البوابة
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => resetStudentPassword(student._id)}>
                              <RefreshCw className="ml-2 h-4 w-4" />
                              إعادة تعيين كلمة المرور
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteId(student._id)}
                          >
                            <Trash2 className="ml-2 h-4 w-4" />
                            حذف
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Results Count */}
      {!isLoading && filteredStudents.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          عرض {filteredStudents.length} من {stats.total} طالب
        </p>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف هذا الطالب وجميع سجلات حضوره نهائياً. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              {deleteMutation.isPending && (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              )}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Portal Account Dialog */}
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>إنشاء حساب البوابة</DialogTitle>
            <DialogDescription>
              {accountStudent && (
                <span>إنشاء حساب دخول لبوابة الطلاب :{accountStudent.firstName} {accountStudent.lastName}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          {accountResult ? (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 space-y-3">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">تم إنشاء الحساب بنجاح</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">معرّف الدخول:</span>
                    <span className="font-mono font-bold" dir="ltr">{accountResult.loginIdentifier}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">كلمة المرور المؤقتة:</span>
                    <span className="font-mono font-bold text-primary" dir="ltr">{accountResult.tempPassword}</span>
                  </div>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  احفظ هذه البيانات - سيُطلب من الطالب تغيير كلمة المرور عند أول تسجيل دخول.
                </p>
              </div>
              <DialogFooter>
                <Button onClick={() => setAccountDialogOpen(false)}>إغلاق</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {accountStudent?.email && (
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 text-sm">
                  <p className="text-blue-800 dark:text-blue-300">
                    سيتم استخدام بريد الطالب: <strong dir="ltr">{accountStudent.email}</strong>
                  </p>
                </div>
              )}
              {!accountStudent?.email && (
                <>
                  <div className="space-y-2">
                    <Label>اسم الولي (اختياري)</Label>
                    <Input
                      value={accountParentName}
                      onChange={(e) => setAccountParentName(e.target.value)}
                      placeholder="اسم ولي الأمر"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>بريد الولي الإلكتروني</Label>
                    <Input
                      type="email"
                      value={accountParentEmail}
                      onChange={(e) => setAccountParentEmail(e.target.value)}
                      placeholder="parent@email.com"
                      className="text-left"
                      dir="ltr"
                    />
                  </div>
                  {!accountParentEmail && (
                    <div className="space-y-2">
                      <Label>أو رقم هاتف الولي</Label>
                      <TunisiaPhoneInput
                        value={accountParentPhone}
                        onChange={setAccountParentPhone}
                      />
                    </div>
                  )}
                  {!accountParentEmail && !accountParentPhone && !accountStudent?.phone && (
                    <p className="text-xs text-destructive">
                      يجب توفير بريد إلكتروني أو رقم هاتف على الأقل
                    </p>
                  )}
                </>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setAccountDialogOpen(false)}>إلغاء</Button>
                <Button
                  onClick={createPortalAccount}
                  disabled={accountCreating || (!accountStudent?.email && !accountParentEmail && !accountParentPhone && !accountStudent?.phone)}
                >
                  {accountCreating ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري الإنشاء...
                    </>
                  ) : (
                    "إنشاء الحساب"
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset Password Result Dialog */}
      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>إعادة تعيين كلمة المرور</DialogTitle>
          </DialogHeader>
          {resetPasswordResult && (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 space-y-3">
                <p className="text-sm font-semibold">{resetPasswordResult.studentName}</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">معرّف الدخول:</span>
                    <span className="font-mono font-bold" dir="ltr">{resetPasswordResult.loginIdentifier}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">كلمة المرور الجديدة:</span>
                    <span className="font-mono font-bold text-primary" dir="ltr">{resetPasswordResult.tempPassword}</span>
                  </div>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  سيُطلب من الطالب تغيير كلمة المرور عند تسجيل الدخول التالي.
                </p>
              </div>
              <DialogFooter>
                <Button onClick={() => setResetPasswordDialogOpen(false)}>إغلاق</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
