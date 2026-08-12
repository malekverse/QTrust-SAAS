import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import MonthlyPayment from "@/models/MonthlyPayment"
import { auth } from "@/lib/auth"
import { ROLES } from "@/lib/constants"

void MonthlyPayment

// GET /api/payments/status?studentIds=id1,id2&month=X&year=Y
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
    const studentIdsParam = searchParams.get("studentIds")
    const now = new Date()
    const month = parseInt(searchParams.get("month") || String(now.getMonth() + 1))
    const year = parseInt(searchParams.get("year") || String(now.getFullYear()))

    if (!studentIdsParam) {
      return NextResponse.json({ message: "معرفات الطلاب مطلوبة" }, { status: 400 })
    }

    const studentIds = studentIdsParam.split(",")

    await dbConnect()

    const payments = await MonthlyPayment.find({
      studentId: { $in: studentIds },
      month,
      year,
      isPaid: true,
      tenantId,
    }).lean()

    const paidStudentIds = new Set(
      payments.map((p: any) => p.studentId.toString())
    )

    const statusMap: Record<string, boolean> = {}
    studentIds.forEach((id) => {
      statusMap[id] = paidStudentIds.has(id)
    })

    return NextResponse.json(statusMap)
  } catch (error) {
    console.error("Error fetching payment status:", error)
    return NextResponse.json({ message: "حدث خطأ أثناء جلب البيانات" }, { status: 500 })
  }
}
