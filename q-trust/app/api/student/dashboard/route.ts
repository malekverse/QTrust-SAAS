import { NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import Student from "@/models/Student"
import User from "@/models/User"
import StudentSession from "@/models/StudentSession"
import SessionTemplate from "@/models/SessionTemplate"
import SessionOccurrence from "@/models/SessionOccurrence"
import Attendance from "@/models/Attendance"
import Grade from "@/models/Grade"
import { auth } from "@/lib/auth"
import { ROLES, ATTENDANCE_STATUS } from "@/lib/constants"

// Force model registration
void Student; void User; void StudentSession; void SessionTemplate; void SessionOccurrence; void Attendance; void Grade

// GET /api/student/dashboard - Get student dashboard data
export async function GET() {
  try {
    const session = await auth()
    
    if (!session || session.user.role !== ROLES.STUDENT) {
      return NextResponse.json(
        { message: "غير مصرح لك بالوصول" },
        { status: 403 }
      )
    }

    await dbConnect()

    // Get user and student info
    const user = await User.findById(session.user.id).lean()
    if (!user || !user.studentId) {
      return NextResponse.json(
        { message: "حساب الطالب غير موجود" },
        { status: 404 }
      )
    }

    const student = await Student.findById(user.studentId).lean()
    if (!student) {
      return NextResponse.json(
        { message: "بيانات الطالب غير موجودة" },
        { status: 404 }
      )
    }

    const studentId = student._id

    // Get student's sessions
    const studentSessions = await StudentSession.find({
      studentId,
      isActive: true
    }).lean()
    const sessionTemplateIds = studentSessions.map(ss => ss.sessionTemplateId)

    // Get session templates
    const sessionTemplates = await SessionTemplate.find({
      _id: { $in: sessionTemplateIds },
      isActive: true
    }).populate("teacherId", "fullName").lean()

    // Find next upcoming session
    const now = new Date()
    const todayDayOfWeek = now.getDay()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    const timeToMinutes = (timeStr: string): number => {
      const parts = timeStr.split(':')
      return parseInt(parts[0]) * 60 + parseInt(parts[1] || '0')
    }

    let nextSession = null
    let minDaysUntil = 8

    for (const template of sessionTemplates) {
      let daysUntil = template.dayOfWeek - todayDayOfWeek
      if (daysUntil < 0) daysUntil += 7
      if (daysUntil === 0 && timeToMinutes(template.startTime) <= currentMinutes) {
        if (timeToMinutes(template.endTime) > currentMinutes) {
          daysUntil = 0 // still ongoing
        } else {
          daysUntil = 7 // already passed today, next week
        }
      }

      if (daysUntil < minDaysUntil) {
        minDaysUntil = daysUntil
        const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
        nextSession = {
          name: template.name,
          teacher: (template.teacherId as any)?.fullName || '',
          dayOfWeek: template.dayOfWeek,
          dayName: days[template.dayOfWeek],
          startTime: template.startTime,
          endTime: template.endTime,
          isToday: daysUntil === 0,
          daysUntil
        }
      }
    }

    // Calculate attendance stats (last 3 months)
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

    // Get all occurrences for student's sessions in the last 3 months
    const occurrences = await SessionOccurrence.find({
      sessionTemplateId: { $in: sessionTemplateIds },
      date: { $gte: threeMonthsAgo },
      status: { $ne: 'CANCELLED' }
    }).sort({ date: 1 }).lean()

    const occurrenceIds = occurrences.map(o => o._id)

    // Get attendance records
    const attendanceRecords = await Attendance.find({
      studentId,
      sessionOccurrenceId: { $in: occurrenceIds }
    }).lean()

    const totalSessions = occurrences.length
    const presentCount = attendanceRecords.filter(
      a => a.status === ATTENDANCE_STATUS.PRESENT || a.status === ATTENDANCE_STATUS.LATE
    ).length
    const lateCount = attendanceRecords.filter(a => a.status === ATTENDANCE_STATUS.LATE).length
    const absentCount = totalSessions - presentCount
    const justifiedCount = attendanceRecords.filter(a => a.status === ATTENDANCE_STATUS.JUSTIFIED_ABSENCE).length
    const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0

    // Calculate attendance streak (consecutive present days)
    let streak = 0
    const sortedOccurrences = [...occurrences].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
    for (const occ of sortedOccurrences) {
      const att = attendanceRecords.find(
        a => a.sessionOccurrenceId.toString() === occ._id.toString()
      )
      if (att && (att.status === ATTENDANCE_STATUS.PRESENT || att.status === ATTENDANCE_STATUS.LATE)) {
        streak++
      } else {
        break
      }
    }

    // Monthly attendance data for chart (last 3 months)
    const monthlyData: { month: string; present: number; absent: number; total: number }[] = []
    for (let i = 2; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1)
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      const monthName = d.toLocaleDateString('ar-TN', { month: 'long' })
      
      const monthOccurrences = occurrences.filter(o => {
        const occDate = new Date(o.date)
        return occDate >= monthStart && occDate <= monthEnd
      })
      const monthOccIds = monthOccurrences.map(o => o._id.toString())
      const monthAttendance = attendanceRecords.filter(a => 
        monthOccIds.includes(a.sessionOccurrenceId.toString())
      )
      const monthPresent = monthAttendance.filter(
        a => a.status === ATTENDANCE_STATUS.PRESENT || a.status === ATTENDANCE_STATUS.LATE
      ).length

      monthlyData.push({
        month: monthName,
        present: monthPresent,
        absent: monthOccurrences.length - monthPresent,
        total: monthOccurrences.length
      })
    }

    // Get grades for performance average
    const grades = await Grade.find({ studentId }).sort({ date: -1 }).lean()
    let performanceAverage = 0
    if (grades.length > 0) {
      const totalPercentage = grades.reduce((sum, g) => sum + (g.score / g.maxScore) * 100, 0)
      performanceAverage = Math.round(totalPercentage / grades.length)
    }

    // Memorization progress (count unique juz from grades)
    const completedJuz = new Set<number>()
    grades.forEach(g => {
      if (g.juz && g.score / g.maxScore >= 0.7) {
        completedJuz.add(g.juz)
      }
    })

    return NextResponse.json({
      student: {
        firstName: student.firstName,
        lastName: student.lastName,
        displayName: student.firstName && student.lastName 
          ? `${student.firstName} ${student.lastName}` 
          : student.fullName || '',
        photoUrl: student.photoUrl
      },
      stats: {
        attendanceRate,
        streak,
        totalSessions,
        presentCount,
        lateCount,
        absentCount,
        justifiedCount,
        performanceAverage,
        completedJuz: completedJuz.size,
        totalJuz: 30,
        enrolledSessions: sessionTemplates.length
      },
      nextSession,
      monthlyAttendance: monthlyData,
      recentGrades: grades.slice(0, 5).map(g => ({
        _id: g._id,
        title: g.title,
        type: g.type,
        score: g.score,
        maxScore: g.maxScore,
        date: g.date,
        percentage: Math.round((g.score / g.maxScore) * 100)
      }))
    })
  } catch (error) {
    console.error("Error fetching student dashboard:", error)
    return NextResponse.json(
      { message: "حدث خطأ أثناء جلب البيانات" },
      { status: 500 }
    )
  }
}
