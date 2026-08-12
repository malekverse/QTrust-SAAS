"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useTheme } from "next-themes"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Settings,
  User,
  QrCode,
  KeyRound,
  Phone,
  MapPin,
  Mail,
  Calendar,
  GraduationCap,
  Sun,
  Moon,
  Eye,
  EyeOff,
  Loader2,
  Download,
  Smartphone,
} from "lucide-react"
import { useToast } from "@/components/ui/toast"
import { TunisiaPhoneInput } from "@/components/ui/tunisia-phone-input"

interface ProfileData {
  profile: {
    firstName: string
    lastName: string
    displayName: string
    email: string
    phone: string
    address: string
    dateOfBirth: string | null
    gender: string
    educationLevel: string
    enrollmentNumber: string
    photoUrl: string
    parentName: string
    parentEmail: string
    parentPhone: string
  }
  qrCode: {
    uuid: string
    dataUrl: string
  }
  account: {
    loginEmail: string
    loginPhone: string | null
    createdAt: string
  }
}

export default function StudentSettings() {
  const { update: updateSession } = useSession()
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()
  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("profile")

  // Edit states
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [savingProfile, setSavingProfile] = useState(false)

  // Password states
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/student/profile")
      if (res.ok) {
        const json = await res.json()
        setData(json)
        setPhone(json.profile.phone)
        setAddress(json.profile.address)
      }
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setLoading(false)
    }
  }

  const saveProfile = async () => {
    setSavingProfile(true)
    try {
      const res = await fetch("/api/student/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, address })
      })
      const result = await res.json()
      if (res.ok) {
        toast({ title: "تم الحفظ", description: "تم تحديث بياناتك بنجاح" })
        // Refresh profile data after save
        fetchProfile()
      } else {
        toast({ title: "خطأ", description: result.message, variant: "destructive" })
      }
    } catch {
      toast({ title: "خطأ", description: "حدث خطأ أثناء الحفظ", variant: "destructive" })
    } finally {
      setSavingProfile(false)
    }
  }

  const changePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "خطأ", description: "كلمات المرور غير متطابقة", variant: "destructive" })
      return
    }
    if (newPassword.length < 6) {
      toast({ title: "خطأ", description: "كلمة المرور يجب أن تكون 6 أحرف على الأقل", variant: "destructive" })
      return
    }

    setChangingPassword(true)
    try {
      const res = await fetch("/api/student/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword })
      })
      const result = await res.json()
      if (res.ok) {
        toast({ title: "تم التغيير", description: "تم تغيير كلمة المرور بنجاح" })
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
        // Update session to clear mustChangePassword if set
        await updateSession({ mustChangePassword: false })
      } else {
        toast({ title: "خطأ", description: result.message, variant: "destructive" })
      }
    } catch {
      toast({ title: "خطأ", description: "حدث خطأ أثناء تغيير كلمة المرور", variant: "destructive" })
    } finally {
      setChangingPassword(false)
    }
  }

  const downloadQR = () => {
    if (!data?.qrCode.dataUrl) return
    const link = document.createElement('a')
    link.download = `qr-${data.profile.displayName}.png`
    link.href = data.qrCode.dataUrl
    link.click()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">حدث خطأ أثناء تحميل البيانات</p>
      </div>
    )
  }

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <Settings className="h-7 w-7 text-primary" />
          الإعدادات
        </h1>
        <p className="text-muted-foreground mt-1">إدارة الملف الشخصي وإعدادات الحساب</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="profile">الملف الشخصي</TabsTrigger>
          <TabsTrigger value="qrcode">رمز QR</TabsTrigger>
          <TabsTrigger value="password">كلمة المرور</TabsTrigger>
          <TabsTrigger value="appearance">المظهر</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="mt-4 space-y-4">
          {/* Profile Card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <Avatar className="h-16 w-16">
                  {data.profile.photoUrl ? (
                    <AvatarImage src={data.profile.photoUrl} alt={data.profile.displayName} />
                  ) : null}
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                    {getInitials(data.profile.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">{data.profile.displayName}</h3>
                  <p className="text-sm text-muted-foreground">
                    رقم الانخراط: {data.profile.enrollmentNumber || 'غير محدد'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Read-only info */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    الاسم الكامل
                  </Label>
                  <p className="text-sm font-medium">{data.profile.displayName}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    البريد الإلكتروني
                  </Label>
                  <p className="text-sm font-medium" dir="ltr">{data.profile.email || 'غير محدد'}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <GraduationCap className="h-3 w-3" />
                    المستوى التعليمي
                  </Label>
                  <p className="text-sm font-medium">{data.profile.educationLevel || 'غير محدد'}</p>
                </div>
                {data.profile.dateOfBirth && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      تاريخ الميلاد
                    </Label>
                    <p className="text-sm font-medium">
                      {new Date(data.profile.dateOfBirth).toLocaleDateString('ar-TN')}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Editable Fields */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">تعديل المعلومات</CardTitle>
              <CardDescription>يمكنك تعديل رقم الهاتف والعنوان</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  رقم الهاتف
                </Label>
                <TunisiaPhoneInput
                  value={phone}
                  onChange={setPhone}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  العنوان
                </Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="العنوان"
                />
              </div>
              <Button onClick={saveProfile} disabled={savingProfile}>
                {savingProfile ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  "حفظ التعديلات"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Parent Info (read-only) */}
          {(data.profile.parentName || data.profile.parentEmail || data.profile.parentPhone) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">معلومات الولي</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {data.profile.parentName && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">اسم الولي</Label>
                      <p className="text-sm font-medium">{data.profile.parentName}</p>
                    </div>
                  )}
                  {data.profile.parentEmail && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">البريد الإلكتروني</Label>
                      <p className="text-sm font-medium" dir="ltr">{data.profile.parentEmail}</p>
                    </div>
                  )}
                  {data.profile.parentPhone && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">رقم الهاتف</Label>
                      <p className="text-sm font-medium" dir="ltr">{data.profile.parentPhone}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* QR Code Tab */}
        <TabsContent value="qrcode" className="mt-4">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-base flex items-center justify-center gap-2">
                <QrCode className="h-5 w-5 text-primary" />
                بطاقة QR الرقمية
              </CardTitle>
              <CardDescription>
                يمكنك استخدام هذا الرمز لتسجيل الحضور عبر الماسح الضوئي
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              {data.qrCode.dataUrl ? (
                <>
                  <div className="bg-white p-4 rounded-2xl shadow-lg border">
                    <img 
                      src={data.qrCode.dataUrl} 
                      alt="QR Code" 
                      className="w-64 h-64"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground text-center max-w-xs">
                    أظهر هذا الرمز على شاشة هاتفك أمام الماسح الضوئي لتسجيل حضورك
                  </p>
                  <div className="flex gap-3">
                    <Button onClick={downloadQR} variant="outline" className="gap-2">
                      <Download className="h-4 w-4" />
                      تحميل الرمز
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400 max-w-sm">
                    <Smartphone className="h-5 w-5 shrink-0" />
                    <span>إذا فقدت بطاقتك الفعلية، يمكنك استخدام هذا الرمز كبديل مؤقت</span>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <QrCode className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p>رمز QR غير متوفر</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Password Tab */}
        <TabsContent value="password" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                تغيير كلمة المرور
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">كلمة المرور الحالية</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPw ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="text-left pl-10"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">كلمة المرور الجديدة</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="text-left pl-10"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">6 أحرف على الأقل</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="text-left"
                  dir="ltr"
                />
              </div>
              <Button onClick={changePassword} disabled={changingPassword}>
                {changingPassword ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري التغيير...
                  </>
                ) : (
                  "تغيير كلمة المرور"
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">المظهر</CardTitle>
              <CardDescription>اختر سمة التطبيق المفضلة</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3 max-w-md">
                <Button
                  variant={theme === "light" ? "default" : "outline"}
                  onClick={() => setTheme("light")}
                  className="flex flex-col items-center gap-2 h-auto py-4"
                >
                  <Sun className="h-5 w-5" />
                  <span className="text-xs">فاتح</span>
                </Button>
                <Button
                  variant={theme === "dark" ? "default" : "outline"}
                  onClick={() => setTheme("dark")}
                  className="flex flex-col items-center gap-2 h-auto py-4"
                >
                  <Moon className="h-5 w-5" />
                  <span className="text-xs">داكن</span>
                </Button>
                <Button
                  variant={theme === "system" ? "default" : "outline"}
                  onClick={() => setTheme("system")}
                  className="flex flex-col items-center gap-2 h-auto py-4"
                >
                  <Settings className="h-5 w-5" />
                  <span className="text-xs">تلقائي</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Account Info */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">معلومات الحساب</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">معرّف الدخول</span>
                  <span className="font-medium" dir="ltr">
                    {data.account.loginPhone || data.account.loginEmail}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">تاريخ الإنشاء</span>
                  <span className="font-medium">
                    {new Date(data.account.createdAt).toLocaleDateString('ar-TN')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
