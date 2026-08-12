import { NextRequest, NextResponse } from "next/server"
import mongoose from "mongoose"
import dbConnect from "@/lib/db"
import MonthlyPayment from "@/models/MonthlyPayment"
import Student from "@/models/Student"
import { auth } from "@/lib/auth"
import { ROLES } from "@/lib/constants"

void Student
void MonthlyPayment

// POST /api/payments/bulk — mark multiple students as paid/unpaid
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || session.user.role !== ROLES.ADMIN) {
      return NextResponse.json({ message: "غير مصرح لك بالوصول" }, { status: 403 })
    }

    const body = await request.json()
    const { studentIds, month, year, isPaid, amount, notes } = body

    if (!studentIds?.length || !month || !year) {
      return NextResponse.json({ message: "بيانات ناقصة" }, { status: 400 })
    }

    await dbConnect()

    const bulkOps = studentIds.map((studentId: string) => ({
      updateOne: {
        filter: { studentId: new mongoose.Types.ObjectId(studentId), month, year },
        update: {
          $set: {
            isPaid,
            paidAt: isPaid ? new Date() : undefined,
            markedByUserId: new mongoose.Types.ObjectId(session.user.id),
            amount: amount || undefined,
            notes: notes || undefined,
          },
        },
        upsert: true,
      },
    }))

    await MonthlyPayment.bulkWrite(bulkOps)

    return NextResponse.json({
      message: `تم تحديث حالة الدفع لـ ${studentIds.length} طالب`,
      count: studentIds.length,
    })
  } catch (error) {
    console.error("Error bulk updating payments:", error)
    return NextResponse.json({ message: "حدث خطأ أثناء تحديث الدفعات" }, { status: 500 })
  }
}
