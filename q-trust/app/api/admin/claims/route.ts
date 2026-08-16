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
import { parsePagination, buildPaginatedResponse } from "@/lib/pagination"

// Force model registration
void AttendanceClaim; void Attendance; void Student; void User; void SessionOccurrence; void SessionTemplate

// GET /api/admin/claims?page=&limit=&status= - Get attendance claims (paginated)
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
    const pg = parsePagination(request, { limit: 25 })

    await dbConnect()

    const filter: Record<string, unknown> = { tenantId }
    if (status && status !== 'all') {
      filter.status = status
    }

    const [claims, total, pendingClaims, approvedClaims, rejectedClaims] = await Promise.all([
      AttendanceClaim.find(filter)
        .populate("studentId", "firstName lastName fullName")
        .populate({
          path: "sessionOccurrenceId",
          select: "date",
          populate: { path: "sessionTemplateId", select: "name" }
        })
        .populate("reviewedBy", "fullName")
        .sort({ createdAt: -1 })
        .skip(pg.skip)
        .limit(pg.limit)
        .lean(),
      AttendanceClaim.countDocuments(filter),
      AttendanceClaim.countDocuments({ tenantId, status: CLAIM_STATUS.PENDING }),
      AttendanceClaim.countDocuments({ tenantId, status: CLAIM_STATUS.APPROVED }),
      AttendanceClaim.countDocuments({ tenantId, status: CLAIM_STATUS.REJECTED }),
    ])

    const data = claims.map(c => {
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
    })

    return NextResponse.json({
      ...buildPaginatedResponse(data, total, pg),
      stats: {
        total: pendingClaims + approvedClaims + rejectedClaims,
        pending: pendingClaims,
        approved: approvedClaims,
        rejected: rejectedClaims,
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
