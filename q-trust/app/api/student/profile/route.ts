import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import User from "@/models/User"
import Student from "@/models/Student"
import { auth, hashPassword, verifyPassword } from "@/lib/auth"
import { ROLES } from "@/lib/constants"
import QRCode from 'qrcode'

// Force model registration
void Student; void User

// GET /api/student/profile - Get student profile & QR code
export async function GET() {
  try {
    const session = await auth()
    
    if (!session || session.user.role !== ROLES.STUDENT) {
      return NextResponse.json(
        { message: "غير مصرح لك بالوصول" },
        { status: 403 }
      )
    }

    const tenantId = session.user.tenantId
    if (!tenantId) {
      return NextResponse.json({ message: "لا يوجد سياق مؤسسة" }, { status: 403 })
    }

    await dbConnect()

    const user = await User.findOne({ _id: session.user.id, tenantId }).lean()
    if (!user?.studentId) {
      return NextResponse.json({ message: "حساب الطالب غير موجود" }, { status: 404 })
    }

    const student = await Student.findOne({ _id: user.studentId, tenantId }).lean()
    if (!student) {
      return NextResponse.json({ message: "بيانات الطالب غير موجودة" }, { status: 404 })
    }

    // Generate QR code as data URL
    let qrCodeDataUrl = ''
    if (student.qrUuid) {
      try {
        qrCodeDataUrl = await QRCode.toDataURL(student.qrUuid, {
          width: 300,
          margin: 2,
          color: {
            dark: '#136F4E',
            light: '#FFFFFF'
          }
        })
      } catch (err) {
        console.error("Error generating QR code:", err)
      }
    }

    return NextResponse.json({
      profile: {
        firstName: student.firstName,
        lastName: student.lastName,
        displayName: student.firstName && student.lastName 
          ? `${student.firstName} ${student.lastName}` 
          : student.fullName || '',
        email: student.email || user.email,
        phone: student.phone || '',
        address: student.address || '',
        dateOfBirth: student.dateOfBirth || null,
        gender: student.gender,
        educationLevel: student.educationLevel || '',
        enrollmentNumber: student.enrollmentNumber || '',
        photoUrl: student.photoUrl || '',
        parentName: student.parentName || '',
        parentEmail: student.parentEmail || '',
        parentPhone: student.parentPhone || ''
      },
      qrCode: {
        uuid: student.qrUuid,
        dataUrl: qrCodeDataUrl
      },
      account: {
        loginEmail: user.email,
        loginPhone: user.phone || null,
        createdAt: user.createdAt
      }
    })
  } catch (error) {
    console.error("Error fetching student profile:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء جلب البيانات" },
      { status: 500 }
    )
  }
}

// PATCH /api/student/profile - Update student profile (limited fields)
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session || session.user.role !== ROLES.STUDENT) {
      return NextResponse.json(
        { message: "غير مصرح لك بالوصول" },
        { status: 403 }
      )
    }

    const tenantId = session.user.tenantId
    if (!tenantId) {
      return NextResponse.json({ message: "لا يوجد سياق مؤسسة" }, { status: 403 })
    }

    const body = await request.json()
    const { phone, address } = body

    await dbConnect()

    const user = await User.findOne({ _id: session.user.id, tenantId }).lean()
    if (!user?.studentId) {
      return NextResponse.json({ message: "حساب الطالب غير موجود" }, { status: 404 })
    }

    // Only allow updating limited fields
    const updates: Record<string, unknown> = {}
    if (phone !== undefined) {
      if (phone && !/^\+216\d{8}$/.test(phone)) {
        return NextResponse.json(
          { message: "رقم الهاتف يجب أن يكون بصيغة +216XXXXXXXX" },
          { status: 400 }
        )
      }
      updates.phone = phone
    }
    if (address !== undefined) {
      updates.address = address
    }

    await Student.findOneAndUpdate({ _id: user.studentId, tenantId }, updates, { runValidators: true })

    return NextResponse.json({ message: "تم تحديث البيانات بنجاح" })
  } catch (error) {
    console.error("Error updating student profile:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء تحديث البيانات" },
      { status: 500 }
    )
  }
}

// POST /api/student/profile - Change password
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session || session.user.role !== ROLES.STUDENT) {
      return NextResponse.json(
        { message: "غير مصرح لك بالوصول" },
        { status: 403 }
      )
    }

    const tenantId = session.user.tenantId
    if (!tenantId) {
      return NextResponse.json({ message: "لا يوجد سياق مؤسسة" }, { status: 403 })
    }

    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { message: "كلمة المرور الحالية والجديدة مطلوبتان" },
        { status: 400 }
      )
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { message: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل" },
        { status: 400 }
      )
    }

    await dbConnect()

    const user = await User.findOne({ _id: session.user.id, tenantId })
    if (!user) {
      return NextResponse.json({ message: "المستخدم غير موجود" }, { status: 404 })
    }

    const isValid = await verifyPassword(currentPassword, user.passwordHash)
    if (!isValid) {
      return NextResponse.json(
        { message: "كلمة المرور الحالية غير صحيحة" },
        { status: 400 }
      )
    }

    user.passwordHash = await hashPassword(newPassword)
    await user.save()

    return NextResponse.json({ message: "تم تغيير كلمة المرور بنجاح" })
  } catch (error) {
    console.error("Error changing password:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء تغيير كلمة المرور" },
      { status: 500 }
    )
  }
}
