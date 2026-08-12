import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import User from "@/models/User"
import Student from "@/models/Student"
import StudentSession from "@/models/StudentSession"
import LearningDocument from "@/models/LearningDocument"
import { auth } from "@/lib/auth"
import { ROLES } from "@/lib/constants"

// Force model registration
void Student; void User; void StudentSession; void LearningDocument

// GET /api/student/documents - Get available documents for student
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session || session.user.role !== ROLES.STUDENT) {
      return NextResponse.json(
        { message: "غير مصرح لك بالوصول" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")

    await dbConnect()

    const user = await User.findById(session.user.id).lean()
    if (!user?.studentId) {
      return NextResponse.json({ message: "حساب الطالب غير موجود" }, { status: 404 })
    }

    const studentId = user.studentId

    // Get student's session template IDs
    const studentSessions = await StudentSession.find({ studentId, isActive: true }).lean()
    const sessionTemplateIds = studentSessions.map(ss => ss.sessionTemplateId)

    // Build query - documents that are:
    // 1. Public, OR
    // 2. Targeted to this specific student, OR
    // 3. Targeted to one of the student's sessions
    const query: Record<string, unknown> = {
      $or: [
        { isPublic: true },
        { targetStudents: studentId },
        { targetSessions: { $in: sessionTemplateIds } }
      ]
    }

    if (category && category !== 'all') {
      query.category = category
    }

    const documents = await LearningDocument.find(query)
      .populate("uploadedBy", "fullName")
      .sort({ createdAt: -1 })
      .lean()

    // Get categories with counts
    const allDocs = await LearningDocument.find({
      $or: [
        { isPublic: true },
        { targetStudents: studentId },
        { targetSessions: { $in: sessionTemplateIds } }
      ]
    }).lean()

    const categoryCounts: Record<string, number> = {}
    allDocs.forEach(doc => {
      categoryCounts[doc.category] = (categoryCounts[doc.category] || 0) + 1
    })

    return NextResponse.json({
      documents: documents.map(doc => ({
        _id: doc._id,
        title: doc.title,
        description: doc.description,
        category: doc.category,
        fileUrl: doc.fileUrl,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
        thumbnailUrl: doc.thumbnailUrl,
        uploadedBy: (doc.uploadedBy as any)?.fullName || '',
        downloadCount: doc.downloadCount,
        createdAt: doc.createdAt
      })),
      categoryCounts,
      total: documents.length
    })
  } catch (error) {
    console.error("Error fetching student documents:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء جلب البيانات" },
      { status: 500 }
    )
  }
}

// POST /api/student/documents - Track document download
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session || session.user.role !== ROLES.STUDENT) {
      return NextResponse.json(
        { message: "غير مصرح لك بالوصول" },
        { status: 403 }
      )
    }

    const { documentId } = await request.json()

    if (!documentId) {
      return NextResponse.json(
        { message: "معرّف المستند مطلوب" },
        { status: 400 }
      )
    }

    await dbConnect()

    await LearningDocument.findByIdAndUpdate(documentId, {
      $inc: { downloadCount: 1 }
    })

    return NextResponse.json({ message: "تم تسجيل التحميل" })
  } catch (error) {
    console.error("Error tracking download:", error)
    return NextResponse.json(
      { message: "حدث خطأ" },
      { status: 500 }
    )
  }
}
