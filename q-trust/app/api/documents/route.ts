import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import LearningDocument from "@/models/LearningDocument"
import { auth } from "@/lib/auth"
import { ROLES } from "@/lib/constants"
import { parsePagination, buildPaginatedResponse } from "@/lib/pagination"

// Force model registration
void LearningDocument

// GET /api/documents?page=&limit=&category= - List documents (paginated)
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const pg = parsePagination(request, { limit: 25 })

    await dbConnect()

    const filter: Record<string, unknown> = { tenantId }
    if (category && category !== "all") {
      filter.category = category
    }

    const [documents, total] = await Promise.all([
      LearningDocument.find(filter)
        .populate("uploadedBy", "fullName")
        .sort({ createdAt: -1 })
        .skip(pg.skip)
        .limit(pg.limit)
        .lean(),
      LearningDocument.countDocuments(filter),
    ])

    return NextResponse.json(buildPaginatedResponse(documents, total, pg))
  } catch (error) {
    console.error("Error fetching documents:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء جلب البيانات" },
      { status: 500 }
    )
  }
}

// POST /api/documents - Create a document (admin/teacher)
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { title, description, category, fileUrl, fileType, fileSize, thumbnailUrl, isPublic, targetStudents, targetSessions } = body

    if (!title || !category || !fileUrl || !fileType) {
      return NextResponse.json(
        { message: "العنوان والتصنيف ورابط الملف ونوعه مطلوبة" },
        { status: 400 }
      )
    }

    await dbConnect()

    const document = await LearningDocument.create({
      tenantId,
      title,
      description,
      category,
      fileUrl,
      fileType,
      fileSize,
      thumbnailUrl,
      uploadedBy: session.user.id,
      isPublic: isPublic !== false,
      targetStudents: targetStudents || [],
      targetSessions: targetSessions || []
    })

    return NextResponse.json(document, { status: 201 })
  } catch (error) {
    console.error("Error creating document:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء إنشاء المستند" },
      { status: 500 }
    )
  }
}
