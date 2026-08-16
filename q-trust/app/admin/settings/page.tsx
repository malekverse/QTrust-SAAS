"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTheme } from "next-themes"
import { useToast } from "@/components/ui/toast"
import { 
  User, 
  Lock, 
  Palette, 
  Settings2,
  Clock,
  Shield,
  Save,
  Loader2,
  QrCode,
  Building,
  Calendar,
  Eye,
  EyeOff,
  Hash,
  RefreshCw,
  Tablet
} from "lucide-react"
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validations"
import { IslamicDivider } from "@/components/layout/islamic-divider"
import { DEFAULT_QR_SETTINGS } from "@/lib/constants"
import { useTranslations } from "next-intl"

// Scanner kiosk device reported via heartbeat
interface ScannerDeviceInfo {
  deviceId: string
  appVersion?: string
  platform?: string
  batteryLevel?: number
  batteryCharging?: boolean
  pendingScans?: number
  lastSeenAt: string
  lastCheckInAt?: string
}

// A device is "online" if it heartbeated within the last 6 minutes
// (heartbeat interval is 5 minutes)
const DEVICE_ONLINE_WINDOW_MS = 6 * 60 * 1000

function timeAgoAr(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'الآن'
  if (min < 60) return `قبل ${min} دقيقة`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `قبل ${hours} ساعة`
  const days = Math.floor(hours / 24)
  return `قبل ${days} يوم`
}

// Enrollment settings type
interface EnrollmentSettings {
  format: string
  prefix: string
  sequencePadding: number
  resetSequenceYearly: boolean
  currentSequence: number
  lastResetYear: number
}

const DEFAULT_ENROLLMENT_SETTINGS: EnrollmentSettings = {
  format: '{YEAR}-{SEQ}',
  prefix: '',
  sequencePadding: 3,
  resetSequenceYearly: true,
  currentSequence: 0,
  lastResetYear: new Date().getFullYear()
}

// Format presets
const FORMAT_PRESETS = [
  { value: '{YEAR}-{SEQ}', label: 'سنة-رقم', example: '2026-001' },
  { value: '{PREFIX}/{YEAR}/{SEQ}', label: 'بادئة/سنة/رقم', example: 'QT/2026/001' },
  { value: '{PREFIX}-{YEAR}-{SEQ}', label: 'بادئة-سنة-رقم', example: 'QT-2026-001' },
  { value: '{YEAR_SHORT}{SEQ}', label: 'سنة قصيرة+رقم', example: '26001' },
  { value: '{PREFIX}{SEQ}', label: 'بادئة+رقم (مستمر)', example: 'QT00001' },
  { value: '{SEQ}', label: 'رقم فقط', example: '00001' },
]

// Helper to generate preview
function generatePreview(settings: EnrollmentSettings, seq: number = 1): string {
  const year = new Date().getFullYear()
  const yearShort = year.toString().slice(-2)
  const paddedSeq = seq.toString().padStart(settings.sequencePadding, '0')
  
  let result = settings.format
    .replace('{YEAR}', year.toString())
    .replace('{YEAR_SHORT}', yearShort)
    .replace('{SEQ}', paddedSeq)
    .replace('{PREFIX}', settings.prefix)
  
  // Clean up any double separators from empty prefix
  result = result.replace(/^[-\/]/, '').replace(/[-\/][-\/]+/g, '-').replace(/[-\/]$/, '')
  
  return result
}

// Fetch enrollment settings
async function fetchEnrollmentSettings(): Promise<EnrollmentSettings> {
  const res = await fetch('/api/settings?key=enrollment')
  if (!res.ok) throw new Error('Failed to fetch settings')
  const data = await res.json()
  return data.value || DEFAULT_ENROLLMENT_SETTINGS
}

// Save enrollment settings
async function saveEnrollmentSettings(settings: EnrollmentSettings) {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: 'enrollment',
      value: settings,
      description: 'إعدادات رقم الانخراط'
    })
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.message || 'Failed to save settings')
  }
  return res.json()
}

export default function AdminSettingsPage() {
  const t = useTranslations("admin.settings")
  const tc = useTranslations("common")
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()
  const { success, error, warning } = useToast()
  const queryClient = useQueryClient()
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  // Enrollment Settings
  const { data: enrollmentSettings, isLoading: isLoadingEnrollment } = useQuery({
    queryKey: ['settings', 'enrollment'],
    queryFn: fetchEnrollmentSettings
  })

  // Scanner token is fetched behind the admin session instead of being
  // baked into the public bundle via NEXT_PUBLIC_*.
  const [showScannerToken, setShowScannerToken] = useState(false)
  const { data: scannerTokenData } = useQuery({
    queryKey: ['settings', 'scanner-token'],
    queryFn: async (): Promise<{ token: string | null }> => {
      const res = await fetch('/api/admin/scanner-token')
      if (!res.ok) throw new Error('فشل في جلب رمز الماسح')
      return res.json()
    }
  })

  const { data: scannerDevicesData, isLoading: isLoadingDevices } = useQuery({
    queryKey: ['settings', 'scanner-devices'],
    queryFn: async (): Promise<{ devices: ScannerDeviceInfo[] }> => {
      const res = await fetch('/api/admin/scanner-devices')
      if (!res.ok) throw new Error('فشل في جلب الأجهزة')
      return res.json()
    },
    refetchInterval: 60_000
  })

  const [localEnrollmentSettings, setLocalEnrollmentSettings] = useState<EnrollmentSettings>(DEFAULT_ENROLLMENT_SETTINGS)
  
  // Sync local state with fetched data
  useEffect(() => {
    if (enrollmentSettings) {
      setLocalEnrollmentSettings(enrollmentSettings)
    }
  }, [enrollmentSettings])
  
  const enrollmentMutation = useMutation({
    mutationFn: saveEnrollmentSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'enrollment'] })
      queryClient.invalidateQueries({ queryKey: ['nextEnrollmentNumber'] })
      success('تم الحفظ', 'تم حفظ إعدادات رقم الانخراط بنجاح')
    },
    onError: (err: Error) => {
      error('خطأ', err.message || 'فشل حفظ الإعدادات')
    }
  })
  
  // QR Settings state
  const [qrSettings, setQrSettings] = useState<{
    openOffsetBeforeMin: number
    closeOffsetAfterMin: number
    lateThresholdMin: number
  }>({
    openOffsetBeforeMin: DEFAULT_QR_SETTINGS.openOffsetBeforeMin,
    closeOffsetAfterMin: DEFAULT_QR_SETTINGS.closeOffsetAfterMin,
    lateThresholdMin: DEFAULT_QR_SETTINGS.lateThresholdMin,
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  })

  const onChangePassword = async (data: ChangePasswordInput) => {
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const result = await res.json()

      if (!res.ok) {
        error("خطأ", result.message || "فشل تغيير كلمة المرور")
        return
      }

      success("تم بنجاح", "تم تغيير كلمة المرور بنجاح")
      reset()
      setIsChangingPassword(false)
      setShowCurrentPassword(false)
      setShowNewPassword(false)
      setShowConfirmPassword(false)
    } catch (err) {
      error("خطأ", "حدث خطأ أثناء تغيير كلمة المرور")
    }
  }

  const handleSaveQrSettings = () => {
    // In production, this would save to the database
    success("تم الحفظ", "تم حفظ إعدادات QR")
  }

  // Occurrence generation state
  const [isGenerating, setIsGenerating] = useState(false)
  const [occurrenceRange, setOccurrenceRange] = useState({
    startDate: "",
    endDate: "",
  })

  const handleGenerateOccurrences = async () => {
    if (!occurrenceRange.startDate || !occurrenceRange.endDate) {
      warning("تنبيه", "يرجى تحديد تاريخ البداية والنهاية")
      return
    }

    setIsGenerating(true)
    try {
      const res = await fetch("/api/sessions/generate-occurrences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(occurrenceRange),
      })

      const result = await res.json()

      if (!res.ok) {
        error("خطأ", result.message || "فشل إنشاء الحصص")
        return
      }

      success("تم بنجاح", result.message)
      setOccurrenceRange({ startDate: "", endDate: "" })
    } catch (err) {
      error("خطأ", "حدث خطأ أثناء إنشاء الحصص")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
      />

      <Tabs defaultValue="account" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="account">
            <User className="h-4 w-4 ml-2" />
            {t("general")}
          </TabsTrigger>
          <TabsTrigger value="system">
            <Settings2 className="h-4 w-4 ml-2" />
            {t("notifications")}
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Palette className="h-4 w-4 ml-2" />
            {t("branding")}
          </TabsTrigger>
        </TabsList>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-6">
          {/* Profile Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                معلومات الحساب
              </CardTitle>
              <CardDescription>
                معلوماتك الأساسية كمسؤول
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>الاسم الكامل</Label>
                  <Input
                    value={session?.user?.fullName || ""}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label>البريد الإلكتروني</Label>
                  <Input
                    value={session?.user?.email || ""}
                    disabled
                    className="bg-muted"
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">{tc("admin")}</span>
              </div>
            </CardContent>
          </Card>

          {/* Password Change */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                كلمة المرور
              </CardTitle>
              <CardDescription>
                قم بتغيير كلمة المرور الخاصة بك
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isChangingPassword ? (
                <Button onClick={() => setIsChangingPassword(true)}>
                  {tc("update")}
                </Button>
              ) : (
                <form onSubmit={handleSubmit(onChangePassword)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">كلمة المرور الحالية</Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showCurrentPassword ? "text" : "password"}
                        className="pl-10"
                        dir="ltr"
                        {...register("currentPassword")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {errors.currentPassword && (
                      <p className="text-sm text-destructive">{errors.currentPassword.message}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">كلمة المرور الجديدة</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        className="pl-10"
                        dir="ltr"
                        {...register("newPassword")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {errors.newPassword && (
                      <p className="text-sm text-destructive">{errors.newPassword.message}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        className="pl-10"
                        dir="ltr"
                        {...register("confirmPassword")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="ml-2 h-4 w-4" />
                      )}
                      {tc("save")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsChangingPassword(false)
                        reset()
                        setShowCurrentPassword(false)
                        setShowNewPassword(false)
                        setShowConfirmPassword(false)
                      }}
                    >
                      {tc("cancel")}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-6">
          {/* Enrollment Number Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-5 w-5" />
                إعدادات رقم الانخراط
              </CardTitle>
              <CardDescription>
                تخصيص صيغة أرقام الانخراط للطلاب الجدد
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoadingEnrollment ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Format Preview */}
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">معاينة الصيغة</p>
                        <p className="text-2xl font-mono font-bold text-primary mt-1" dir="ltr">
                          {generatePreview(localEnrollmentSettings, localEnrollmentSettings.currentSequence + 1 || 1)}
                        </p>
                      </div>
                      <div className="text-left" dir="ltr">
                        <p className="text-xs text-muted-foreground">الرقم التالي</p>
                        <p className="text-lg font-mono">
                          #{(localEnrollmentSettings.currentSequence + 1 || 1).toString().padStart(localEnrollmentSettings.sequencePadding, '0')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Format Selection */}
                    <div className="space-y-2">
                      <Label>صيغة رقم الانخراط</Label>
                      <Select
                        value={localEnrollmentSettings.format}
                        onValueChange={(value) => setLocalEnrollmentSettings(s => ({ ...s, format: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="اختر الصيغة" />
                        </SelectTrigger>
                        <SelectContent>
                          {FORMAT_PRESETS.map(preset => (
                            <SelectItem key={preset.value} value={preset.value}>
                              <div className="flex items-center justify-between gap-4">
                                <span>{preset.label}</span>
                                <span className="text-xs text-muted-foreground font-mono" dir="ltr">
                                  {preset.example}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        المتغيرات: {'{YEAR}'} السنة، {'{YEAR_SHORT}'} السنة المختصرة، {'{SEQ}'} الرقم، {'{PREFIX}'} البادئة
                      </p>
                    </div>

                    {/* Prefix */}
                    <div className="space-y-2">
                      <Label>البادئة (اختياري)</Label>
                      <Input
                        value={localEnrollmentSettings.prefix}
                        onChange={(e) => setLocalEnrollmentSettings(s => ({ 
                          ...s, 
                          prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)
                        }))}
                        placeholder="مثال: QT"
                        maxLength={5}
                        dir="ltr"
                        className="font-mono"
                      />
                      <p className="text-xs text-muted-foreground">
                        أحرف إنجليزية كبيرة أو أرقام (5 كحد أقصى)
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Sequence Padding */}
                    <div className="space-y-2">
                      <Label>عدد خانات الرقم التسلسلي</Label>
                      <Select
                        value={localEnrollmentSettings.sequencePadding.toString()}
                        onValueChange={(value) => setLocalEnrollmentSettings(s => ({ 
                          ...s, 
                          sequencePadding: parseInt(value) 
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">2 خانات (01-99)</SelectItem>
                          <SelectItem value="3">3 خانات (001-999)</SelectItem>
                          <SelectItem value="4">4 خانات (0001-9999)</SelectItem>
                          <SelectItem value="5">5 خانات (00001-99999)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Reset Yearly */}
                    <div className="space-y-2">
                      <Label>إعادة ضبط الرقم سنوياً</Label>
                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="text-sm font-medium">
                            {localEnrollmentSettings.resetSequenceYearly ? 'نعم' : 'لا'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {localEnrollmentSettings.resetSequenceYearly 
                              ? 'يبدأ من 1 مع كل سنة جديدة' 
                              : 'الأرقام مستمرة بدون إعادة ضبط'}
                          </p>
                        </div>
                        <Switch
                          checked={localEnrollmentSettings.resetSequenceYearly}
                          onCheckedChange={(checked) => setLocalEnrollmentSettings(s => ({ 
                            ...s, 
                            resetSequenceYearly: checked 
                          }))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Custom Format Input */}
                  <div className="space-y-2">
                    <Label>صيغة مخصصة (متقدم)</Label>
                    <Input
                      value={localEnrollmentSettings.format}
                      onChange={(e) => setLocalEnrollmentSettings(s => ({ ...s, format: e.target.value }))}
                      placeholder="{YEAR}-{SEQ}"
                      dir="ltr"
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      يمكنك كتابة صيغة مخصصة باستخدام المتغيرات أعلاه
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      onClick={() => enrollmentMutation.mutate(localEnrollmentSettings)}
                      disabled={enrollmentMutation.isPending}
                    >
                      {enrollmentMutation.isPending ? (
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="ml-2 h-4 w-4" />
                      )}
                      {t("saveSettings")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setLocalEnrollmentSettings(enrollmentSettings || DEFAULT_ENROLLMENT_SETTINGS)}
                      disabled={enrollmentMutation.isPending}
                    >
                      <RefreshCw className="ml-2 h-4 w-4" />
                      {tc("reset")}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Organization Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                معلومات الجمعية
              </CardTitle>
              <CardDescription>
                بيانات مؤسستك كما تظهر في المنصة والبطاقات المطبوعة
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("orgName")}</Label>
                  <Input
                    value={session?.user?.tenantName || ""}
                    className="bg-muted"
                    disabled
                    readOnly
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* QR Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                إعدادات الماسح الضوئي
              </CardTitle>
              <CardDescription>
                تحكم في نافذة تسجيل الحضور
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>فتح التسجيل قبل (دقيقة)</Label>
                  <Input
                    type="number"
                    value={qrSettings.openOffsetBeforeMin}
                    onChange={(e) => setQrSettings(s => ({ 
                      ...s, 
                      openOffsetBeforeMin: parseInt(e.target.value) || 0 
                    }))}
                    min={0}
                    max={60}
                  />
                  <p className="text-xs text-muted-foreground">
                    يبدأ التسجيل قبل بداية الحصة
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>إغلاق التسجيل بعد (دقيقة)</Label>
                  <Input
                    type="number"
                    value={qrSettings.closeOffsetAfterMin}
                    onChange={(e) => setQrSettings(s => ({ 
                      ...s, 
                      closeOffsetAfterMin: parseInt(e.target.value) || 0 
                    }))}
                    min={0}
                    max={120}
                  />
                  <p className="text-xs text-muted-foreground">
                    ينتهي التسجيل بعد نهاية الحصة
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>حد التأخر (دقيقة)</Label>
                  <Input
                    type="number"
                    value={qrSettings.lateThresholdMin}
                    onChange={(e) => setQrSettings(s => ({ 
                      ...s, 
                      lateThresholdMin: parseInt(e.target.value) || 0 
                    }))}
                    min={0}
                    max={30}
                  />
                  <p className="text-xs text-muted-foreground">
                    يُعتبر متأخراً بعد بداية الحصة
                  </p>
                </div>
              </div>
              <Button onClick={handleSaveQrSettings}>
                <Save className="ml-2 h-4 w-4" />
                {t("saveSettings")}
              </Button>
            </CardContent>
          </Card>

          {/* Scanner Token */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                رمز الماسح الضوئي
              </CardTitle>
              <CardDescription>
                رمز الأمان للوح الحضور
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-muted font-mono text-sm flex items-center justify-between gap-2" dir="ltr">
                <span className="truncate">
                  {scannerTokenData?.token
                    ? (showScannerToken ? scannerTokenData.token : '•'.repeat(24))
                    : '—'}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowScannerToken(v => !v)}
                >
                  {showScannerToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                استخدم هذا الرمز على صفحة الماسح الضوئي:
                <code className="px-1 bg-muted rounded mx-1">/scanner?token=TOKEN</code>
              </p>
            </CardContent>
          </Card>

          {/* Scanner Devices (kiosk fleet health) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tablet className="h-5 w-5" />
                أجهزة المسح
              </CardTitle>
              <CardDescription>
                حالة أجهزة تسجيل الحضور — يظهر الجهاز بعد أول عملية مسح ناجحة
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingDevices ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جارٍ التحميل...
                </div>
              ) : !scannerDevicesData?.devices?.length ? (
                <p className="text-sm text-muted-foreground">
                  لا توجد أجهزة مسجلة بعد
                </p>
              ) : (
                <div className="space-y-3">
                  {scannerDevicesData.devices.map((device) => {
                    const online =
                      Date.now() - new Date(device.lastSeenAt).getTime() <
                      DEVICE_ONLINE_WINDOW_MS
                    return (
                      <div
                        key={device.deviceId}
                        className="flex items-center justify-between rounded-lg border p-3 gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                              online ? 'bg-green-500' : 'bg-gray-300'
                            }`}
                            title={online ? 'متصل' : 'غير متصل'}
                          />
                          <div className="min-w-0">
                            <p className="font-mono text-sm truncate" dir="ltr">
                              {device.deviceId.slice(0, 12)}…
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {device.platform || '—'}
                              {device.appVersion ? ` · v${device.appVersion}` : ''}
                              {' · '}
                              {online ? 'متصل' : `آخر ظهور ${timeAgoAr(device.lastSeenAt)}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                          {typeof device.batteryLevel === 'number' && (
                            <span dir="ltr">
                              🔋 {Math.round(device.batteryLevel * 100)}%
                              {device.batteryCharging ? '⚡' : ''}
                            </span>
                          )}
                          {!!device.pendingScans && device.pendingScans > 0 && (
                            <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5">
                              {device.pendingScans} بانتظار المزامنة
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Generate Occurrences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                إنشاء الحصص
              </CardTitle>
              <CardDescription>
                إنشاء الحصص المجدولة لفترة زمنية محددة
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>من تاريخ</Label>
                  <Input
                    type="date"
                    value={occurrenceRange.startDate}
                    onChange={(e) => setOccurrenceRange(r => ({ ...r, startDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>إلى تاريخ</Label>
                  <Input
                    type="date"
                    value={occurrenceRange.endDate}
                    onChange={(e) => setOccurrenceRange(r => ({ ...r, endDate: e.target.value }))}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                سيتم إنشاء حصص لجميع قوالب الحصص النشطة في الفترة المحددة
              </p>
              <Button 
                onClick={handleGenerateOccurrences}
                disabled={isGenerating || !occurrenceRange.startDate || !occurrenceRange.endDate}
              >
                {isGenerating ? (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                ) : (
                  <Calendar className="ml-2 h-4 w-4" />
                )}
                إنشاء الحصص
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-6">
          {/* Theme Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                المظهر
              </CardTitle>
              <CardDescription>
                تخصيص مظهر التطبيق
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>الوضع الداكن</Label>
                  <p className="text-sm text-muted-foreground">
                    تفعيل المظهر الداكن للتطبيق
                  </p>
                </div>
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                />
              </div>

              <IslamicDivider />

              {/* Color Preview */}
              <div className="space-y-3">
                <Label>الألوان الحالية</Label>
                <div className="flex gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-12 h-12 rounded-lg bg-primary" />
                    <span className="text-xs">أساسي</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-12 h-12 rounded-lg bg-accent" />
                    <span className="text-xs">ذهبي</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-12 h-12 rounded-lg bg-secondary" />
                    <span className="text-xs">ثانوي</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-12 h-12 rounded-lg bg-background border" />
                    <span className="text-xs">خلفية</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Motivational */}
          <Card className="bg-gradient-to-l from-primary/5 to-transparent border-primary/20">
            <CardContent className="p-6 text-center">
              <p className="text-lg font-arabic text-primary mb-2">
                ﴿ إِنَّ هَٰذَا الْقُرْآنَ يَهْدِي لِلَّتِي هِيَ أَقْوَمُ ﴾
              </p>
              <p className="text-sm text-muted-foreground">سورة الإسراء - الآية 9</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
