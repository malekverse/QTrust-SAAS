// Client-safe badge constants (no server/db imports) — shared by the display
// board (client) and the scoring logic in leaderboard.ts (server).
export const BADGE = {
  PERFECT_ATTENDANCE: 'PERFECT_ATTENDANCE',
  HIFZ_STAR: 'HIFZ_STAR',
} as const

export const BADGE_LABELS: Record<string, string> = {
  PERFECT_ATTENDANCE: 'حضور مثالي',
  HIFZ_STAR: 'متميّز في الحفظ',
}
