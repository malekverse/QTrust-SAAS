import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import AttendanceClaim from "@/models/AttendanceClaim"
import Attendance from "@/models/Attendance"
import Student from "@/models/Student"
import User from "@/models/User"
import SessionOccurrence from "@/models/SessionOccurrence"
import SessionTemplate from "@/models/SessionTemplate"
import { auth } from "@/lib/auth"
import { ROLES, CLAIM_STATUS, ATTENDANCE_STATUS } from "@/lib/constants"

// Force model registration
void AttendanceClaim; void Attendance; void Student; void User; void SessionOccurrence; void SessionTemplate

// GET /api/admin/claims - Get all attendance claims
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")

    await dbConnect()

    let query: Record<string, unknown> = { tenantId }
    if (status && status !== 'all') {
      query.status = status
    }

    const claims = await AttendanceClaim.find(query)
      .populate("studentId", "firstName lastName fullName")
      .populate({
        path: "sessionOccurrenceId",
        select: "date",
        populate: { path: "sessionTemplateId", select: "name" }
      })
      .populate("reviewedBy", "fullName")
      .sort({ createdAt: -1 })
      .lean()

    // Stats
    const allClaims = await AttendanceClaim.countDocuments({ tenantId })
    const pendingClaims = await AttendanceClaim.countDocuments({ tenantId, status: CLAIM_STATUS.PENDING })
    const approvedClaims = await AttendanceClaim.countDocuments({ tenantId, status: CLAIM_STATUS.APPROVED })
    const rejectedClaims = await AttendanceClaim.countDocuments({ tenantId, status: CLAIM_STATUS.REJECTED })

    return NextResponse.json({
      claims: claims.map(c => {
        const student = c.studentId as any
        const occurrence = c.sessionOccurrenceId as any
        return {
          _id: c._id,
          studentName: student?.firstName && student?.lastName 
            ? `${student.firstName} ${student.lastName}` 
            : student?.fullName || '',
          studentId: student?._id,
          sessionName: occurrence?.sessionTemplateId?.name || '',
          date: c.date,
          reason: c.reason,
          status: c.status,
          reviewedBy: (c.reviewedBy as any)?.fullName || null,
          reviewNotes: c.reviewNotes || null,
          reviewedAt: c.reviewedAt || null,
          createdAt: c.createdAt
        }
      }),
      stats: {
        total: allClaims,
        pending: pendingClaims,
        approved: approvedClaims,
        rejected: rejectedClaims
      }
    })
  } catch (error) {
    console.error("Error fetching claims:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء جلب البيانات" },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/claims - Review a claim (approve/reject)
export async function PATCH(request: NextRequest) {
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

    const { claimId, status, reviewNotes } = await request.json()

    if (!claimId || !status) {
      return NextResponse.json(
        { message: "معرّف الاعتراض والحالة مطلوبان" },
        { status: 400 }
      )
    }

    if (status !== CLAIM_STATUS.APPROVED && status !== CLAIM_STATUS.REJECTED) {
      return NextResponse.json(
        { message: "حالة غير صالحة" },
        { status: 400 }
      )
    }

    await dbConnect()

    const claim = await AttendanceClaim.findOne({ _id: claimId, tenantId })
    if (!claim) {
      return NextResponse.json(
        { message: "الاعتراض غير موجود" },
        { status: 404 }
      )
    }

    if (claim.status !== CLAIM_STATUS.PENDING) {
      return NextResponse.json(
        { message: "تمت مراجعة هذا الاعتراض بالفعل" },
        { status: 400 }
      )
    }

    // Update claim
    claim.status = status
    claim.reviewedBy = session.user.id as any
    claim.reviewNotes = reviewNotes || undefined
    claim.reviewedAt = new Date()
    await claim.save()

    // If approved, update attendance to JUSTIFIED_ABSENCE
    if (status === CLAIM_STATUS.APPROVED) {
      await Attendance.findOneAndUpdate(
        {
          studentId: claim.studentId,
          sessionOccurrenceId: claim.sessionOccurrenceId,
          tenantId
        },
        {
          $set: {
            status: ATTENDANCE_STATUS.JUSTIFIED_ABSENCE,
            notes: `اعتراض مقبول: ${claim.reason}`,
            lastModifiedByUserId: session.user.id,
            lastModifiedAt: new Date()
          }
        },
        { upsert: true }
      )
    }

    return NextResponse.json({
      message: status === CLAIM_STATUS.APPROVED ? "تمت الموافقة على الاعتراض" : "تم رفض الاعتراض",
      claim: {
        _id: claim._id,
        status: claim.status
      }
    })
  } catch (error) {
    console.error("Error reviewing claim:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء مراجعة الاعتراض" },
      { status: 500 }
    )
  }
}
