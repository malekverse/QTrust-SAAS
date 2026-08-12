import { NextRequest, NextResponse } from "next/server"
import mongoose from "mongoose"
import dbConnect from "@/lib/db"
import User from "@/models/User"
import Student from "@/models/Student"
import SessionTemplate from "@/models/SessionTemplate"
import SessionOccurrence from "@/models/SessionOccurrence"
import Attendance from "@/models/Attendance"
import StudentSession from "@/models/StudentSession"
import AttendanceClaim from "@/models/AttendanceClaim"
import { auth } from "@/lib/auth"
import { ROLES, ATTENDANCE_STATUS, CLAIM_STATUS } from "@/lib/constants"

// Force model registration (needed for populate in serverless)
void User
void Student
void SessionTemplate
void SessionOccurrence
void Attendance
void StudentSession
void AttendanceClaim

// GET /api/dashboard/stats - Get dashboard statistics
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

    await dbConnect()

    const isAdmin = session.user.role === ROLES.ADMIN

    // Get today's date range
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Common stats
    const [
      teacherCount,
      studentCount,
      sessionCount,
    ] = await Promise.all([
      User.countDocuments({ tenantId, role: ROLES.TEACHER, isActive: true }),
      Student.countDocuments({ tenantId, isActive: true }),
      SessionTemplate.countDocuments({ tenantId, isActive: true }),
    ])

    // Get today's attendance
    const todayOccurrences = await SessionOccurrence.find({
      tenantId,
      date: { $gte: today, $lt: tomorrow },
    }).select("_id")

    const occurrenceIds = todayOccurrences.map(o => o._id)

    const todayAttendance = await Attendance.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId) } },
      { $match: { sessionOccurrenceId: { $in: occurrenceIds } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          present: {
            $sum: { $cond: [{ $eq: ["$status", ATTENDANCE_STATUS.PRESENT] }, 1, 0] }
          },
          late: {
            $sum: { $cond: [{ $eq: ["$status", ATTENDANCE_STATUS.LATE] }, 1, 0] }
          },
          absent: {
            $sum: { $cond: [{ $eq: ["$status", ATTENDANCE_STATUS.ABSENT] }, 1, 0] }
          },
        }
      }
    ])

    const todayStats = todayAttendance[0] || { total: 0, present: 0, late: 0, absent: 0 }
    const todayRate = todayStats.total > 0
      ? Math.round(((todayStats.present + todayStats.late) / todayStats.total) * 100)
      : 0

    // Get weekly attendance trend
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    sevenDaysAgo.setHours(0, 0, 0, 0)

    const weeklyTrend = await Attendance.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId) } },
      {
        $lookup: {
          from: "sessionoccurrences",
          localField: "sessionOccurrenceId",
          foreignField: "_id",
          as: "occurrence"
        }
      },
      { $unwind: "$occurrence" },
      {
        $match: {
          "occurrence.date": { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$occurrence.date" } },
          total: { $sum: 1 },
          present: {
            $sum: { $cond: [{ $in: ["$status", [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE]] }, 1, 0] }
          }
        }
      },
      { $sort: { "_id": 1 } }
    ])

    const trendData = weeklyTrend.map((d: any) => ({
      date: d._id,
      rate: d.total > 0 ? Math.round((d.present / d.total) * 100) : 0
    }))

    // Get today's sessions
    const dayOfWeek = today.getDay()
    const todaySessions = await SessionTemplate.find({
      tenantId,
      dayOfWeek,
      isActive: true,
      ...(isAdmin ? {} : { teacherId: session.user.id })
    })
      .populate("teacherId", "fullName")
      .sort({ startTime: 1 })
      .lean()

    // For teacher: get their specific stats
    let teacherStats = null
    if (!isAdmin) {
      const teacherSessions = await SessionTemplate.find({
        tenantId,
        teacherId: session.user.id,
        isActive: true,
      }).select("_id")

      const teacherSessionIds = teacherSessions.map(s => s._id)

      const teacherOccurrences = await SessionOccurrence.find({
        tenantId,
        sessionTemplateId: { $in: teacherSessionIds }
      }).select("_id")

      const teacherOccurrenceIds = teacherOccurrences.map(o => o._id)

      const teacherAttendance = await Attendance.aggregate([
        { $match: { tenantId: new mongoose.Types.ObjectId(tenantId) } },
        { $match: { sessionOccurrenceId: { $in: teacherOccurrenceIds } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            present: {
              $sum: { $cond: [{ $in: ["$status", [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE]] }, 1, 0] }
            }
          }
        }
      ])

      teacherStats = {
        sessionsCount: teacherSessions.length,
        overallRate: teacherAttendance[0]?.total > 0
          ? Math.round((teacherAttendance[0].present / teacherAttendance[0].total) * 100)
          : 0
      }
    }

    // Student portal stats (admin only)
    let portalStats = null
    if (isAdmin) {
      const [portalAccounts, pendingClaims] = await Promise.all([
        Student.countDocuments({ tenantId, hasPortalAccess: true }),
        AttendanceClaim.countDocuments({ tenantId, status: CLAIM_STATUS.PENDING }),
      ])
      portalStats = {
        portalAccounts,
        pendingClaims,
      }
    }

    return NextResponse.json({
      teacherCount,
      studentCount,
      sessionCount,
      todayAttendance: {
        ...todayStats,
        rate: todayRate
      },
      weeklyTrend: trendData,
      todaySessions: todaySessions.map((s: any) => ({
        _id: s._id,
        name: s.name,
        teacherName: s.teacherId?.fullName,
        startTime: s.startTime,
        endTime: s.endTime,
      })),
      teacherStats,
      portalStats,
    })
  } catch (error) {
    console.error("Error fetching dashboard stats:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء جلب البيانات" },
      { status: 500 }
    )
  }
}

