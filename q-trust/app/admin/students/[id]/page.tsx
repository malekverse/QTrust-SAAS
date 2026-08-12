import { notFound } from "next/navigation"
import Link from "next/link"
import dbConnect from "@/lib/db"
import Student from "@/models/Student"
import StudentSession from "@/models/StudentSession"
import Attendance from "@/models/Attendance"
import SessionTemplate from "@/models/SessionTemplate"
import MonthlyPayment from "@/models/MonthlyPayment"
// Required for populate() - must be imported to register the model
import "@/models/SessionOccurrence"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { 
  ArrowRight, 
  Pencil, 
  QrCode, 
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Phone,
  User,
  MapPin,
  Mail,
  Briefcase,
  GraduationCap,
  FileText,
  IdCard,
  CreditCard
} from "lucide-react"
import { formatDate, getAttendanceStatusLabel, getAttendanceStatusColor } from "@/lib/utils"
import { IslamicDivider } from "@/components/layout/islamic-divider"
import { GENDER_LABELS, ACTIVITY_AREA_LABELS, MONTH_LABELS } from "@/lib/constants"
import QRCode from "qrcode"
import Image from "next/image"

async function getStudentData(id: string) {
  try {
    await dbConnect()

    const student = await Student.findById(id).lean()
    if (!student) return null

    // Get student's sessions
    const studentSessions = await StudentSession.find({ 
      studentId: id,
      isActive: true 
    })
      .populate({
        path: "sessionTemplateId",
        populate: { path: "teacherId", select: "fullName" }
      })
      .lean()

    // Get attendance records
    const attendanceRecords = await Attendance.find({ studentId: id })
      .populate({
        path: "sessionOccurrenceId",
        populate: { path: "sessionTemplateId", select: "name" }
      })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()

    // Calculate stats
    const totalAttendance = await Attendance.countDocuments({ studentId: id })
    const presentCount = await Attendance.countDocuments({ 
      studentId: id, 
      status: { $in: ["PRESENT", "LATE"] } 
    })
    const attendanceRate = totalAttendance > 0 
      ? Math.round((presentCount / totalAttendance) * 100) 
      : 0

    // Get payment records (last 6 months)
    const now = new Date()
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    const paymentRecords = await MonthlyPayment.find({
      studentId: id,
      $or: [
        { year: { $gt: sixMonthsAgo.getFullYear() } },
        {
          year: sixMonthsAgo.getFullYear(),
          month: { $gte: sixMonthsAgo.getMonth() + 1 },
        },
      ],
    })
      .sort({ year: -1, month: -1 })
      .lean()

    const currentMonthPayment = paymentRecords.find(
      (p: any) => p.month === now.getMonth() + 1 && p.year === now.getFullYear()
    )

    // Generate QR code
    const qrDataUrl = await QRCode.toDataURL(student.qrUuid, {
      width: 200,
      margin: 2,
      color: {
        dark: "#136F4E",
        light: "#FFFFFF"
      }
    })

    return {
      student,
      sessions: studentSessions,
      attendanceRecords,
      paymentRecords,
      currentMonthPaid: currentMonthPayment?.isPaid || false,
      stats: {
        totalSessions: totalAttendance,
        presentCount,
        attendanceRate
      },
      qrDataUrl
    }
  } catch (error) {
    console.error("Error fetching student data:", error)
    return null
  }
}

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getStudentData(id)

  if (!data) {
    notFound()
  }

  const { student, sessions, attendanceRecords, paymentRecords, currentMonthPaid, stats, qrDataUrl } = data

  const getInitials = (firstName?: string, lastName?: string) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase()
    }
    if (student.fullName) {
      return student.fullName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    }
    return "؟"
  }

  const displayName = student.firstName && student.lastName 
    ? `${student.firstName} ${student.lastName}`
    : student.fullName || "غير محدد"

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" asChild>
        <Link href="/admin/students">
          <ArrowRight className="ml-2 h-4 w-4" />
          العودة للقائمة
        </Link>
      </Button>

      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Student Info Card */}
        <Card className="flex-1">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20">
                {student.photoUrl && (
                  <AvatarImage src={student.photoUrl} alt={displayName} />
                )}
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {getInitials(student.firstName, student.lastName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <h1 className="text-2xl font-bold">{displayName}</h1>
                  <Badge variant={student.gender === 'MALE' ? 'secondary' : 'outline'}>
                    {GENDER_LABELS[student.gender as keyof typeof GENDER_LABELS] || student.gender}
                  </Badge>
                  <Badge variant={student.isActive ? "success" : "destructive"}>
                    {student.isActive ? "نشط" : "غير نشط"}
                  </Badge>
                  <Badge variant={currentMonthPaid ? "success" : "destructive"} className="flex items-center gap-1">
                    <CreditCard className="h-3 w-3" />
                    {currentMonthPaid ? "مدفوع" : "غير مدفوع"}
                  </Badge>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {student.fatherName && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>اسم الأب: {student.fatherName}</span>
                    </div>
                  )}
                  {student.cin && (
                    <div className="flex items-center gap-2">
                      <IdCard className="h-4 w-4" />
                      <span dir="ltr">ب.ت.و: {student.cin}</span>
                    </div>
                  )}
                  {student.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <a href={`tel:${student.phone}`} className="hover:text-primary" dir="ltr">
                        {student.phone.replace('+216', '+216 ')}
                      </a>
                    </div>
                  )}
                  {student.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <a href={`mailto:${student.email}`} className="hover:text-primary" dir="ltr">
                        {student.email}
                      </a>
                    </div>
                  )}
                  {student.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{student.address}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/students/${id}/edit`}>
                    <Pencil className="ml-1 h-4 w-4" />
                    تعديل
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* QR Code Card */}
        <Card className="w-full lg:w-auto">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              رمز QR
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="p-4 bg-white rounded-lg shadow-inner">
              <Image 
                src={qrDataUrl} 
                alt="QR Code" 
                width={150} 
                height={150}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2 font-mono" dir="ltr">
              {student.qrUuid.slice(0, 8)}...
            </p>
            <Button variant="outline" size="sm" className="mt-3" asChild>
              <Link href={`/admin/students/${id}/qr`}>
                <QrCode className="ml-1 h-4 w-4" />
                طباعة البطاقة
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalSessions}</p>
              <p className="text-sm text-muted-foreground">إجمالي الحصص</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-emerald-500/20">
              <CheckCircle className="h-6 w-6 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.presentCount}</p>
              <p className="text-sm text-muted-foreground">حضور</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-blue-500/20">
              <Clock className="h-6 w-6 text-blue-700 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.attendanceRate}%</p>
              <p className="text-sm text-muted-foreground">نسبة الحضور</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <IslamicDivider />

      {/* Additional Info */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Personal Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              المعلومات الشخصية
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              {student.enrollmentNumber && (
                <>
                  <div className="text-muted-foreground">رقم الانخراط</div>
                  <div>{student.enrollmentNumber}</div>
                </>
              )}
              {student.dateOfBirth && (
                <>
                  <div className="text-muted-foreground">تاريخ الولادة</div>
                  <div>{new Date(student.dateOfBirth).toLocaleDateString("ar-TN")}</div>
                </>
              )}
              {student.placeOfBirth && (
                <>
                  <div className="text-muted-foreground">مكان الولادة</div>
                  <div>{student.placeOfBirth}</div>
                </>
              )}
              {student.profession && (
                <>
                  <div className="text-muted-foreground">المهنة</div>
                  <div>{student.profession}</div>
                </>
              )}
              {student.educationLevel && (
                <>
                  <div className="text-muted-foreground">المستوى التعليمي</div>
                  <div>{student.educationLevel}</div>
                </>
              )}
            </div>

            {student.activityAreas && student.activityAreas.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-2">مجالات النشاط</p>
                  <div className="flex flex-wrap gap-2">
                    {student.activityAreas.map((area: string) => (
                      <Badge key={area} variant="outline">
                        {ACTIVITY_AREA_LABELS[area as keyof typeof ACTIVITY_AREA_LABELS] || area}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {student.notes && (
              <>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">ملاحظات</p>
                  <p className="text-sm">{student.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Enrolled Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">الحصص المسجل فيها</CardTitle>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground">
                لم يتم تسجيل الطالب في أي حصة بعد
              </p>
            ) : (
              <div className="space-y-3">
                {sessions.map((ss: any) => (
                  <div 
                    key={ss._id.toString()} 
                    className="p-3 rounded-lg bg-muted/50 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium">{ss.sessionTemplateId?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {ss.sessionTemplateId?.teacherId?.fullName}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {ss.sessionTemplateId?.startTime} - {ss.sessionTemplateId?.endTime}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Attachments */}
      {(student.photoUrl || student.cinFrontUrl || student.cinBackUrl) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">المرفقات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              {student.photoUrl && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">صورة شمسية</p>
                  <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                    <Image 
                      src={student.photoUrl} 
                      alt="صورة الطالب" 
                      fill 
                      className="object-cover"
                    />
                  </div>
                </div>
              )}
              {student.cinFrontUrl && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">بطاقة التعريف (الأمامية)</p>
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                    <Image 
                      src={student.cinFrontUrl} 
                      alt="بطاقة التعريف - الأمامية" 
                      fill 
                      className="object-cover"
                    />
                  </div>
                </div>
              )}
              {student.cinBackUrl && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">بطاقة التعريف (الخلفية)</p>
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                    <Image 
                      src={student.cinBackUrl} 
                      alt="بطاقة التعريف - الخلفية" 
                      fill 
                      className="object-cover"
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            سجل الاشتراكات
          </CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/subscriptions">
              إدارة الاشتراكات
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {paymentRecords.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground">
              لا توجد سجلات اشتراك بعد
            </p>
          ) : (
            <div className="space-y-3">
              {paymentRecords.map((record: any) => (
                <div
                  key={record._id.toString()}
                  className="p-3 rounded-lg bg-muted/50 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {MONTH_LABELS[record.month as keyof typeof MONTH_LABELS]} {record.year}
                    </p>
                    {record.paidAt && (
                      <p className="text-sm text-muted-foreground">
                        {new Date(record.paidAt).toLocaleDateString("ar-TN")}
                      </p>
                    )}
                  </div>
                  <Badge variant={record.isPaid ? "success" : "destructive"}>
                    {record.isPaid ? "مدفوع" : "غير مدفوع"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Attendance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">سجل الحضور الأخير</CardTitle>
        </CardHeader>
        <CardContent>
          {attendanceRecords.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground">
              لا توجد سجلات حضور بعد
            </p>
          ) : (
            <div className="space-y-3">
              {attendanceRecords.map((record: any) => (
                <div 
                  key={record._id.toString()} 
                  className="p-3 rounded-lg bg-muted/50 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {record.sessionOccurrenceId?.sessionTemplateId?.name || "حصة محذوفة"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(record.createdAt)}
                    </p>
                  </div>
                  <Badge className={getAttendanceStatusColor(record.status)}>
                    {getAttendanceStatusLabel(record.status)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
