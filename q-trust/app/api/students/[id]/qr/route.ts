import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import Student from "@/models/Student"
import { auth } from "@/lib/auth"
import { ROLES } from "@/lib/constants"
import QRCode from "qrcode"

// GET /api/students/[id]/qr - Get student QR code
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    
    if (!session || (session.user.role !== ROLES.ADMIN && session.user.role !== ROLES.TEACHER)) {
      return NextResponse.json(
        { message: "غير مصرح لك بالوصول" },
        { status: 403 }
      )
    }

    const tenantId = session.user.tenantId
    if (!tenantId) {
      return NextResponse.json({ message: "لا يوجد سياق مؤسسة" }, { status: 403 })
    }

    const { id } = await params

    await dbConnect()

    const student = await Student.findOne({ _id: id, tenantId }).lean()

    if (!student) {
      return NextResponse.json(
        { message: "الطالب غير موجود" },
        { status: 404 }
      )
    }

    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(student.qrUuid, {
      width: 400,
      margin: 2,
      color: {
        dark: "#136F4E",
        light: "#FFFFFF"
      },
      errorCorrectionLevel: "H"
    })

    return NextResponse.json({
      _id: student._id,
      fullName: student.fullName,
      parentName: student.parentName,
      qrUuid: student.qrUuid,
      qrDataUrl,
    })
  } catch (error) {
    console.error("Error fetching student QR:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء جلب البيانات" },
      { status: 500 }
    )
  }
}

