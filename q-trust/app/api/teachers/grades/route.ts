import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import Grade from "@/models/Grade"
import Student from "@/models/Student"
import StudentSession from "@/models/StudentSession"
import SessionTemplate from "@/models/SessionTemplate"
import User from "@/models/User"
import { auth } from "@/lib/auth"
import { ROLES, GRADE_TYPE } from "@/lib/constants"

// Force model registration
void Grade; void Student; void StudentSession; void SessionTemplate; void User

// GET /api/teachers/grades - Get grades for teacher's students
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

    const grades = await Grade.find(query)
      .populate("studentId", "firstName lastName fullName")
      .populate("teacherId", "fullName")
      .populate("sessionTemplateId", "name")
      .sort({ date: -1 })
      .limit(100)
      .lean()

    return NextResponse.json(grades)
  } catch (error) {
    console.error("Error fetching grades:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء جلب البيانات" },
      { status: 500 }
    )
  }
}

// POST /api/teachers/grades - Add a grade for a student
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
    const { studentId, sessionTemplateId, type, title, score, maxScore, date, notes, surah, fromVerse, toVerse, juz } = body

    if (!studentId || !type || !title || score === undefined || !maxScore || !date) {
      return NextResponse.json(
        { message: "الطالب والنوع والعنوان والدرجة والتاريخ مطلوبة" },
        { status: 400 }
      )
    }

    if (!Object.values(GRADE_TYPE).includes(type)) {
      return NextResponse.json(
        { message: "نوع التقييم غير صالح" },
        { status: 400 }
      )
    }

    if (score < 0 || score > maxScore) {
      return NextResponse.json(
        { message: "الدرجة يجب أن تكون بين 0 والدرجة القصوى" },
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

    const grade = await Grade.create({
      studentId,
      sessionTemplateId: sessionTemplateId || undefined,
      teacherId: session.user.id,
      type,
      title,
      score,
      maxScore,
      date: new Date(date),
      notes: notes || undefined,
      surah: surah || undefined,
      fromVerse: fromVerse || undefined,
      toVerse: toVerse || undefined,
      juz: juz || undefined
    })

    return NextResponse.json(grade, { status: 201 })
  } catch (error) {
    console.error("Error creating grade:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء إضافة التقييم" },
      { status: 500 }
    )
  }
}
