import { NextRequest, NextResponse } from "next/server"
import mongoose from "mongoose"
import dbConnect from "@/lib/db"
import MonthlyPayment from "@/models/MonthlyPayment"
import Student from "@/models/Student"
import { auth } from "@/lib/auth"
import { ROLES } from "@/lib/constants"

void Student
void MonthlyPayment

// GET /api/payments?month=X&year=Y
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || session.user.role !== ROLES.ADMIN) {
      return NextResponse.json({ message: "غير مصرح لك بالوصول" }, { status: 403 })
    }

    const tenantId = session.user.tenantId
    if (!tenantId) {
      return NextResponse.json({ message: "لا يوجد سياق مؤسسة" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const now = new Date()
    const month = parseInt(searchParams.get("month") || String(now.getMonth() + 1))
    const year = parseInt(searchParams.get("year") || String(now.getFullYear()))

    await dbConnect()

    const activeStudents = await Student.find({ isActive: true, tenantId })
      .select("firstName lastName fullName phone enrollmentNumber")
      .sort({ firstName: 1, lastName: 1 })
      .lean()

    const payments = await MonthlyPayment.find({ month, year, tenantId })
      .populate("markedByUserId", "fullName")
      .lean()

    const paymentMap = new Map(
      payments.map((p) => [p.studentId.toString(), p])
    )

    const studentsWithPayment = activeStudents.map((student) => {
      const payment = paymentMap.get(student._id.toString())
      return {
        _id: student._id,
        firstName: student.firstName,
        lastName: student.lastName,
        fullName: student.fullName,
        displayName: student.firstName && student.lastName
          ? `${student.firstName} ${student.lastName}`
          : student.fullName || "",
        phone: student.phone,
        enrollmentNumber: student.enrollmentNumber,
        isPaid: payment?.isPaid || false,
        paidAt: payment?.paidAt,
        amount: payment?.amount,
        notes: payment?.notes,
        receiptPhotoUrl: payment?.receiptPhotoUrl,
        markedBy: payment?.markedByUserId,
        paymentId: payment?._id,
      }
    })

    const paidCount = studentsWithPayment.filter(s => s.isPaid).length
    const unpaidCount = studentsWithPayment.length - paidCount

    return NextResponse.json({
      students: studentsWithPayment,
      stats: {
        total: studentsWithPayment.length,
        paid: paidCount,
        unpaid: unpaidCount,
        rate: studentsWithPayment.length > 0
          ? Math.round((paidCount / studentsWithPayment.length) * 100)
          : 0,
      },
      period: { month, year },
    })
  } catch (error) {
    console.error("Error fetching payments:", error)
    return NextResponse.json({ message: "حدث خطأ أثناء جلب البيانات" }, { status: 500 })
  }
}

// POST /api/payments — mark a student as paid/unpaid
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || (session.user.role !== ROLES.ADMIN)) {
      return NextResponse.json({ message: "غير مصرح لك بالوصول" }, { status: 403 })
    }

    const tenantId = session.user.tenantId
    if (!tenantId) {
      return NextResponse.json({ message: "لا يوجد سياق مؤسسة" }, { status: 403 })
    }

    const body = await request.json()
    const { studentId, month, year, isPaid, amount, notes, receiptPhotoUrl } = body

    if (!studentId || !month || !year) {
      return NextResponse.json({ message: "بيانات ناقصة" }, { status: 400 })
    }

    await dbConnect()

    const student = await Student.findOne({ _id: studentId, tenantId })
    if (!student) {
      return NextResponse.json({ message: "الطالب غير موجود" }, { status: 404 })
    }

    const payment = await MonthlyPayment.findOneAndUpdate(
      { studentId, month, year, tenantId },
      {
        isPaid,
        paidAt: isPaid ? new Date() : undefined,
        markedByUserId: new mongoose.Types.ObjectId(session.user.id),
        amount: amount || undefined,
        notes: notes || undefined,
        // Only images/PDFs from our own upload endpoint (Cloudinary) are stored.
        receiptPhotoUrl: isPaid ? receiptPhotoUrl || undefined : undefined,
      },
      { upsert: true, new: true, runValidators: true }
    )

    return NextResponse.json(payment)
  } catch (error) {
    console.error("Error updating payment:", error)
    return NextResponse.json({ message: "حدث خطأ أثناء تحديث الدفع" }, { status: 500 })
  }
}
