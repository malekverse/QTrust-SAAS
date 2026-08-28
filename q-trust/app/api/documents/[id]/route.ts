import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import LearningDocument from "@/models/LearningDocument"
import { auth } from "@/lib/auth"
import { ROLES } from "@/lib/constants"
import { invalidObjectId } from "@/lib/object-id"

// DELETE /api/documents/[id] - Delete a document
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

    if (!id) {
      return NextResponse.json(
        { message: "معرف المستند مطلوب" },
        { status: 400 }
      )
    }

    const bad = invalidObjectId(id)
    if (bad) return bad

    await dbConnect()

    const document = await LearningDocument.findOneAndDelete({ _id: id, tenantId })

    if (!document) {
      return NextResponse.json(
        { message: "المستند غير موجود" },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: "تم حذف المستند بنجاح" })
  } catch (error) {
    console.error("Error deleting document:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء حذف المستند" },
      { status: 500 }
    )
  }
}
