import { NextRequest, NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import Attendance from "@/models/Attendance"
import SessionOccurrence from "@/models/SessionOccurrence"
import SessionTemplate from "@/models/SessionTemplate"
import Student from "@/models/Student"
import User from "@/models/User"
import { auth } from "@/lib/auth"
import { ATTENDANCE_STATUS, DAYS_OF_WEEK, ROLES } from "@/lib/constants"

// Force model registration (needed for populate in serverless)
void SessionTemplate
void Student
void User

// Helper function to get comprehensive attendance stats
async function getAttendanceStats() {
  // Get overall stats
  const overallStats = await Attendance.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        present: { $sum: { $cond: [{ $eq: ["$status", ATTENDANCE_STATUS.PRESENT] }, 1, 0] } },
        late: { $sum: { $cond: [{ $eq: ["$status", ATTENDANCE_STATUS.LATE] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ["$status", ATTENDANCE_STATUS.ABSENT] }, 1, 0] } },
        justifiedAbsence: { $sum: { $cond: [{ $eq: ["$status", ATTENDANCE_STATUS.JUSTIFIED_ABSENCE] }, 1, 0] } }
      }
    }
  ])

  // Get stats by day of week
  const byDayStats = await Attendance.aggregate([
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
      $group: {
        _id: { $dayOfWeek: "$occurrence.date" },
        present: { $sum: { $cond: [{ $eq: ["$status", ATTENDANCE_STATUS.PRESENT] }, 1, 0] } },
        late: { $sum: { $cond: [{ $eq: ["$status", ATTENDANCE_STATUS.LATE] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ["$status", ATTENDANCE_STATUS.ABSENT] }, 1, 0] } }
      }
    },
    { $sort: { "_id": 1 } }
  ])

  // Get weekly trend (last 14 days)
  const twoWeeksAgo = new Date()
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
  twoWeeksAgo.setHours(0, 0, 0, 0)

  const trendStats = await Attendance.aggregate([
    {
      $lookup: {
        from: "sessionoccurrences",
        localField: "sessionOccurrenceId",
        foreignField: "_id",
        as: "occurrence"
      }
    },
    { $unwind: "$occurrence" },
    { $match: { "occurrence.date": { $gte: twoWeeksAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$occurrence.date" } },
        total: { $sum: 1 },
        present: { $sum: { $cond: [{ $in: ["$status", [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE]] }, 1, 0] } }
      }
    },
    { $sort: { "_id": 1 } }
  ])

  const stats = overallStats[0] || { total: 0, present: 0, late: 0, absent: 0, justifiedAbsence: 0 }
  
  return NextResponse.json({
    total: stats.total,
    present: stats.present,
    late: stats.late,
    absent: stats.absent,
    justifiedAbsence: stats.justifiedAbsence,
    byDay: byDayStats.map((d: any) => ({
      day: d._id - 1, // MongoDB dayOfWeek is 1-7 (Sunday=1), convert to 0-6
      present: d.present,
      late: d.late,
      absent: d.absent
    })),
    trend: trendStats.map((d: any) => ({
      date: d._id,
      rate: d.total > 0 ? Math.round((d.present / d.total) * 100) : 0
    }))
  })
}

// GET /api/attendance - List attendance records with filters or stats
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session || (session.user.role !== ROLES.ADMIN && session.user.role !== ROLES.TEACHER)) {
      return NextResponse.json(
        { message: "غير مصرح لك بالوصول" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const stats = searchParams.get("stats")
    
    await dbConnect()

    // Return comprehensive stats for dashboard
    if (stats === "true") {
      return getAttendanceStats()
    }

    const search = searchParams.get("search")
    const sessionId = searchParams.get("sessionId")
    const teacherId = searchParams.get("teacherId")
    const status = searchParams.get("status")
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")

    // Build query
    const query: any = {}

    if (status) {
      query.status = status
    }

    // Get attendance records with populated data
    let records = await Attendance.find(query)
      .populate("studentId", "fullName")
      .populate({
        path: "sessionOccurrenceId",
        populate: [
          { path: "sessionTemplateId", select: "name" },
          { path: "teacherId", select: "fullName" }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()

    // Filter by search (student name)
    if (search) {
      records = records.filter((r: any) =>
        r.studentId?.fullName?.toLowerCase().includes(search.toLowerCase())
      )
    }

    // Filter by session
    if (sessionId) {
      records = records.filter((r: any) =>
        r.sessionOccurrenceId?.sessionTemplateId?._id?.toString() === sessionId
      )
    }

    // Filter by teacher
    if (teacherId) {
      records = records.filter((r: any) =>
        r.sessionOccurrenceId?.teacherId?._id?.toString() === teacherId
      )
    }

    // Filter by date range
    if (dateFrom) {
      const fromDate = new Date(dateFrom)
      records = records.filter((r: any) =>
        new Date(r.createdAt) >= fromDate
      )
    }

    if (dateTo) {
      const toDate = new Date(dateTo)
      toDate.setHours(23, 59, 59, 999)
      records = records.filter((r: any) =>
        new Date(r.createdAt) <= toDate
      )
    }

    // Calculate filtered record stats
    const filteredStats = {
      total: records.length,
      present: records.filter((r: any) => r.status === ATTENDANCE_STATUS.PRESENT).length,
      late: records.filter((r: any) => r.status === ATTENDANCE_STATUS.LATE).length,
      absent: records.filter((r: any) => r.status === ATTENDANCE_STATUS.ABSENT).length,
    }

    return NextResponse.json({ records, stats: filteredStats })
  } catch (error) {
    console.error("Error fetching attendance:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء جلب البيانات" },
      { status: 500 }
    )
  }
}

