import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import User from "@/models/User"
import AttendanceClaim from "@/models/AttendanceClaim"
import SessionOccurrence from "@/models/SessionOccurrence"
import { auth } from "@/lib/auth"
import { ROLES, CLAIM_STATUS, NOTIFICATION_TYPE } from "@/lib/constants"
import { notifyTenantAdmins } from "@/models/Notification"

// Force model registration
void User; void AttendanceClaim; void SessionOccurrence

// POST /api/student/attendance/claim - Submit attendance claim
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session || session.user.role !== ROLES.STUDENT) {
      return NextResponse.json(
        { message: "غير مصرح لك بالوصول" },
        { status: 403 }
      )
    }

    const tenantId = session.user.tenantId
    if (!tenantId) {
      return NextResponse.json({ message: "لا يوجد سياق مؤسسة" }, { status: 403 })
    }

    const { sessionOccurrenceId, reason } = await request.json()

    if (!sessionOccurrenceId || !reason) {
      return NextResponse.json(
        { message: "الحصة وسبب الاعتراض مطلوبان" },
        { status: 400 }
      )
    }

    if (reason.length > 500) {
      return NextResponse.json(
        { message: "السبب يجب أن لا يتجاوز 500 حرف" },
        { status: 400 }
      )
    }

    await dbConnect()

    const user = await User.findOne({ _id: session.user.id, tenantId }).lean()
    if (!user?.studentId) {
      return NextResponse.json({ message: "حساب الطالب غير موجود" }, { status: 404 })
    }

    // Check occurrence exists
    const occurrence = await SessionOccurrence.findOne({ _id: sessionOccurrenceId, tenantId }).lean()
    if (!occurrence) {
      return NextResponse.json(
        { message: "الحصة غير موجودة" },
        { status: 404 }
      )
    }

    // Check if claim already exists
    const existingClaim = await AttendanceClaim.findOne({
      tenantId,
      studentId: user.studentId,
      sessionOccurrenceId
    })
    if (existingClaim) {
      return NextResponse.json(
        { message: "لقد قدمت اعتراضاً لهذه الحصة بالفعل" },
        { status: 400 }
      )
    }

    // Create claim
    const claim = await AttendanceClaim.create({
      tenantId,
      studentId: user.studentId,
      sessionOccurrenceId,
      date: occurrence.date,
      reason,
      status: CLAIM_STATUS.PENDING
    })

    // Notify tenant admins there's a claim awaiting review.
    await notifyTenantAdmins(tenantId, {
      type: NOTIFICATION_TYPE.CLAIM_SUBMITTED,
      title: 'اعتراض جديد على الحضور',
      body: `${session.user.fullName || 'طالب'} قدّم اعتراضاً على الحضور`,
      link: '/admin/claims',
    })

    return NextResponse.json({
      message: "تم تقديم الاعتراض بنجاح. سيتم مراجعته من قبل الإدارة.",
      claim: {
        _id: claim._id,
        status: claim.status
      }
    }, { status: 201 })
  } catch (error) {
    console.error("Error submitting claim:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء تقديم الاعتراض" },
      { status: 500 }
    )
  }
}

// GET /api/student/attendance/claim - Get student's claims
export async function GET() {
  try {
    const session = await auth()
    
    if (!session || session.user.role !== ROLES.STUDENT) {
      return NextResponse.json(
        { message: "غير مصرح لك بالوصول" },
        { status: 403 }
      )
    }

    const tenantId = session.user.tenantId
    if (!tenantId) {
      return NextResponse.json({ message: "لا يوجد سياق مؤسسة" }, { status: 403 })
    }

    await dbConnect()

    const user = await User.findOne({ _id: session.user.id, tenantId }).lean()
    if (!user?.studentId) {
      return NextResponse.json({ message: "حساب الطالب غير موجود" }, { status: 404 })
    }

    const claims = await AttendanceClaim.find({ tenantId, studentId: user.studentId })
      .populate({
        path: 'sessionOccurrenceId',
        select: 'date',
        populate: { path: 'sessionTemplateId', select: 'name' }
      })
      .populate('reviewedBy', 'fullName')
      .sort({ createdAt: -1 })
      .lean()

    return NextResponse.json(claims)
  } catch (error) {
    console.error("Error fetching claims:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء جلب البيانات" },
      { status: 500 }
    )
  }
}
