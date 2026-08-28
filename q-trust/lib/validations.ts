import { z } from 'zod'
import { parse, isValid } from 'date-fns'
import { ROLES, ATTENDANCE_STATUS, SESSION_STATUS, DAYS_OF_WEEK, GENDER, ACTIVITY_AREAS, ROOM_FEATURES } from './constants'

/** Strict YYYY-MM-DD (rejects month/day 00 and impossible dates). */
function isValidCalendarIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = parse(value, 'yyyy-MM-dd', new Date())
  return isValid(d)
}

// ===== User Validations =====
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'معرّف الدخول مطلوب')
    .refine(
      (val) => /^\S+@\S+\.\S+$/.test(val) || /^\+216\d{8}$/.test(val),
      'أدخل بريداً إلكترونياً صالحاً أو رقم هاتف بصيغة +216XXXXXXXX'
    ),
  password: z
    .string()
    .min(1, 'كلمة المرور مطلوبة')
    .min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل')
})

export const createUserSchema = z.object({
  fullName: z
    .string()
    .min(2, 'الاسم يجب أن يكون على الأقل حرفين')
    .max(100, 'الاسم يجب أن لا يتجاوز 100 حرف'),
  email: z
    .string()
    .min(1, 'البريد الإلكتروني مطلوب')
    .email('البريد الإلكتروني غير صالح'),
  password: z
    .string()
    .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل')
    .max(100, 'كلمة المرور طويلة جداً'),
  role: z.enum([ROLES.ADMIN, ROLES.TEACHER])
})

export const updateUserSchema = z.object({
  fullName: z
    .string()
    .min(2, 'الاسم يجب أن يكون على الأقل حرفين')
    .max(100, 'الاسم يجب أن لا يتجاوز 100 حرف')
    .optional(),
  email: z
    .string()
    .email('البريد الإلكتروني غير صالح')
    .optional(),
  isActive: z.boolean().optional(),
  role: z.enum([ROLES.ADMIN, ROLES.TEACHER]).optional()
})

export const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, 'كلمة المرور الحالية مطلوبة'),
  newPassword: z
    .string()
    .min(8, 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل')
    .max(100, 'كلمة المرور طويلة جداً'),
  confirmPassword: z
    .string()
    .min(1, 'تأكيد كلمة المرور مطلوب')
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'كلمات المرور غير متطابقة',
  path: ['confirmPassword']
})

// ===== Student Validations =====

// Phone validation helper - Tunisia phone (8 digits after +216)
const tunisiaPhoneRegex = /^\+216\d{8}$/

// CIN validation helper - 8 digits
const cinRegex = /^\d{8}$/

// Section A - المعلومات الشخصية
const personalInfoSchema = z.object({
  enrollmentNumber: z
    .string()
    .max(50, 'رقم الانخراط يجب أن لا يتجاوز 50 حرف')
    .optional(),
  cin: z
    .string()
    .regex(cinRegex, 'رقم بطاقة التعريف يجب أن يكون 8 أرقام')
    .optional()
    .or(z.literal('')),
  firstName: z
    .string()
    .min(2, 'الاسم يجب أن يكون على الأقل حرفين')
    .max(50, 'الاسم يجب أن لا يتجاوز 50 حرف'),
  lastName: z
    .string()
    .min(2, 'اللقب يجب أن يكون على الأقل حرفين')
    .max(50, 'اللقب يجب أن لا يتجاوز 50 حرف'),
  fatherName: z
    .string()
    .max(100, 'اسم الأب يجب أن لا يتجاوز 100 حرف')
    .optional(),
  gender: z.enum([GENDER.MALE, GENDER.FEMALE], {
    message: 'الجنس مطلوب'
  }),
  profession: z
    .string()
    .max(100, 'المهنة يجب أن لا تتجاوز 100 حرف')
    .optional(),
  dateOfBirth: z
    .string()
    .optional(),
  placeOfBirth: z
    .string()
    .max(100, 'مكان الولادة يجب أن لا يتجاوز 100 حرف')
    .optional(),
  educationLevel: z
    .string()
    .max(100, 'المستوى التعليمي يجب أن لا يتجاوز 100 حرف')
    .optional(),
  address: z
    .string()
    .max(200, 'العنوان يجب أن لا يتجاوز 200 حرف')
    .optional(),
  phone: z
    .string()
    .regex(tunisiaPhoneRegex, 'رقم الهاتف يجب أن يكون بصيغة +216XXXXXXXX')
    .optional()
    .or(z.literal('')),
  email: z
    .string()
    .email('البريد الإلكتروني غير صالح')
    .optional()
    .or(z.literal(''))
})

// Activity area enum for type safety
const activityAreaEnum = z.enum([
  ACTIVITY_AREAS.QURAN_MEMORIZATION,
  ACTIVITY_AREAS.TAJWEED_QIRAAT,
  ACTIVITY_AREAS.QURAN_SCIENCES,
  ACTIVITY_AREAS.COMPETITIONS,
  ACTIVITY_AREAS.YEAR_ROUND_ACTIVITY
])

// Section B - اختيار مجال النشاط داخل الجمعية
const activityAreasSchema = z.object({
  activityAreas: z
    .array(activityAreaEnum)
    .optional()
    .default([])
})

// Section C - الإقرار
const declarationSchema = z.object({
  declarationAccepted: z
    .boolean()
    .refine(val => val === true, 'يجب الموافقة على الإقرار للتسجيل')
})

// Section D - معلومات الإمضاء
const signatureSchema = z.object({
  signatureLocation: z
    .string()
    .max(100, 'مكان الإمضاء يجب أن لا يتجاوز 100 حرف')
    .optional(),
  signatureDate: z
    .string()
    .optional()
})

// Section E - المرفقات المطلوبة
const attachmentsSchema = z.object({
  photoUrl: z.string().optional(),
  cinFrontUrl: z.string().optional(),
  cinBackUrl: z.string().optional()
})

// Admin notes
const notesSchema = z.object({
  notes: z
    .string()
    .max(500, 'الملاحظات يجب أن لا تتجاوز 500 حرف')
    .optional()
})

// Complete student form schema
export const studentFormSchema = personalInfoSchema
  .merge(activityAreasSchema)
  .merge(declarationSchema)
  .merge(signatureSchema)
  .merge(attachmentsSchema)
  .merge(notesSchema)

// Schema for creating a new student
export const createStudentSchema = studentFormSchema.transform((data) => ({
  ...data,
  dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
  signatureDate: data.signatureDate ? new Date(data.signatureDate) : undefined,
  cin: data.cin || undefined,
  phone: data.phone || undefined,
  email: data.email || undefined,
}))

// Schema for updating a student (all fields optional except for partial updates)
export const updateStudentSchema = studentFormSchema.partial().extend({
  isActive: z.boolean().optional()
}).transform((data) => {
  const result: Record<string, unknown> = { ...data }
  if (data.dateOfBirth) {
    result.dateOfBirth = new Date(data.dateOfBirth)
  }
  if (data.signatureDate) {
    result.signatureDate = new Date(data.signatureDate)
  }
  // Clean empty strings
  if (data.cin === '') result.cin = undefined
  if (data.phone === '') result.phone = undefined
  if (data.email === '') result.email = undefined
  return result
})

// Legacy schema for backward compatibility during migration
export const legacyStudentFormSchema = z.object({
  fullName: z
    .string()
    .min(2, 'الاسم يجب أن يكون على الأقل حرفين')
    .max(100, 'الاسم يجب أن لا يتجاوز 100 حرف'),
  parentName: z
    .string()
    .max(100, 'اسم الولي يجب أن لا يتجاوز 100 حرف')
    .optional(),
  phone: z
    .string()
    .optional(),
  address: z
    .string()
    .max(200, 'العنوان يجب أن لا يتجاوز 200 حرف')
    .optional(),
  dateOfBirth: z
    .string()
    .optional(),
  notes: z
    .string()
    .max(500, 'الملاحظات يجب أن لا تتجاوز 500 حرف')
    .optional()
})

// ===== Room Validations =====
const roomFeatureEnum = z.enum([
  ROOM_FEATURES.WHITEBOARD,
  ROOM_FEATURES.PROJECTOR,
  ROOM_FEATURES.AC,
  ROOM_FEATURES.COMPUTER,
  ROOM_FEATURES.SOUND_SYSTEM,
  ROOM_FEATURES.PRAYER_MATS,
  ROOM_FEATURES.QURAN_COPIES,
])

export const roomFormSchema = z.object({
  name: z
    .string()
    .min(2, 'اسم القاعة يجب أن يكون على الأقل حرفين')
    .max(100, 'اسم القاعة يجب أن لا يتجاوز 100 حرف'),
  capacity: z
    .number()
    .min(1, 'السعة يجب أن تكون 1 على الأقل')
    .max(500, 'السعة يجب أن لا تتجاوز 500'),
  description: z
    .string()
    .max(500, 'الوصف يجب أن لا يتجاوز 500 حرف')
    .optional(),
  location: z
    .string()
    .max(200, 'الموقع يجب أن لا يتجاوز 200 حرف')
    .optional(),
  features: z.array(roomFeatureEnum),
})

export const createRoomSchema = roomFormSchema

export const updateRoomSchema = roomFormSchema.partial().extend({
  isActive: z.boolean().optional(),
})

// ===== Session Template Validations =====
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/

// Base object schema (without refinement, so .partial() works in Zod v4)
const sessionTemplateBaseSchema = z.object({
  name: z
    .string()
    .min(2, 'اسم الحصة يجب أن يكون على الأقل حرفين')
    .max(100, 'اسم الحصة يجب أن لا يتجاوز 100 حرف'),
  teacherId: z
    .string()
    .min(1, 'المعلم مطلوب'),
  dayOfWeek: z
    .number()
    .min(0, 'يوم الأسبوع غير صالح')
    .max(6, 'يوم الأسبوع غير صالح'),
  startTime: z
    .string()
    .regex(timeRegex, 'صيغة الوقت غير صالحة (HH:mm)'),
  endTime: z
    .string()
    .regex(timeRegex, 'صيغة الوقت غير صالحة (HH:mm)'),
  qrOpenOffsetBeforeMin: z
    .number()
    .min(0, 'لا يمكن أن تكون القيمة سالبة')
    .max(60, 'لا يمكن أن تتجاوز 60 دقيقة')
    .optional(),
  qrCloseOffsetAfterMin: z
    .number()
    .min(0, 'لا يمكن أن تكون القيمة سالبة')
    .max(120, 'لا يمكن أن تتجاوز 120 دقيقة')
    .optional(),
  effectiveFromDate: z
    .string()
    .trim()
    .min(1, 'تاريخ البداية مطلوب')
    .refine(isValidCalendarIsoDate, 'تاريخ البداية غير صالح'),
  effectiveToDate: z
    .string()
    .trim()
    .optional()
    .refine(
      (s) => s === undefined || s === '' || isValidCalendarIsoDate(s),
      'تاريخ النهاية غير صالح'
    ),
  description: z
    .string()
    .max(500, 'الوصف يجب أن لا يتجاوز 500 حرف')
    .optional(),
  roomId: z
    .string()
    .optional()
})

// Form input schema with time validation refinement
export const sessionTemplateFormSchema = sessionTemplateBaseSchema.refine((data) => {
  const [startHour, startMin] = data.startTime.split(':').map(Number)
  const [endHour, endMin] = data.endTime.split(':').map(Number)
  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin
  return endMinutes > startMinutes
}, {
  message: 'وقت النهاية يجب أن يكون بعد وقت البداية',
  path: ['endTime']
})

// API schema with date transformation
export const createSessionTemplateSchema = sessionTemplateFormSchema.transform((data) => ({
  ...data,
  effectiveFromDate: parse(data.effectiveFromDate, 'yyyy-MM-dd', new Date()),
  effectiveToDate:
    data.effectiveToDate && data.effectiveToDate.length > 0
      ? parse(data.effectiveToDate, 'yyyy-MM-dd', new Date())
      : undefined,
}))

export const updateSessionTemplateSchema = sessionTemplateBaseSchema.partial().extend({
  isActive: z.boolean().optional()
})

// ===== Student Session Assignment =====
export const assignStudentToSessionSchema = z.object({
  studentId: z.string().min(1, 'الطالب مطلوب'),
  sessionTemplateId: z.string().min(1, 'الحصة مطلوبة')
})

export const bulkAssignStudentsSchema = z.object({
  studentIds: z.array(z.string()).min(1, 'اختر طالباً واحداً على الأقل'),
  sessionTemplateId: z.string().min(1, 'الحصة مطلوبة')
})

// ===== Attendance Validations =====
export const updateAttendanceSchema = z.object({
  status: z.enum([
    ATTENDANCE_STATUS.PRESENT,
    ATTENDANCE_STATUS.ABSENT,
    ATTENDANCE_STATUS.LATE,
    ATTENDANCE_STATUS.JUSTIFIED_ABSENCE
  ]),
  notes: z
    .string()
    .max(500, 'الملاحظات يجب أن لا تتجاوز 500 حرف')
    .optional()
})

export const checkInSchema = z.object({
  qrUuid: z.string().min(1, 'رمز QR مطلوب'),
  scannedAt: z.string().datetime().optional()
})

// Kiosk health heartbeat sent by scanner devices every few minutes
export const scannerHeartbeatSchema = z.object({
  deviceId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, 'معرّف الجهاز غير صالح'),
  appVersion: z.string().max(32).optional(),
  platform: z.string().max(16).optional(),
  batteryLevel: z.number().min(0).max(1).optional(),
  batteryCharging: z.boolean().optional(),
  pendingScans: z.number().int().min(0).max(100000).optional()
})

// ===== Session Occurrence =====
export const createSessionOccurrenceSchema = z.object({
  sessionTemplateId: z.string().min(1, 'قالب الحصة مطلوب'),
  date: z.string().transform(val => new Date(val)),
  notes: z.string().max(500).optional()
})

export const updateSessionOccurrenceSchema = z.object({
  status: z.enum([
    SESSION_STATUS.SCHEDULED,
    SESSION_STATUS.IN_PROGRESS,
    SESSION_STATUS.FINISHED,
    SESSION_STATUS.CANCELLED
  ]).optional(),
  notes: z.string().max(500).optional()
})

// ===== Report Filters =====
export const attendanceReportFilterSchema = z.object({
  teacherId: z.string().optional(),
  sessionTemplateId: z.string().optional(),
  studentId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  status: z.enum([
    ATTENDANCE_STATUS.PRESENT,
    ATTENDANCE_STATUS.ABSENT,
    ATTENDANCE_STATUS.LATE,
    ATTENDANCE_STATUS.JUSTIFIED_ABSENCE
  ]).optional()
})

// Type exports
export type RoomFormInput = z.infer<typeof roomFormSchema>
export type CreateRoomInput = z.infer<typeof createRoomSchema>
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type StudentFormInput = z.infer<typeof studentFormSchema>
export type CreateStudentInput = z.infer<typeof createStudentSchema>
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>
export type LegacyStudentFormInput = z.infer<typeof legacyStudentFormSchema>
export type SessionTemplateFormInput = z.infer<typeof sessionTemplateFormSchema>
export type CreateSessionTemplateInput = z.infer<typeof createSessionTemplateSchema>
export type UpdateSessionTemplateInput = z.infer<typeof updateSessionTemplateSchema>
export type AssignStudentToSessionInput = z.infer<typeof assignStudentToSessionSchema>
export type BulkAssignStudentsInput = z.infer<typeof bulkAssignStudentsSchema>
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>
export type CheckInInput = z.infer<typeof checkInSchema>
export type AttendanceReportFilterInput = z.infer<typeof attendanceReportFilterSchema>

