import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import TeacherFeedback from "@/models/TeacherFeedback"
import Student from "@/models/Student"
import User from "@/models/User"
import { auth } from "@/lib/auth"
import { ROLES } from "@/lib/constants"

// Force model registration
void TeacherFeedback; void Student; void User

// GET /api/teachers/feedback - Get feedback for teacher's students
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session || (session.user.role !== ROLES.TEACHER && session.user.role !== ROLES.ADMIN)) {
      return NextResponse.json(
        { message: "غير مصرح لك بالوصول" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")

    await dbConnect()

    let query: Record<string, unknown> = {}
    if (session.user.role === ROLES.TEACHER) {
      query.teacherId = session.user.id
    }
    if (studentId) {
      query.studentId = studentId
    }

    const feedback = await TeacherFeedback.find(query)
      .populate("studentId", "firstName lastName fullName")
      .populate("teacherId", "fullName")
      .sort({ date: -1 })
      .limit(50)
      .lean()

    return NextResponse.json(feedback)
  } catch (error) {
    console.error("Error fetching feedback:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء جلب البيانات" },
      { status: 500 }
    )
  }
}

// POST /api/teachers/feedback - Add feedback for a student
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session || (session.user.role !== ROLES.TEACHER && session.user.role !== ROLES.ADMIN)) {
      return NextResponse.json(
        { message: "غير مصرح لك بالوصول" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { studentId, sessionOccurrenceId, content, isPositive } = body

    if (!studentId || !content) {
      return NextResponse.json(
        { message: "الطالب ومحتوى الملاحظة مطلوبان" },
        { status: 400 }
      )
    }

    if (content.length > 1000) {
      return NextResponse.json(
        { message: "الملاحظة يجب أن لا تتجاوز 1000 حرف" },
        { status: 400 }
      )
    }

    await dbConnect()

    // Verify student exists
    const student = await Student.findById(studentId)
    if (!student) {
      return NextResponse.json(
        { message: "الطالب غير موجود" },
        { status: 404 }
      )
    }

    const feedback = await TeacherFeedback.create({
      studentId,
      teacherId: session.user.id,
      sessionOccurrenceId: sessionOccurrenceId || undefined,
      content,
      isPositive: isPositive !== false,
      date: new Date()
    })

    return NextResponse.json(feedback, { status: 201 })
  } catch (error) {
    console.error("Error creating feedback:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء إضافة الملاحظة" },
      { status: 500 }
    )
  }
}
