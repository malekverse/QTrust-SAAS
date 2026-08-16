import mongoose from 'mongoose'
import Attendance from '@/models/Attendance'
import SessionOccurrence from '@/models/SessionOccurrence'
import MonthlyPayment from '@/models/MonthlyPayment'
import Student from '@/models/Student'
import User from '@/models/User'
import {
  ATTENDANCE_STATUS,
  SESSION_STATUS,
  MONTH_LABELS,
} from '@/lib/constants'

void Attendance
void SessionOccurrence
void MonthlyPayment
void Student
void User

export type RiskLevel = 'HIGH' | 'MEDIUM'

export interface DropoutRiskRow {
  studentId: string
  name: string
  consecutiveAbsences: number
  absenceRate: number
  totalSessions: number
  level: RiskLevel
}

export interface RevenueMonth {
  month: number
  year: number
  label: string
  collected: number
  paidCount: number
}

export interface TeacherRow {
  teacherId: string
  name: string
  finished: number
  cancelled: number
  scheduled: number
  total: number
  fulfillmentRate: number | null
}

export interface AnalyticsResult {
  dropoutRisk: DropoutRiskRow[]
  revenue: {
    months: RevenueMonth[]
    avgMonthlyCollected: number
    projectedNext: number
    totalCollected: number
  }
  teachers: TeacherRow[]
}

interface AttAgg {
  _id: mongoose.Types.ObjectId
  statuses: string[]
  total: number
  absent: number
}

// Count trailing ABSENT statuses (most-recent-first once we reverse the
// chronologically-sorted array) — "consecutive unexcused absences".
function trailingAbsences(statusesChrono: string[]): number {
  let count = 0
  for (let i = statusesChrono.length - 1; i >= 0; i--) {
    if (statusesChrono[i] === ATTENDANCE_STATUS.ABSENT) count++
    else break
  }
  return count
}

export async function computeAnalytics(tenantId: string): Promise<AnalyticsResult> {
  const tid = mongoose.Types.ObjectId.createFromHexString(tenantId)

  // ── Dropout risk (rules-based) ──
  const [attAgg, students] = await Promise.all([
    Attendance.aggregate<AttAgg>([
      { $match: { tenantId: tid } },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: '$studentId',
          statuses: { $push: '$status' },
          total: { $sum: 1 },
          absent: { $sum: { $cond: [{ $eq: ['$status', ATTENDANCE_STATUS.ABSENT] }, 1, 0] } },
        },
      },
    ]),
    Student.find({ tenantId, isActive: true }).select('firstName lastName fullName').lean(),
  ])

  const attById = new Map(attAgg.map((a) => [String(a._id), a]))
  const nameOf = (s: { firstName?: string; lastName?: string; fullName?: string }) =>
    s.fullName || `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'طالب'

  const dropoutRisk: DropoutRiskRow[] = []
  for (const s of students) {
    const att = attById.get(String(s._id))
    if (!att || att.total < 3) continue // not enough history to judge
    const consecutive = trailingAbsences(att.statuses)
    const rate = att.absent / att.total
    let level: RiskLevel | null = null
    if (consecutive >= 3) level = 'HIGH'
    else if (consecutive === 2 || (att.total >= 4 && rate >= 0.5)) level = 'MEDIUM'
    if (!level) continue
    dropoutRisk.push({
      studentId: String(s._id),
      name: nameOf(s),
      consecutiveAbsences: consecutive,
      absenceRate: Math.round(rate * 100),
      totalSessions: att.total,
      level,
    })
  }
  dropoutRisk.sort(
    (a, b) => b.consecutiveAbsences - a.consecutiveAbsences || b.absenceRate - a.absenceRate
  )

  // ── Revenue trend (last 6 months incl. current) ──
  const now = new Date()
  const monthsWanted: { month: number; year: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthsWanted.push({ month: d.getMonth() + 1, year: d.getFullYear() })
  }

  const payAgg = await MonthlyPayment.aggregate<{
    _id: { y: number; m: number }
    collected: number
    paidCount: number
  }>([
    {
      $match: {
        tenantId: tid,
        isPaid: true,
        $or: monthsWanted.map((mw) => ({ year: mw.year, month: mw.month })),
      },
    },
    {
      $group: {
        _id: { y: '$year', m: '$month' },
        collected: { $sum: { $ifNull: ['$amount', 0] } },
        paidCount: { $sum: 1 },
      },
    },
  ])
  const payByKey = new Map(payAgg.map((p) => [`${p._id.y}-${p._id.m}`, p]))

  const months: RevenueMonth[] = monthsWanted.map((mw) => {
    const p = payByKey.get(`${mw.year}-${mw.month}`)
    return {
      month: mw.month,
      year: mw.year,
      label: MONTH_LABELS[mw.month as keyof typeof MONTH_LABELS] || String(mw.month),
      collected: Math.round((p?.collected || 0) * 100) / 100,
      paidCount: p?.paidCount || 0,
    }
  })
  const totalCollected = Math.round(months.reduce((s, m) => s + m.collected, 0) * 100) / 100
  const monthsWithData = months.filter((m) => m.collected > 0)
  const avgMonthlyCollected =
    monthsWithData.length > 0
      ? Math.round((totalCollected / monthsWithData.length) * 100) / 100
      : 0

  // ── Teacher fulfillment ──
  const [occAgg, teachers] = await Promise.all([
    SessionOccurrence.aggregate<{
      _id: mongoose.Types.ObjectId
      finished: number
      cancelled: number
      scheduled: number
      total: number
    }>([
      { $match: { tenantId: tid } },
      {
        $group: {
          _id: '$teacherId',
          finished: { $sum: { $cond: [{ $eq: ['$status', SESSION_STATUS.FINISHED] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', SESSION_STATUS.CANCELLED] }, 1, 0] } },
          scheduled: { $sum: { $cond: [{ $eq: ['$status', SESSION_STATUS.SCHEDULED] }, 1, 0] } },
          total: { $sum: 1 },
        },
      },
    ]),
    User.find({ tenantId, role: 'TEACHER' }).select('fullName').lean(),
  ])

  const occById = new Map(occAgg.map((o) => [String(o._id), o]))
  const teacherRows: TeacherRow[] = teachers
    .map((t) => {
      const o = occById.get(String(t._id))
      const finished = o?.finished || 0
      const cancelled = o?.cancelled || 0
      const decided = finished + cancelled
      return {
        teacherId: String(t._id),
        name: (t as { fullName?: string }).fullName || 'معلم',
        finished,
        cancelled,
        scheduled: o?.scheduled || 0,
        total: o?.total || 0,
        fulfillmentRate: decided > 0 ? Math.round((finished / decided) * 100) : null,
      }
    })
    .filter((t) => t.total > 0)
    .sort((a, b) => (b.fulfillmentRate ?? -1) - (a.fulfillmentRate ?? -1))

  return {
    dropoutRisk,
    revenue: {
      months,
      avgMonthlyCollected,
      projectedNext: avgMonthlyCollected,
      totalCollected,
    },
    teachers: teacherRows,
  }
}
