import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import User from "@/models/User"
import Student from "@/models/Student"
import StudentSession from "@/models/StudentSession"
import SessionTemplate from "@/models/SessionTemplate"
import SessionOccurrence from "@/models/SessionOccurrence"
import Attendance from "@/models/Attendance"
import AttendanceClaim from "@/models/AttendanceClaim"
import { auth } from "@/lib/auth"
import { ROLES, ATTENDANCE_STATUS } from "@/lib/constants"

// Force model registration
void Student; void User; void StudentSession; void SessionTemplate; void SessionOccurrence; void Attendance; void AttendanceClaim

// GET /api/student/attendance - Get student's attendance history
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
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const status = searchParams.get("status")

    await dbConnect()

    const user = await User.findById(session.user.id).lean()
    if (!user?.studentId) {
      return NextResponse.json({ message: "حساب الطالب غير موجود" }, { status: 404 })
    }

    const studentId = user.studentId

    // Get student's session template IDs
    const studentSessions = await StudentSession.find({ studentId, isActive: true }).lean()
    const sessionTemplateIds = studentSessions.map(ss => ss.sessionTemplateId)

    // Get all occurrences for these sessions
    const occurrences = await SessionOccurrence.find({
      sessionTemplateId: { $in: sessionTemplateIds },
      status: { $ne: 'CANCELLED' }
    })
      .populate({
        path: 'sessionTemplateId',
        select: 'name dayOfWeek startTime endTime',
        populate: { path: 'teacherId', select: 'fullName' }
      })
      .sort({ date: -1 })
      .lean()

    // Get attendance records
    const occurrenceIds = occurrences.map(o => o._id)
    
    let attendanceQuery: Record<string, unknown> = {
      studentId,
      sessionOccurrenceId: { $in: occurrenceIds }
    }
    
    const attendanceRecords = await Attendance.find({
      studentId,
      sessionOccurrenceId: { $in: occurrenceIds }
    }).lean()

    // Get existing claims
    const claims = await AttendanceClaim.find({
      studentId,
      sessionOccurrenceId: { $in: occurrenceIds }
    }).lean()

    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

    // Build attendance history
    let history = occurrences.map(occ => {
      const att = attendanceRecords.find(
        a => a.sessionOccurrenceId.toString() === occ._id.toString()
      )
      const claim = claims.find(
        c => c.sessionOccurrenceId.toString() === occ._id.toString()
      )
      const template = occ.sessionTemplateId as any

      return {
        _id: occ._id,
        date: occ.date,
        sessionName: template?.name || '',
        teacher: template?.teacherId?.fullName || '',
        dayOfWeek: template?.dayOfWeek,
        dayName: template?.dayOfWeek !== undefined ? days[template.dayOfWeek] : '',
        startTime: template?.startTime || '',
        endTime: template?.endTime || '',
        status: att?.status || ATTENDANCE_STATUS.ABSENT,
        checkInTime: att?.checkInTime || null,
        attendanceId: att?._id || null,
        notes: att?.notes || null,
        hasClaim: !!claim,
        claimStatus: claim?.status || null,
        claimId: claim?._id || null
      }
    })

    // Filter by status if requested
    if (status && status !== 'all') {
      history = history.filter(h => h.status === status)
    }

    // Paginate
    const total = history.length
    const paginatedHistory = history.slice((page - 1) * limit, page * limit)

    // Stats
    const totalRecords = occurrences.length
    const presentRecords = attendanceRecords.filter(
      a => a.status === ATTENDANCE_STATUS.PRESENT
    ).length
    const lateRecords = attendanceRecords.filter(
      a => a.status === ATTENDANCE_STATUS.LATE
    ).length
    const absentRecords = totalRecords - attendanceRecords.length + 
      attendanceRecords.filter(a => a.status === ATTENDANCE_STATUS.ABSENT).length
    const justifiedRecords = attendanceRecords.filter(
      a => a.status === ATTENDANCE_STATUS.JUSTIFIED_ABSENCE
    ).length

    return NextResponse.json({
      records: paginatedHistory,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      stats: {
        total: totalRecords,
        present: presentRecords,
        late: lateRecords,
        absent: absentRecords,
        justified: justifiedRecords,
        rate: totalRecords > 0 ? Math.round(((presentRecords + lateRecords) / totalRecords) * 100) : 0
      }
    })
  } catch (error) {
    console.error("Error fetching student attendance:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء جلب البيانات" },
      { status: 500 }
    )
  }
}
