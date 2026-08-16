import mongoose from 'mongoose'
import Attendance from '@/models/Attendance'
import HifzLog from '@/models/HifzLog'
import Student from '@/models/Student'
import { ATTENDANCE_STATUS, HIFZ_QUALITY } from '@/lib/constants'
import { BADGE } from '@/lib/leaderboard-badges'

export { BADGE, BADGE_LABELS } from '@/lib/leaderboard-badges'

void Attendance
void HifzLog
void Student

// Transparent, on-read scoring — no denormalized points, no background job.
// Points are recomputed from source records each time the board is requested.
const ATTENDANCE_POINTS = {
  [ATTENDANCE_STATUS.PRESENT]: 10,
  [ATTENDANCE_STATUS.LATE]: 5,
  [ATTENDANCE_STATUS.JUSTIFIED_ABSENCE]: 2,
  [ATTENDANCE_STATUS.ABSENT]: 0,
}
const HIFZ_QUALITY_POINTS = {
  [HIFZ_QUALITY.EXCELLENT]: 15,
  [HIFZ_QUALITY.GOOD]: 10,
  [HIFZ_QUALITY.NEEDS_REVIEW]: 5,
  [HIFZ_QUALITY.WEAK]: 2,
}

// Thresholds a student must clear to earn each badge.
const PERFECT_ATTENDANCE_MIN_SESSIONS = 5
const HIFZ_STAR_MIN_VERSES = 50

export interface LeaderboardEntry {
  studentId: string
  displayName: string
  points: number
  attendancePoints: number
  hifzPoints: number
  presentCount: number
  hifzVerses: number
  badges: string[]
}

interface AttAgg {
  _id: mongoose.Types.ObjectId
  present: number
  late: number
  justified: number
  total: number
}
interface HifzAgg {
  _id: mongoose.Types.ObjectId
  excellent: number
  good: number
  needsReview: number
  weak: number
  verses: number
}

export async function computeLeaderboard(
  tenantId: string,
  limit = 20
): Promise<LeaderboardEntry[]> {
  const tid = mongoose.Types.ObjectId.createFromHexString(tenantId)

  const [attAgg, hifzAgg] = await Promise.all([
    Attendance.aggregate<AttAgg>([
      { $match: { tenantId: tid } },
      {
        $group: {
          _id: '$studentId',
          present: { $sum: { $cond: [{ $eq: ['$status', ATTENDANCE_STATUS.PRESENT] }, 1, 0] } },
          late: { $sum: { $cond: [{ $eq: ['$status', ATTENDANCE_STATUS.LATE] }, 1, 0] } },
          justified: { $sum: { $cond: [{ $eq: ['$status', ATTENDANCE_STATUS.JUSTIFIED_ABSENCE] }, 1, 0] } },
          total: { $sum: 1 },
        },
      },
    ]),
    HifzLog.aggregate<HifzAgg>([
      { $match: { tenantId: tid } },
      {
        $group: {
          _id: '$studentId',
          excellent: { $sum: { $cond: [{ $eq: ['$quality', HIFZ_QUALITY.EXCELLENT] }, 1, 0] } },
          good: { $sum: { $cond: [{ $eq: ['$quality', HIFZ_QUALITY.GOOD] }, 1, 0] } },
          needsReview: { $sum: { $cond: [{ $eq: ['$quality', HIFZ_QUALITY.NEEDS_REVIEW] }, 1, 0] } },
          weak: { $sum: { $cond: [{ $eq: ['$quality', HIFZ_QUALITY.WEAK] }, 1, 0] } },
          verses: { $sum: { $add: [{ $subtract: ['$toVerse', '$fromVerse'] }, 1] } },
        },
      },
    ]),
  ])

  const attById = new Map(attAgg.map((a) => [String(a._id), a]))
  const hifzById = new Map(hifzAgg.map((h) => [String(h._id), h]))

  // Only rank currently-active students.
  const students = await Student.find({ tenantId, isActive: true })
    .select('firstName lastName fullName')
    .lean()

  const entries: LeaderboardEntry[] = students.map((s) => {
    const att = attById.get(String(s._id))
    const hifz = hifzById.get(String(s._id))

    const attendancePoints =
      (att?.present || 0) * ATTENDANCE_POINTS[ATTENDANCE_STATUS.PRESENT] +
      (att?.late || 0) * ATTENDANCE_POINTS[ATTENDANCE_STATUS.LATE] +
      (att?.justified || 0) * ATTENDANCE_POINTS[ATTENDANCE_STATUS.JUSTIFIED_ABSENCE]

    const hifzPoints =
      (hifz?.excellent || 0) * HIFZ_QUALITY_POINTS[HIFZ_QUALITY.EXCELLENT] +
      (hifz?.good || 0) * HIFZ_QUALITY_POINTS[HIFZ_QUALITY.GOOD] +
      (hifz?.needsReview || 0) * HIFZ_QUALITY_POINTS[HIFZ_QUALITY.NEEDS_REVIEW] +
      (hifz?.weak || 0) * HIFZ_QUALITY_POINTS[HIFZ_QUALITY.WEAK]

    const presentCount = att?.present || 0
    const hifzVerses = hifz?.verses || 0

    const badges: string[] = []
    if (att && att.total >= PERFECT_ATTENDANCE_MIN_SESSIONS && att.present === att.total) {
      badges.push(BADGE.PERFECT_ATTENDANCE)
    }
    if (hifzVerses >= HIFZ_STAR_MIN_VERSES) {
      badges.push(BADGE.HIFZ_STAR)
    }

    // Public display: first name + last-name initial only (privacy on a TV).
    const firstName = s.firstName || s.fullName?.split(' ')[0] || 'طالب'
    const lastInitial = s.lastName ? `${s.lastName.charAt(0)}.` : ''
    const displayName = `${firstName} ${lastInitial}`.trim()

    return {
      studentId: String(s._id),
      displayName,
      points: attendancePoints + hifzPoints,
      attendancePoints,
      hifzPoints,
      presentCount,
      hifzVerses,
      badges,
    }
  })

  return entries
    .filter((e) => e.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, limit)
}
