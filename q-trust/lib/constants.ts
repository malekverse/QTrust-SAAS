// Role constants
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN', // platform operator — cross-tenant, not bound to a Tenant
  ADMIN: 'ADMIN',             // tenant admin (the association's director/staff)
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT'
} as const

export type Role = typeof ROLES[keyof typeof ROLES]

// ─── Multi-tenant SaaS constants (Phase 1) ───

// Subscription plans (tenant tier)
export const PLANS = {
  STARTER: 'STARTER',
  STANDARD: 'STANDARD',
  PREMIUM: 'PREMIUM',
} as const

export type Plan = typeof PLANS[keyof typeof PLANS]

// Plan ordering for entitlement checks (higher index = higher tier)
export const PLAN_HIERARCHY: Plan[] = [PLANS.STARTER, PLANS.STANDARD, PLANS.PREMIUM]

// Per-plan default limits, applied when provisioning a tenant
export const PLAN_LIMITS: Record<Plan, { maxStudents: number; aiQuotaMonthly: number }> = {
  STARTER: { maxStudents: 50, aiQuotaMonthly: 0 },
  STANDARD: { maxStudents: 300, aiQuotaMonthly: 0 },
  PREMIUM: { maxStudents: Number.MAX_SAFE_INTEGER, aiQuotaMonthly: 500 },
}

// Tenant lifecycle status
export const TENANT_STATUS = {
  TRIAL: 'TRIAL',
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  SUSPENDED: 'SUSPENDED',
  CANCELLED: 'CANCELLED',
} as const

export type TenantStatus = typeof TENANT_STATUS[keyof typeof TENANT_STATUS]

// Tenant billing payment methods (local Tunisian market: virement / chèque / cash)
export const PAYMENT_METHODS = {
  BANK_TRANSFER: 'BANK_TRANSFER',
  CHECK: 'CHECK',
  CASH: 'CASH',
  CARD: 'CARD',
} as const

export type PaymentMethod = typeof PAYMENT_METHODS[keyof typeof PAYMENT_METHODS]

// Supported UI locales (per-tenant default branding)
export const LOCALES = ['ar', 'fr', 'en'] as const
export type Locale = typeof LOCALES[number]

// Platform billing (the super-admin billing the tenant — distinct from a
// tenant's own MonthlyPayment tracking of student families).
export const INVOICE_TYPES = {
  SETUP: 'SETUP',
  ANNUAL_RENEWAL: 'ANNUAL_RENEWAL',
  ADDON: 'ADDON',
} as const
export type InvoiceType = typeof INVOICE_TYPES[keyof typeof INVOICE_TYPES]

export const INVOICE_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  CANCELLED: 'CANCELLED',
} as const
export type InvoiceStatus = typeof INVOICE_STATUS[keyof typeof INVOICE_STATUS]

// Arabic display labels for the super-admin console
export const PLAN_LABELS: Record<string, string> = {
  STARTER: 'مبتدئ',
  STANDARD: 'احترافي',
  PREMIUM: 'متقدم',
}
export const TENANT_STATUS_LABELS: Record<string, string> = {
  TRIAL: 'تجريبي',
  ACTIVE: 'نشط',
  PAST_DUE: 'متأخر السداد',
  SUSPENDED: 'معلّق',
  CANCELLED: 'ملغى',
}
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: 'تحويل بنكي',
  CHECK: 'شيك',
  CASH: 'نقداً',
  CARD: 'بطاقة',
}
export const INVOICE_TYPE_LABELS: Record<string, string> = {
  SETUP: 'رسوم التركيب والإعداد',
  ANNUAL_RENEWAL: 'تجديد سنوي',
  ADDON: 'خدمة إضافية',
}
export const INVOICE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'قيد الانتظار',
  PAID: 'مدفوع',
  OVERDUE: 'متأخر',
  CANCELLED: 'ملغى',
}

// Gender constants
export const GENDER = {
  MALE: 'MALE',
  FEMALE: 'FEMALE'
} as const

export type Gender = typeof GENDER[keyof typeof GENDER]

export const GENDER_LABELS = {
  MALE: 'ذكر',
  FEMALE: 'أنثى'
} as const

// Activity areas for enrollment
export const ACTIVITY_AREAS = {
  QURAN_MEMORIZATION: 'QURAN_MEMORIZATION',
  TAJWEED_QIRAAT: 'TAJWEED_QIRAAT',
  QURAN_SCIENCES: 'QURAN_SCIENCES',
  COMPETITIONS: 'COMPETITIONS',
  YEAR_ROUND_ACTIVITY: 'YEAR_ROUND_ACTIVITY'
} as const

export type ActivityArea = typeof ACTIVITY_AREAS[keyof typeof ACTIVITY_AREAS]

export const ACTIVITY_AREA_LABELS = {
  QURAN_MEMORIZATION: 'حفظ القرآن',
  TAJWEED_QIRAAT: 'التجويد والقراءات',
  QURAN_SCIENCES: 'علوم القرآن',
  COMPETITIONS: 'المسابقات',
  YEAR_ROUND_ACTIVITY: 'النشاط على مدار السنة'
} as const

// Education levels
export const EDUCATION_LEVELS = [
  'ابتدائي',
  'إعدادي',
  'ثانوي',
  'جامعي',
  'ماجستير',
  'دكتوراه',
  'أخرى'
] as const

// Declaration text (fixed, not editable)
export const DECLARATION_TEXT = 'وأؤكد على صحة المعلومات المذكورة أعلاه، وألتزم باحترام النظام الأساسي للجمعية ونظامها الداخلي والقوانين الجاري بها العمل الخاصة بالجمعيات.'

// Attendance status constants
export const ATTENDANCE_STATUS = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  LATE: 'LATE',
  JUSTIFIED_ABSENCE: 'JUSTIFIED_ABSENCE'
} as const

export type AttendanceStatus = typeof ATTENDANCE_STATUS[keyof typeof ATTENDANCE_STATUS]

// Session status constants
export const SESSION_STATUS = {
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  FINISHED: 'FINISHED',
  CANCELLED: 'CANCELLED'
} as const

export type SessionStatus = typeof SESSION_STATUS[keyof typeof SESSION_STATUS]

// Attendance creator constants
export const ATTENDANCE_CREATOR = {
  SYSTEM: 'SYSTEM',
  TEACHER: 'TEACHER',
  ADMIN: 'ADMIN'
} as const

export type AttendanceCreator = typeof ATTENDANCE_CREATOR[keyof typeof ATTENDANCE_CREATOR]

// Days of the week
export const DAYS_OF_WEEK = [
  { value: 0, label: 'الأحد', labelEn: 'Sunday' },
  { value: 1, label: 'الإثنين', labelEn: 'Monday' },
  { value: 2, label: 'الثلاثاء', labelEn: 'Tuesday' },
  { value: 3, label: 'الأربعاء', labelEn: 'Wednesday' },
  { value: 4, label: 'الخميس', labelEn: 'Thursday' },
  { value: 5, label: 'الجمعة', labelEn: 'Friday' },
  { value: 6, label: 'السبت', labelEn: 'Saturday' }
] as const

// Default QR window settings
export const DEFAULT_QR_SETTINGS = {
  openOffsetBeforeMin: 60,
  closeOffsetAfterMin: 60,
  lateThresholdMin: 10
} as const

// Islamic greeting messages
export const ISLAMIC_GREETINGS = {
  welcome: 'السلام عليكم ورحمة الله وبركاته',
  scanSuccess: 'تم تسجيل حضورك بنجاح',
  scanSuccessSubtitle: 'زادك الله حرصًا على كتابه',
  noActiveSession: 'لا توجد حصة نشطة لك في هذا الوقت',
  contactAdmin: 'يرجى مراجعة الإدارة',
  thankYou: 'جزاكم الله خيراً',
  blessings: 'بارك الله فيكم'
} as const

// Payment status constants
export const PAYMENT_STATUS = {
  PAID: 'PAID',
  UNPAID: 'UNPAID',
} as const

export type PaymentStatus = typeof PAYMENT_STATUS[keyof typeof PAYMENT_STATUS]

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PAID: 'مدفوع',
  UNPAID: 'غير مدفوع',
} as const

export const MONTH_LABELS: Record<number, string> = {
  1: 'جانفي',
  2: 'فيفري',
  3: 'مارس',
  4: 'أفريل',
  5: 'ماي',
  6: 'جوان',
  7: 'جويلية',
  8: 'أوت',
  9: 'سبتمبر',
  10: 'أكتوبر',
  11: 'نوفمبر',
  12: 'ديسمبر',
} as const

// Room features
export const ROOM_FEATURES = {
  WHITEBOARD: 'WHITEBOARD',
  PROJECTOR: 'PROJECTOR',
  AC: 'AC',
  COMPUTER: 'COMPUTER',
  SOUND_SYSTEM: 'SOUND_SYSTEM',
  PRAYER_MATS: 'PRAYER_MATS',
  QURAN_COPIES: 'QURAN_COPIES',
} as const

export type RoomFeature = typeof ROOM_FEATURES[keyof typeof ROOM_FEATURES]

export const ROOM_FEATURE_LABELS: Record<string, string> = {
  WHITEBOARD: 'سبورة',
  PROJECTOR: 'مسلاط',
  AC: 'تكييف',
  COMPUTER: 'حاسوب',
  SOUND_SYSTEM: 'نظام صوت',
  PRAYER_MATS: 'حصائر صلاة',
  QURAN_COPIES: 'نسخ مصاحف',
} as const

// Navigation items
export const ADMIN_NAV_ITEMS = [
  { href: '/admin/dashboard', label: 'لوحة التحكم', icon: 'LayoutDashboard' },
  { href: '/admin/teachers', label: 'المعلمون', icon: 'Users' },
  { href: '/admin/students', label: 'الطلاب', icon: 'GraduationCap' },
  { href: '/admin/admissions', label: 'طلبات التسجيل', icon: 'ClipboardList' },
  { href: '/admin/sessions', label: 'الحصص', icon: 'Calendar' },
  { href: '/admin/substitutes', label: 'النواب', icon: 'UserCog' },
  { href: '/admin/rooms', label: 'القاعات', icon: 'DoorOpen' },
  { href: '/admin/schedule', label: 'الجدول الزمني', icon: 'CalendarClock' },
  { href: '/admin/attendance', label: 'الحضور', icon: 'ClipboardCheck' },
  { href: '/admin/subscriptions', label: 'الاشتراكات', icon: 'CreditCard' },
  { href: '/admin/families', label: 'العائلات', icon: 'UsersRound' },
  { href: '/admin/claims', label: 'الاعتراضات', icon: 'MessageSquareWarning' },
  { href: '/admin/documents', label: 'المكتبة', icon: 'BookOpen' },
  { href: '/admin/analytics', label: 'التحليلات', icon: 'BarChart3' },
  { href: '/admin/messaging', label: 'الرسائل', icon: 'MessageCircle' },
  { href: '/admin/ai-assistant', label: 'المساعد الذكي', icon: 'Bot' },
  { href: '/admin/settings', label: 'الإعدادات', icon: 'Settings' }
] as const

export const TEACHER_NAV_ITEMS = [
  { href: '/teacher/dashboard', label: 'لوحة التحكم', icon: 'LayoutDashboard' },
  { href: '/teacher/sessions', label: 'حصصي', icon: 'Calendar' },
  { href: '/teacher/evaluations', label: 'تقييم الطلاب', icon: 'Star' },
  { href: '/teacher/analytics', label: 'الإحصائيات', icon: 'BarChart3' },
  { href: '/teacher/settings', label: 'الإعدادات', icon: 'Settings' }
] as const

export const STUDENT_NAV_ITEMS = [
  { href: '/student/dashboard', label: 'الرئيسية', icon: 'LayoutDashboard' },
  { href: '/student/sessions', label: 'حلقاتي', icon: 'Calendar' },
  { href: '/student/schedule', label: 'جدولي', icon: 'CalendarClock' },
  { href: '/student/attendance', label: 'سجل الحضور', icon: 'ClipboardCheck' },
  { href: '/student/performance', label: 'النتائج والتقييم', icon: 'BarChart3' },
  { href: '/student/documents', label: 'المكتبة', icon: 'BookOpen' },
  { href: '/student/settings', label: 'الإعدادات', icon: 'Settings' }
] as const

// Attendance claim status
export const CLAIM_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
} as const

export type ClaimStatus = typeof CLAIM_STATUS[keyof typeof CLAIM_STATUS]

// Document categories
export const DOCUMENT_CATEGORIES = {
  QURAN_STUDY: 'QURAN_STUDY',
  TAJWEED: 'TAJWEED',
  MEMORIZATION_GUIDE: 'MEMORIZATION_GUIDE',
  EXAM_MATERIAL: 'EXAM_MATERIAL',
  GENERAL: 'GENERAL',
  COMPETITION: 'COMPETITION',
  OTHER: 'OTHER'
} as const

export type DocumentCategory = typeof DOCUMENT_CATEGORIES[keyof typeof DOCUMENT_CATEGORIES]

export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  QURAN_STUDY: 'دراسات قرآنية',
  TAJWEED: 'تجويد',
  MEMORIZATION_GUIDE: 'دليل الحفظ',
  EXAM_MATERIAL: 'مواد الامتحان',
  GENERAL: 'عام',
  COMPETITION: 'مسابقات',
  OTHER: 'أخرى'
} as const

// Grade types
export const GRADE_TYPE = {
  EXAM: 'EXAM',
  MONTHLY_EVALUATION: 'MONTHLY_EVALUATION',
  ORAL_TEST: 'ORAL_TEST',
  MEMORIZATION: 'MEMORIZATION',
  TAJWEED: 'TAJWEED'
} as const

export type GradeType = typeof GRADE_TYPE[keyof typeof GRADE_TYPE]

export const GRADE_TYPE_LABELS: Record<string, string> = {
  EXAM: 'اختبار',
  MONTHLY_EVALUATION: 'تقييم شهري',
  ORAL_TEST: 'اختبار شفهي',
  MEMORIZATION: 'حفظ',
  TAJWEED: 'تجويد'
} as const

// Hifz (memorization tracking) types
export const HIFZ_TYPE = {
  SABAQ: 'SABAQ',
  SABQI: 'SABQI',
  MANZIL: 'MANZIL',
} as const
export type HifzType = typeof HIFZ_TYPE[keyof typeof HIFZ_TYPE]

export const HIFZ_TYPE_LABELS: Record<string, string> = {
  SABAQ: 'سبق (حفظ جديد)',
  SABQI: 'سبقي (مراجعة قريبة)',
  MANZIL: 'منزل (مراجعة بعيدة)',
} as const

export const HIFZ_QUALITY = {
  EXCELLENT: 'EXCELLENT',
  GOOD: 'GOOD',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  WEAK: 'WEAK',
} as const
export type HifzQuality = typeof HIFZ_QUALITY[keyof typeof HIFZ_QUALITY]

export const HIFZ_QUALITY_LABELS: Record<string, string> = {
  EXCELLENT: 'ممتاز',
  GOOD: 'جيد',
  NEEDS_REVIEW: 'يحتاج مراجعة',
  WEAK: 'ضعيف',
} as const

// Behavior (Akhlaq / Tarbiyah) logging
export const BEHAVIOR_TYPE = {
  POSITIVE: 'POSITIVE',
  CONCERN: 'CONCERN',
} as const
export type BehaviorType = typeof BEHAVIOR_TYPE[keyof typeof BEHAVIOR_TYPE]

export const BEHAVIOR_TYPE_LABELS: Record<string, string> = {
  POSITIVE: 'سلوك إيجابي',
  CONCERN: 'ملاحظة سلوكية',
} as const

// Online admissions / enrollment pipeline
export const ADMISSION_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  WAITLISTED: 'WAITLISTED',
  REJECTED: 'REJECTED',
} as const
export type AdmissionStatus = typeof ADMISSION_STATUS[keyof typeof ADMISSION_STATUS]

export const ADMISSION_STATUS_LABELS: Record<string, string> = {
  PENDING: 'قيد المراجعة',
  APPROVED: 'مقبول',
  WAITLISTED: 'قائمة الانتظار',
  REJECTED: 'مرفوض',
} as const

// Outbound messaging (WhatsApp / SMS) — provider configured per tenant in Settings
export const MESSAGING_PROVIDER = {
  DISABLED: 'DISABLED',
  WHATSAPP_CLOUD: 'WHATSAPP_CLOUD',
  TWILIO_SMS: 'TWILIO_SMS',
} as const
export type MessagingProvider = typeof MESSAGING_PROVIDER[keyof typeof MESSAGING_PROVIDER]

export const MESSAGING_PROVIDER_LABELS: Record<string, string> = {
  DISABLED: 'معطّل',
  WHATSAPP_CLOUD: 'واتساب (WhatsApp Cloud API)',
  TWILIO_SMS: 'رسائل SMS (Twilio)',
}

export const MESSAGE_STATUS = {
  SENT: 'SENT',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED', // provider not configured — recorded but not sent
} as const
export type MessageStatus = typeof MESSAGE_STATUS[keyof typeof MESSAGE_STATUS]

export const MESSAGE_STATUS_LABELS: Record<string, string> = {
  SENT: 'أُرسلت',
  FAILED: 'فشلت',
  SKIPPED: 'لم تُرسل (غير مُفعّل)',
}

export const MESSAGE_TYPE = {
  PAYMENT_REMINDER: 'PAYMENT_REMINDER',
  ABSENCE_ALERT: 'ABSENCE_ALERT',
  ADMISSION_RESULT: 'ADMISSION_RESULT',
  GENERAL: 'GENERAL',
} as const
export type MessageType = typeof MESSAGE_TYPE[keyof typeof MESSAGE_TYPE]

export const MESSAGE_TYPE_LABELS: Record<string, string> = {
  PAYMENT_REMINDER: 'تذكير بالدفع',
  ABSENCE_ALERT: 'تنبيه غياب',
  ADMISSION_RESULT: 'نتيجة التسجيل',
  GENERAL: 'عام',
}

// In-app notifications
export const NOTIFICATION_TYPE = {
  CLAIM_SUBMITTED: 'CLAIM_SUBMITTED',
  ADMISSION_RECEIVED: 'ADMISSION_RECEIVED',
  PAYMENT_OVERDUE: 'PAYMENT_OVERDUE',
  GENERAL: 'GENERAL',
} as const
export type NotificationType = typeof NOTIFICATION_TYPE[keyof typeof NOTIFICATION_TYPE]

