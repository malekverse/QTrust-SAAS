// Shared scaffolding for the two AI streaming routes (chat + execute). Both
// previously carried near-identical copies of these helpers, which had already
// drifted (execute's TOOL_NAME_AR was missing every write-tool label). This is
// the single source of truth.

export const MAX_TOOL_ROUNDS = 5
export const MAX_RETRIES = 2
export const TOOL_TIMEOUT_MS = 15_000

export interface AssembledToolCall {
  id: string
  name: string
  arguments: string
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// Recursively drops undefined/null, empty strings, empty arrays, and empty
// objects from LLM-supplied tool arguments.
export function cleanArgs(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(cleanArgs).filter((v) => v !== undefined)
  }
  if (isPlainObject(obj)) {
    const cleaned: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      const c = cleanArgs(v)
      if (c === undefined) continue
      if (typeof c === 'string' && c.trim() === '') continue
      if (Array.isArray(c) && c.length === 0) continue
      if (isPlainObject(c) && Object.keys(c).length === 0) continue
      cleaned[k] = c
    }
    return cleaned
  }
  if (obj === null || obj === undefined) return undefined
  return obj
}

const DAY_NAME_MAP: Record<string, number> = {
  'sunday': 0, 'الأحد': 0, 'الاحد': 0, 'أحد': 0, 'احد': 0,
  'monday': 1, 'الإثنين': 1, 'الاثنين': 1, 'إثنين': 1, 'اثنين': 1,
  'tuesday': 2, 'الثلاثاء': 2, 'ثلاثاء': 2,
  'wednesday': 3, 'الأربعاء': 3, 'الاربعاء': 3, 'أربعاء': 3, 'اربعاء': 3,
  'thursday': 4, 'الخميس': 4, 'خميس': 4,
  'friday': 5, 'الجمعة': 5, 'جمعة': 5,
  'saturday': 6, 'السبت': 6, 'سبت': 6,
}

// Coerces common natural-language values ("today", "الآن", day names) the LLM
// sometimes emits into the strict formats the tools expect.
export function coerceToolArgs(_toolName: string, args: Record<string, unknown>): Record<string, unknown> {
  const coerced = { ...args }

  if ('dayOfWeek' in coerced) {
    const val = coerced.dayOfWeek
    if (typeof val === 'string') {
      const lower = val.toLowerCase().trim()
      if (lower === 'today' || lower === 'اليوم' || lower === 'هذا اليوم') {
        const tunisiaDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Tunis' }))
        coerced.dayOfWeek = tunisiaDate.getDay()
      } else if (lower in DAY_NAME_MAP) {
        coerced.dayOfWeek = DAY_NAME_MAP[lower]
      } else {
        const parsed = parseInt(val, 10)
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 6) {
          coerced.dayOfWeek = parsed
        }
      }
    }
  }

  for (const field of ['startTime', 'endTime']) {
    if (field in coerced && typeof coerced[field] === 'string') {
      const val = (coerced[field] as string).toLowerCase().trim()
      if (val === 'now' || val === 'الآن' || val === 'الان') {
        const tunisiaDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Tunis' }))
        coerced[field] = `${tunisiaDate.getHours().toString().padStart(2, '0')}:${tunisiaDate.getMinutes().toString().padStart(2, '0')}`
      }
    }
  }

  for (const field of ['effectiveFromDate', 'effectiveToDate', 'startDate', 'endDate', 'date']) {
    if (field in coerced && typeof coerced[field] === 'string') {
      const val = (coerced[field] as string).toLowerCase().trim()
      if (val === 'today' || val === 'اليوم' || val === 'هذا اليوم') {
        const tunisiaDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Tunis' }))
        coerced[field] = tunisiaDate.toISOString().split('T')[0]
      } else if (val === 'tomorrow' || val === 'غداً' || val === 'غدا') {
        const tunisiaDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Tunis' }))
        tunisiaDate.setDate(tunisiaDate.getDate() + 1)
        coerced[field] = tunisiaDate.toISOString().split('T')[0]
      } else if (val === 'indefinite' || val === 'غير محدد' || val === 'مفتوح') {
        delete coerced[field]
      }
    }
  }

  for (const field of ['month', 'year', 'limit', 'capacity']) {
    if (field in coerced && typeof coerced[field] === 'string') {
      const parsed = parseInt(coerced[field] as string, 10)
      if (!isNaN(parsed)) coerced[field] = parsed
    }
  }

  return coerced
}

// True for the Groq 400 error raised when the model emits a malformed tool call
// (worth one retry rather than failing the whole turn).
export function isGroqToolValidationError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status
    if (status === 400) {
      const msg = error instanceof Error ? error.message : String(error)
      return (
        msg.includes('tool_use_failed') ||
        msg.includes('Failed to call a function') ||
        msg.includes('tool call validation failed') ||
        msg.includes('failed_generation')
      )
    }
  }
  return false
}

// Arabic labels for every tool (read + write). The execute route's old copy was
// missing all write-tool labels — this is the complete, canonical set.
export const TOOL_NAME_AR: Record<string, string> = {
  list_students: 'البحث عن الطلاب',
  get_student: 'عرض بيانات طالب',
  list_teachers: 'البحث عن المعلمين',
  get_teacher: 'عرض بيانات معلم',
  list_sessions: 'عرض الحصص',
  get_session: 'عرض تفاصيل حصة',
  list_rooms: 'عرض القاعات',
  get_room: 'عرض تفاصيل قاعة',
  check_room_availability: 'التحقق من توفر القاعة',
  view_schedule: 'عرض الجدول الزمني',
  check_conflicts: 'كشف التعارضات',
  view_attendance: 'عرض سجلات الحضور',
  get_attendance_stats: 'عرض إحصائيات الحضور',
  view_payments: 'عرض المدفوعات',
  list_claims: 'عرض الاعتراضات',
  list_documents: 'عرض المستندات',
  get_dashboard_stats: 'عرض إحصائيات لوحة التحكم',
  get_activity_log: 'عرض سجل النشاطات',
  get_settings: 'عرض الإعدادات',
  create_student: 'إنشاء طالب جديد',
  update_student: 'تحديث بيانات طالب',
  delete_student: 'إلغاء تنشيط طالب',
  create_teacher: 'إنشاء معلم جديد',
  update_teacher: 'تحديث بيانات معلم',
  delete_teacher: 'إلغاء تنشيط معلم',
  create_session: 'إنشاء حصة جديدة',
  update_session: 'تحديث حصة',
  delete_session: 'إلغاء تنشيط حصة',
  enroll_student: 'تسجيل طالب في حصة',
  unenroll_student: 'إلغاء تسجيل طالب',
  generate_occurrences: 'إنشاء حصص فعلية',
  create_room: 'إنشاء قاعة',
  update_room: 'تحديث قاعة',
  delete_room: 'إلغاء تنشيط قاعة',
  auto_assign_rooms: 'تعيين القاعات تلقائياً',
  update_attendance: 'تحديث حضور',
  mark_payment: 'تسجيل دفعة',
  bulk_mark_payments: 'تسجيل دفعات جماعية',
  review_claim: 'مراجعة اعتراض',
  delete_document: 'حذف مستند',
  update_settings: 'تحديث إعدادات',
  create_student_account: 'إنشاء حساب بوابة',
  reset_student_password: 'إعادة تعيين كلمة مرور',
}

export function describeAction(toolName: string, args: Record<string, unknown>): string {
  const descriptionMap: Record<string, string> = {
    create_student: `إنشاء طالب جديد: ${args.firstName || ''} ${args.lastName || ''}`,
    update_student: `تحديث بيانات طالب`,
    delete_student: `إلغاء تنشيط طالب`,
    create_student_account: `إنشاء حساب بوابة لطالب`,
    reset_student_password: `إعادة تعيين كلمة مرور طالب`,
    create_teacher: `إنشاء معلم جديد: ${args.fullName || ''}`,
    update_teacher: `تحديث بيانات معلم`,
    delete_teacher: `إلغاء تنشيط معلم`,
    create_session: `إنشاء حصة جديدة: ${args.name || ''}`,
    update_session: `تحديث حصة`,
    delete_session: `إلغاء تنشيط حصة`,
    enroll_student: `تسجيل طالب في حصة`,
    unenroll_student: `إلغاء تسجيل طالب من حصة`,
    generate_occurrences: `إنشاء حصص فعلية من ${args.startDate || ''} إلى ${args.endDate || ''}`,
    create_room: `إنشاء قاعة جديدة: ${args.name || ''}`,
    update_room: `تحديث بيانات قاعة`,
    delete_room: `إلغاء تنشيط قاعة`,
    auto_assign_rooms: `تعيين القاعات تلقائياً`,
    update_attendance: `تحديث حالة حضور`,
    mark_payment: `تسجيل دفعة شهرية`,
    bulk_mark_payments: `تسجيل دفعات جماعية لـ ${(args.studentIds as string[] || []).length} طلاب`,
    review_claim: `مراجعة اعتراض حضور`,
    delete_document: `حذف مستند`,
    update_settings: `تحديث إعدادات النظام`,
  }
  return descriptionMap[toolName] || `تنفيذ: ${toolName}`
}

export function sseEvent(type: string, data: Record<string, unknown>): string {
  return `data: ${JSON.stringify({ type, ...data })}\n\n`
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Tool "${label}" timed out after ${ms}ms`)), ms)
    ),
  ])
}
