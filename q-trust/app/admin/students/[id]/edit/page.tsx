"use client"

import { use, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowRight, Save, Loader2, FileText } from "lucide-react"
import { 
  GENDER, 
  GENDER_LABELS, 
  ACTIVITY_AREAS, 
  ACTIVITY_AREA_LABELS, 
  EDUCATION_LEVELS,
  DECLARATION_TEXT 
} from "@/lib/constants"
import { TunisiaPhoneInput } from "@/components/ui/tunisia-phone-input"
import { CINInput } from "@/components/ui/cin-input"
import { EmailInput } from "@/components/ui/email-input"
import { DateInput } from "@/components/ui/date-input"
import { FileUpload } from "@/components/ui/file-upload"
import { useToast } from "@/components/ui/toast"
import { useTranslations } from "next-intl"
import { z } from "zod"

interface Student {
  _id: string
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
  activityAreas?: string[]
  declarationAccepted?: boolean
  signatureLocation?: string
  signatureDate?: string
  photoUrl?: string
  cinFrontUrl?: string
  cinBackUrl?: string
  notes?: string
  isActive: boolean
  // Legacy fields
  fullName?: string
  parentName?: string
}

async function fetchStudent(id: string): Promise<Student> {
  const res = await fetch(`/api/students/${id}`)
  if (!res.ok) throw new Error("Failed to fetch student")
  return res.json()
}

async function updateStudent(id: string, data: Record<string, unknown>) {
  const res = await fetch(`/api/students/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.message || "Failed to update student")
  }
  return res.json()
}

// Type for edit form
type EditStudentInput = {
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
  isActive?: boolean
}

// Schema for edit form validation
const editStudentSchema = z.object({
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
  declarationAccepted: z.boolean(),
  signatureLocation: z.string().optional(),
  signatureDate: z.string().optional(),
  photoUrl: z.string().optional(),
  cinFrontUrl: z.string().optional(),
  cinBackUrl: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional()
})

export default function EditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const t = useTranslations("admin.students")
  const tc = useTranslations("common")

  const { data: student, isLoading } = useQuery({
    queryKey: ["student", id],
    queryFn: () => fetchStudent(id),
  })

  const mutation = useMutation({
    mutationFn: (data: EditStudentInput) => updateStudent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", id] })
      queryClient.invalidateQueries({ queryKey: ["students"] })
      success(t("updateSuccessTitle"), t("updateSuccessMessage"))
      router.push(`/admin/students/${id}`)
    },
    onError: (err: Error) => {
      error(t("updateFailedTitle"), err.message || t("updateFailedMessage"))
    },
  })

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<EditStudentInput>({
    resolver: zodResolver(editStudentSchema),
    defaultValues: {
      gender: GENDER.MALE,
      activityAreas: [],
      declarationAccepted: true,
    }
  })

  useEffect(() => {
    if (student) {
      // Handle migration from old schema
      let firstName = student.firstName
      let lastName = student.lastName
      
      // If firstName/lastName are missing but fullName exists (legacy data)
      if ((!firstName || !lastName) && student.fullName) {
        const parts = student.fullName.split(' ')
        firstName = parts[0] || ''
        lastName = parts.slice(1).join(' ') || parts[0] || ''
      }

      reset({
        enrollmentNumber: student.enrollmentNumber || "",
        cin: student.cin || "",
        firstName: firstName || "",
        lastName: lastName || "",
        fatherName: student.fatherName || student.parentName || "",
        gender: student.gender || GENDER.MALE,
        profession: student.profession || "",
        dateOfBirth: student.dateOfBirth 
          ? new Date(student.dateOfBirth).toISOString().split('T')[0] 
          : undefined,
        placeOfBirth: student.placeOfBirth || "",
        educationLevel: student.educationLevel || "",
        address: student.address || "",
        phone: student.phone || "",
        email: student.email || "",
        activityAreas: student.activityAreas || [],
        declarationAccepted: student.declarationAccepted !== false,
        signatureLocation: student.signatureLocation || "",
        signatureDate: student.signatureDate 
          ? new Date(student.signatureDate).toISOString().split('T')[0] 
          : undefined,
        photoUrl: student.photoUrl || "",
        cinFrontUrl: student.cinFrontUrl || "",
        cinBackUrl: student.cinBackUrl || "",
        notes: student.notes || "",
        isActive: student.isActive,
      })
    }
  }, [student, reset])

  const isActive = watch("isActive")
  const declarationAccepted = watch("declarationAccepted")

  const onSubmit = (data: EditStudentInput) => {
    mutation.mutate(data)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[600px]" />
      </div>
    )
  }

  if (!student) {
    return <div>{t("studentNotFound")}</div>
  }

  const displayName = student.firstName && student.lastName 
    ? `${student.firstName} ${student.lastName}`
    : student.fullName || t("notSpecified")

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" asChild>
        <Link href={`/admin/students/${id}`}>
          <ArrowRight className="ml-2 h-4 w-4" />
          {t("backToProfile")}
        </Link>
      </Button>

      <PageHeader
        title={t("editStudent")}
        description={displayName}
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-6">
            {/* Section A - المعلومات الشخصية */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <FileText className="h-4 w-4" />
                {t("personalInfo")}
              </div>
              <div className="space-y-4 rounded-xl border bg-card/50 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="enrollmentNumber">{t("enrollmentId")}</Label>
                    <Input
                      id="enrollmentNumber"
                      {...register("enrollmentNumber")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cin">{t("cinNumber")}</Label>
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
                    <Label htmlFor="firstName">{t("firstNameRequired")}</Label>
                    <Input
                      id="firstName"
                      {...register("firstName")}
                    />
                    {errors.firstName && (
                      <p className="text-sm text-destructive">{errors.firstName.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">{t("lastNameRequired")}</Label>
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
                    <Label htmlFor="fatherName">{t("fatherName")}</Label>
                    <Input
                      id="fatherName"
                      {...register("fatherName")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gender">{t("genderRequired")}</Label>
                    <Controller
                      name="gender"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder={t("selectGender")} />
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
                    <Label htmlFor="profession">{t("profession")}</Label>
                    <Input
                      id="profession"
                      {...register("profession")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="educationLevel">{t("educationLevelLabel")}</Label>
                    <Controller
                      name="educationLevel"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value || ''} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder={t("selectLevel")} />
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
                    <Label htmlFor="dateOfBirth">{t("birthDate")}</Label>
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
                    <Label htmlFor="placeOfBirth">{t("placeOfBirth")}</Label>
                    <Input
                      id="placeOfBirth"
                      {...register("placeOfBirth")}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">{t("address")}</Label>
                  <Input
                    id="address"
                    {...register("address")}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="phone">{tc("phone")}</Label>
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
                    <Label htmlFor="email">{tc("email")}</Label>
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
                {t("selectActivityArea")}
              </div>
              <div className="rounded-xl border bg-card/50 p-4">
                <Controller
                  name="activityAreas"
                  control={control}
                  render={({ field }) => (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {Object.entries(ACTIVITY_AREAS).map(([key, value]) => (
                        <label 
                          key={key} 
                          htmlFor={`activity-${key}`}
                          className="flex items-center gap-3 p-3 rounded-lg border bg-background/50 cursor-pointer hover:bg-muted/50 transition-colors"
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
                          <span className="text-sm">
                            {ACTIVITY_AREA_LABELS[key as keyof typeof ACTIVITY_AREA_LABELS]}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                />
              </div>
            </div>

            {/* Section C - الإقرار */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                {t("declarationLabel")} <span className="text-destructive">*</span>
              </div>
              <div className="rounded-xl border bg-card/50 p-4 space-y-4">
                <p className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg leading-relaxed">
                  {DECLARATION_TEXT}
                </p>
                <Controller
                  name="declarationAccepted"
                  control={control}
                  render={({ field }) => (
                    <label 
                      htmlFor="declaration"
                      className="flex items-center gap-3 p-3 rounded-lg border bg-background/50 cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        id="declaration"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                      <span className="text-sm font-medium">{t("declarationAccept")}</span>
                    </label>
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
                {t("signatureInfo")}
              </div>
              <div className="rounded-xl border bg-card/50 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="signatureLocation">{t("signedAt")}</Label>
                    <Input
                      id="signatureLocation"
                      placeholder={t("cityPlaceholder")}
                      {...register("signatureLocation")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signatureDate">{tc("date")}</Label>
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
                {t("requiredAttachments")}
              </div>
              <div className="rounded-xl border bg-card/50 p-4 space-y-4">
                <Controller
                  name="photoUrl"
                  control={control}
                  render={({ field }) => (
                    <FileUpload
                      label={t("personalPhoto")}
                      value={field.value}
                      onChange={field.onChange}
                      uploadType="photo"
                      accept="image/*"
                      maxSize={2}
                      previewType="image"
                    />
                  )}
                />
                <Controller
                  name="cinFrontUrl"
                  control={control}
                  render={({ field }) => (
                    <FileUpload
                      label={t("cinFrontUploadLabel")}
                      value={field.value}
                      onChange={field.onChange}
                      uploadType="cin_front"
                      accept="image/*,.pdf"
                      maxSize={5}
                      previewType="image"
                    />
                  )}
                />
                <Controller
                  name="cinBackUrl"
                  control={control}
                  render={({ field }) => (
                    <FileUpload
                      label={t("cinBackUploadLabel")}
                      value={field.value}
                      onChange={field.onChange}
                      uploadType="cin_back"
                      accept="image/*,.pdf"
                      maxSize={5}
                      previewType="image"
                    />
                  )}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                {tc("notes")}
              </div>
              <Textarea
                id="notes"
                className="min-h-[80px] resize-none"
                {...register("notes")}
              />
            </div>

            {/* Status */}
            <div className="flex items-center justify-between p-4 rounded-xl border bg-card/50">
              <div>
                <Label htmlFor="isActive" className="font-medium">{t("studentStatus")}</Label>
                <p className="text-sm text-muted-foreground">
                  {isActive ? t("studentActiveDesc") : t("studentInactiveDesc")}
                </p>
              </div>
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={(checked) => setValue("isActive", checked)}
              />
            </div>
          </div>

        <div className="flex gap-3">
          <Button 
            type="submit" 
            disabled={mutation.isPending || !declarationAccepted}
          >
            {mutation.isPending ? (
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="ml-2 h-4 w-4" />
            )}
            {t("saveChanges")}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={`/admin/students/${id}`}>{tc("cancel")}</Link>
          </Button>
        </div>

        {mutation.error && (
          <p className="text-sm text-destructive mt-4">{mutation.error.message}</p>
        )}
      </form>
    </div>
  )
}
