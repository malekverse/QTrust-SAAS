import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import Student from "@/models/Student"
import StudentSession from "@/models/StudentSession"
import Attendance from "@/models/Attendance"
import SessionTemplate from "@/models/SessionTemplate"
import SessionOccurrence from "@/models/SessionOccurrence"
import { auth } from "@/lib/auth"
import { updateStudentSchema } from "@/lib/validations"
import { ROLES } from "@/lib/constants"
import { invalidObjectId } from "@/lib/object-id"

// Force model registration (needed for populate in serverless)
void Student
void StudentSession
void Attendance
void SessionTemplate
void SessionOccurrence

// GET /api/students/[id] - Get a single student
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
    const bad = invalidObjectId(id)
    if (bad) return bad

    await dbConnect()

    const student = await Student.findOne({ _id: id, tenantId }).lean()

    if (!student) {
      return NextResponse.json(
        { message: "الطالب غير موجود" },
        { status: 404 }
      )
    }

    // Add displayName for consistency
    const transformedStudent = {
      ...student,
      displayName: student.firstName && student.lastName 
        ? `${student.firstName} ${student.lastName}`
        : student.fullName || '',
    }

    return NextResponse.json(transformedStudent)
  } catch (error) {
    console.error("Error fetching student:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء جلب البيانات" },
      { status: 500 }
    )
  }
}

// PATCH /api/students/[id] - Update a student
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    
    if (!session || session.user.role !== ROLES.ADMIN) {
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
    const bad = invalidObjectId(id)
    if (bad) return bad
    const body = await request.json()

    // Validate input
    const validationResult = updateStudentSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { message: validationResult.error.issues[0].message },
        { status: 400 }
      )
    }

    await dbConnect()

    // Prepare update data
    const updateData: Record<string, unknown> = { ...validationResult.data }
    
    // Update fullName if firstName or lastName changed
    if (updateData.firstName || updateData.lastName) {
      const existingStudent = await Student.findOne({ _id: id, tenantId }).lean()
      if (existingStudent) {
        const firstName = updateData.firstName || existingStudent.firstName
        const lastName = updateData.lastName || existingStudent.lastName
        if (firstName && lastName) {
          updateData.fullName = `${firstName} ${lastName}`
        }
      }
    }
    
    // Sync fatherName to parentName for backward compatibility
    if (updateData.fatherName !== undefined) {
      updateData.parentName = updateData.fatherName
    }

    const student = await Student.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: updateData },
      { new: true, runValidators: true }
    )

    if (!student) {
      return NextResponse.json(
        { message: "الطالب غير موجود" },
        { status: 404 }
      )
    }

    return NextResponse.json(student)
  } catch (error: any) {
    console.error("Error updating student:", error)
    
    // Handle duplicate CIN error
    if (error.code === 11000 && error.keyPattern?.cin) {
      return NextResponse.json(
        { message: "رقم بطاقة التعريف مستخدم مسبقاً" },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { message: "حدث خطأ أثناء تحديث البيانات" },
      { status: 500 }
    )
  }
}

// DELETE /api/students/[id] - Delete a student
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    
    if (!session || session.user.role !== ROLES.ADMIN) {
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
    const bad = invalidObjectId(id)
    if (bad) return bad

    await dbConnect()

    // Delete student
    const student = await Student.findOneAndDelete({ _id: id, tenantId })

    if (!student) {
      return NextResponse.json(
        { message: "الطالب غير موجود" },
        { status: 404 }
      )
    }

    // Also delete related records
    await Promise.all([
      StudentSession.deleteMany({ tenantId, studentId: id }),
      Attendance.deleteMany({ tenantId, studentId: id }),
    ])

    return NextResponse.json({ message: "تم حذف الطالب بنجاح" })
  } catch (error) {
    console.error("Error deleting student:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء حذف البيانات" },
      { status: 500 }
    )
  }
}
