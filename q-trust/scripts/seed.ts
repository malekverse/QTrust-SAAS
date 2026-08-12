/**
 * Full database seed for QTrust — generous demo data across all collections.
 * Run: npx tsx scripts/seed.ts   or   pnpm seed
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

const MONGODB_URI = process.env.MONGODB_URI as string

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is not set!')
  console.error('   Create a .env.local file with: MONGODB_URI=your-mongodb-uri')
  process.exit(1)
}

// --- Enums (aligned with lib/constants + models) ---
const ROLES = ['ADMIN', 'TEACHER', 'STUDENT'] as const
const ACTIVITY_AREA_KEYS = [
  'QURAN_MEMORIZATION',
  'TAJWEED_QIRAAT',
  'QURAN_SCIENCES',
  'COMPETITIONS',
  'YEAR_ROUND_ACTIVITY',
] as const
const ATTENDANCE_STATUS = ['PRESENT', 'ABSENT', 'LATE', 'JUSTIFIED_ABSENCE'] as const
const ATTENDANCE_CREATOR = ['SYSTEM', 'TEACHER', 'ADMIN'] as const
const SESSION_STATUS = ['SCHEDULED', 'IN_PROGRESS', 'FINISHED', 'CANCELLED'] as const
const GRADE_TYPE = ['EXAM', 'MONTHLY_EVALUATION', 'ORAL_TEST', 'MEMORIZATION', 'TAJWEED'] as const
const CLAIM_STATUS = ['PENDING', 'APPROVED', 'REJECTED'] as const
const DOCUMENT_CATEGORIES = [
  'QURAN_STUDY',
  'TAJWEED',
  'MEMORIZATION_GUIDE',
  'EXAM_MATERIAL',
  'GENERAL',
  'COMPETITION',
  'OTHER',
] as const
const ROOM_FEATURES = [
  'WHITEBOARD',
  'PROJECTOR',
  'AC',
  'COMPUTER',
  'SOUND_SYSTEM',
  'PRAYER_MATS',
  'QURAN_COPIES',
] as const
const ACTIVITY_TYPES = [
  'ATTENDANCE_CHECK_IN',
  'STUDENT_CREATED',
  'STUDENT_UPDATED',
  'TEACHER_CREATED',
  'TEACHER_UPDATED',
  'SESSION_CREATED',
  'SESSION_UPDATED',
  'ATTENDANCE_UPDATED',
] as const

const DEFAULT_QR_OPEN = 60
const DEFAULT_QR_CLOSE = 60

// --- Inline schemas (standalone script; must match app models) ---
const UserSchema = new mongoose.Schema(
  {
    fullName: String,
    email: { type: String, unique: true, trim: true, lowercase: true },
    phone: { type: String, trim: true, sparse: true },
    role: { type: String, enum: ROLES, default: 'TEACHER' },
    passwordHash: String,
    isEmailVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', sparse: true },
  },
  { timestamps: true }
)

const StudentSchema = new mongoose.Schema(
  {
    enrollmentNumber: String,
    cin: String,
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    fatherName: String,
    gender: { type: String, enum: ['MALE', 'FEMALE'], required: true },
    profession: String,
    dateOfBirth: Date,
    placeOfBirth: String,
    educationLevel: String,
    address: String,
    phone: String,
    email: String,
    activityAreas: [{ type: String, enum: ACTIVITY_AREA_KEYS }],
    declarationAccepted: { type: Boolean, default: true },
    signatureLocation: String,
    signatureDate: Date,
    photoUrl: String,
    cinFrontUrl: String,
    cinBackUrl: String,
    parentEmail: String,
    parentPhone: String,
    parentName: String,
    qrUuid: { type: String, required: true, unique: true },
    isActive: { type: Boolean, default: true },
    notes: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', sparse: true },
    hasPortalAccess: { type: Boolean, default: false },
    fullName: String,
  },
  { timestamps: true }
)

const RoomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    capacity: { type: Number, required: true, min: 1, max: 500 },
    description: String,
    location: String,
    features: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

const SessionTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    qrOpenOffsetBeforeMin: { type: Number, default: DEFAULT_QR_OPEN, min: 0, max: 60 },
    qrCloseOffsetAfterMin: { type: Number, default: DEFAULT_QR_CLOSE, min: 0, max: 120 },
    isActive: { type: Boolean, default: true },
    effectiveFromDate: { type: Date, required: true },
    effectiveToDate: Date,
    description: String,
  },
  { timestamps: true }
)

const StudentSessionSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    sessionTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'SessionTemplate', required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)
StudentSessionSchema.index({ studentId: 1, sessionTemplateId: 1 }, { unique: true })

const SessionOccurrenceSchema = new mongoose.Schema(
  {
    sessionTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'SessionTemplate', required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    startDateTime: { type: Date, required: true },
    endDateTime: { type: Date, required: true },
    qrOpenDateTime: { type: Date, required: true },
    qrCloseDateTime: { type: Date, required: true },
    status: { type: String, enum: SESSION_STATUS, default: 'SCHEDULED' },
    notes: String,
  },
  { timestamps: true }
)

const AttendanceSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    sessionOccurrenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'SessionOccurrence', required: true },
    status: { type: String, enum: ATTENDANCE_STATUS, default: 'ABSENT' },
    checkInTime: Date,
    createdBy: { type: String, enum: ATTENDANCE_CREATOR, required: true },
    lastModifiedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastModifiedAt: Date,
    notes: String,
  },
  { timestamps: true }
)
AttendanceSchema.index({ studentId: 1, sessionOccurrenceId: 1 }, { unique: true })

const ActivityLogSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, enum: ACTIVITY_TYPES },
    description: { type: String, required: true },
    details: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'SessionTemplate' },
    metadata: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
)

const GradeSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    sessionTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'SessionTemplate' },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: GRADE_TYPE, required: true },
    title: { type: String, required: true },
    score: { type: Number, required: true, min: 0 },
    maxScore: { type: Number, required: true, min: 1 },
    date: { type: Date, required: true },
    notes: String,
    surah: String,
    fromVerse: { type: Number, min: 1 },
    toVerse: { type: Number, min: 1 },
    juz: { type: Number, min: 1, max: 30 },
  },
  { timestamps: true }
)

const TeacherFeedbackSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sessionOccurrenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'SessionOccurrence' },
    content: { type: String, required: true },
    isPositive: { type: Boolean, default: true },
    date: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
)

const LearningDocumentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: String,
    category: { type: String, enum: DOCUMENT_CATEGORIES, required: true },
    fileUrl: { type: String, required: true },
    fileType: { type: String, required: true },
    fileSize: Number,
    thumbnailUrl: String,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isPublic: { type: Boolean, default: true },
    targetStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
    targetSessions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SessionTemplate' }],
    downloadCount: { type: Number, default: 0 },
  },
  { timestamps: true }
)

const MonthlyPaymentSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, min: 2020 },
    isPaid: { type: Boolean, default: false },
    paidAt: Date,
    markedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount: { type: Number, min: 0 },
    notes: String,
  },
  { timestamps: true }
)
MonthlyPaymentSchema.index({ studentId: 1, month: 1, year: 1 }, { unique: true })

const AttendanceClaimSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    sessionOccurrenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'SessionOccurrence', required: true },
    date: { type: Date, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: CLAIM_STATUS, default: 'PENDING' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewNotes: String,
    reviewedAt: Date,
  },
  { timestamps: true }
)
AttendanceClaimSchema.index({ studentId: 1, sessionOccurrenceId: 1 }, { unique: true })

const SettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    description: String,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

const ToolCallSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    arguments: { type: mongoose.Schema.Types.Mixed, default: {} },
    result: mongoose.Schema.Types.Mixed,
  },
  { _id: false }
)
const ConversationMessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant', 'system', 'tool'], required: true },
    content: { type: String, default: '' },
    toolCalls: { type: [ToolCallSchema], default: undefined },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
)
const PendingActionSchema = new mongoose.Schema(
  {
    id: String,
    toolName: String,
    description: String,
    params: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'executed', 'failed'],
      default: 'pending',
    },
    result: mongoose.Schema.Types.Mixed,
    error: String,
    createdAt: { type: Date, default: Date.now },
    resolvedAt: Date,
  },
  { _id: false }
)
const ConversationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, default: 'محادثة جديدة', maxlength: 200 },
    messages: { type: [ConversationMessageSchema], default: [] },
    pendingActions: { type: [PendingActionSchema], default: [] },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
  },
  { timestamps: true }
)

const User = mongoose.models.User || mongoose.model('User', UserSchema)
const Student = mongoose.models.Student || mongoose.model('Student', StudentSchema)
const Room = mongoose.models.Room || mongoose.model('Room', RoomSchema)
const SessionTemplate = mongoose.models.SessionTemplate || mongoose.model('SessionTemplate', SessionTemplateSchema)
const StudentSession = mongoose.models.StudentSession || mongoose.model('StudentSession', StudentSessionSchema)
const SessionOccurrence = mongoose.models.SessionOccurrence || mongoose.model('SessionOccurrence', SessionOccurrenceSchema)
const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema)
const ActivityLog = mongoose.models.ActivityLog || mongoose.model('ActivityLog', ActivityLogSchema)
const Grade = mongoose.models.Grade || mongoose.model('Grade', GradeSchema)
const TeacherFeedback = mongoose.models.TeacherFeedback || mongoose.model('TeacherFeedback', TeacherFeedbackSchema)
const LearningDocument = mongoose.models.LearningDocument || mongoose.model('LearningDocument', LearningDocumentSchema)
const MonthlyPayment = mongoose.models.MonthlyPayment || mongoose.model('MonthlyPayment', MonthlyPaymentSchema)
const AttendanceClaim = mongoose.models.AttendanceClaim || mongoose.model('AttendanceClaim', AttendanceClaimSchema)
const Settings = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema)
const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', ConversationSchema)

// --- Helpers ---
function stripTime(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(arr: readonly T[] | T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MALE_FIRST = [
  'يوسف',
  'عمر',
  'محمد',
  'إبراهيم',
  'أنس',
  'زيد',
  'سعد',
  'طارق',
  'كريم',
  'بلال',
  'حسام',
  'مالك',
  'ياسين',
  'آدم',
  'نوح',
  'هارون',
  'سليمان',
  'حامد',
  'فهد',
  'راشد',
  'سفيان',
  'وليد',
  'نورالدين',
  'جاسم',
  'هشام',
  'بشير',
  'عادل',
  'منير',
  'صابر',
  'لطفي',
  'حاتم',
  'فيصل',
  'عماد',
  'شادي',
  'رامي',
]
const FEMALE_FIRST = [
  'فاطمة',
  'مريم',
  'آمنة',
  'خديجة',
  'زينب',
  'سارة',
  'نور',
  'ليلى',
  'هند',
  'سلمى',
  'رحمة',
  'شيماء',
  'ياسمين',
  'نادية',
  'أمال',
  'حفصة',
  'عائشة',
  'صفاء',
  'إيناس',
  'رانيا',
  'سندس',
  'بسمة',
  'غادة',
  'هناء',
  'كنزة',
  'سومية',
]
const LAST_NAMES = [
  'الأحمد',
  'بن علي',
  'السالم',
  'الطرابلسي',
  'الصيد',
  'العبيدي',
  'الشابي',
  'المزروعي',
  'الغرياني',
  'الكافي',
  'النفطي',
  'الحجاجي',
  'المرابط',
  'القاسمي',
  'الزهراني',
  'الدوسري',
  'المنصوري',
  'الرفاعي',
  'الهادي',
  'الجموسي',
]

const EDUCATION_LEVELS = ['ابتدائي', 'إعدادي', 'ثانوي', 'جامعي', 'ماجستير', 'دكتوراه', 'أخرى'] as const
const PLACES = ['صفاقس', 'تونس', 'سوسة', 'المنستير', 'قابس', 'بنزرت', 'نابل', 'المهدية', 'جندوبة', 'القيروان']
const STREETS = ['شارع الحبيب بورقيبة', 'شارع الجمهورية', 'حي النور', 'حي الزهور', 'حي الرياض', 'المدينة العتيقة', 'شارع فلسطين']

const SURAH_NAMES = [
  'الفاتحة',
  'البقرة',
  'آل عمران',
  'النساء',
  'المائدة',
  'الأنعام',
  'الأعراف',
  'التوبة',
  'يونس',
  'هود',
  'يوسف',
  'الرعد',
  'إبراهيم',
  'الحجر',
  'النحل',
  'الإسراء',
  'الكهف',
  'مريم',
  'طه',
  'الأنبياء',
]

const FEEDBACK_POSITIVE = [
  'أداء ممتاز في الحفظ، بارك الله فيه.',
  'يحرص على المراجعة ويظهر تقدماً ملحوظاً في التجويد.',
  'مشاركة فعّالة في الحلقة ومتابعة جيدة للواجبات.',
  'حضور منتظم وسلوك مثالي، نفخر به.',
  'تحسن واضح في مخارج الحروف هذا الشهر.',
  'حفظ متقن لسورة جديدة مع مراعاة الوقف والابتداء.',
  'يحفّز زملاءه ويظهر روحاً إيجابية.',
  'مبادرة جيدة في طرح الأسئلة حول المعاني.',
]

const FEEDBACK_NEGATIVE = [
  'يحتاج إلى مزيد من الممارسة اليومية خارج الحلقة.',
  'التأخر المتكرر يؤثر على تقدم الحفظ.',
  'ينصح بمراجعة قواعد المد والقصر.',
  'التركيز أثناء الحصة يحتاج تحسيناً.',
  'الواجب المنزلي لم يُنجز عدة مرات.',
]

const CLAIM_REASONS = [
  'تأخرت عن الحصة بسبب ظرف عائلي طارئ.',
  'كنت مريضاً ولدي تقرير طبي.',
  'تعطل النقل ولم أتمكن من الوصول في الوقت.',
  'سجّلت حضوري لكن يبدو أن هناك خطأ في النظام.',
  'كنت حاضراً في القاعة المجاورة بالخطأ في البداية.',
  'ظروف عمل الوالد منعت الوصول في الوقت المحدد.',
]

const ROOM_SEED = [
  { name: 'قاعة الفاتحة', cap: 45, loc: 'الطابق الأول - المدخل الرئيسي' },
  { name: 'قاعة البقرة', cap: 50, loc: 'الطابق الأول - الجناح الشرقي' },
  { name: 'قاعة آل عمران', cap: 35, loc: 'الطابق الثاني' },
  { name: 'قاعة النساء', cap: 40, loc: 'الطابق الثاني - بجانب المكتبة' },
  { name: 'قاعة المائدة', cap: 28, loc: 'الطابق الأرضي' },
  { name: 'قاعة الأنعام', cap: 22, loc: 'الطابق الأرضي - الجناح الغربي' },
  { name: 'قاعة الأعراف', cap: 30, loc: 'ملحق المبنى' },
]

const SLOT_TIMES: { start: string; end: string; label: string }[] = [
  { start: '08:00', end: '10:00', label: 'صباحية' },
  { start: '14:00', end: '16:00', label: 'بعد الظهر' },
  { start: '17:30', end: '19:30', label: 'مسائية' },
]

const DAY_NAMES_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

async function seed() {
  const rng = mulberry32(20260216)

  try {
    console.log('🌱 Connecting to MongoDB...')
    await mongoose.connect(MONGODB_URI)
    console.log('✅ Connected')

    console.log('🧹 Clearing collections...')
    await Promise.all([
      AttendanceClaim.deleteMany({}),
      Attendance.deleteMany({}),
      MonthlyPayment.deleteMany({}),
      Grade.deleteMany({}),
      TeacherFeedback.deleteMany({}),
      LearningDocument.deleteMany({}),
      ActivityLog.deleteMany({}),
      SessionOccurrence.deleteMany({}),
      StudentSession.deleteMany({}),
      SessionTemplate.deleteMany({}),
      Conversation.deleteMany({}),
      Student.deleteMany({}),
      User.deleteMany({}),
      Room.deleteMany({}),
      Settings.deleteMany({}),
    ])

    const adminPass = await bcrypt.hash('admin123', 12)
    const teacherPass = await bcrypt.hash('teacher123', 12)
    const studentPass = await bcrypt.hash('student123', 12)

    console.log('👤 Creating admin...')
    const admin = await User.create({
      fullName: 'المدير العام',
      email: 'admin@quran-sfax.org',
      phone: '+21690000001',
      role: 'ADMIN',
      passwordHash: adminPass,
      isEmailVerified: true,
      isActive: true,
      mustChangePassword: false,
    })

    console.log('👨‍🏫 Creating 7 teachers...')
    const teacherNames = [
      'أحمد بن محمد',
      'محمود السالم',
      'خالد العربي',
      'علي المرابط',
      'سامي الفرجاني',
      'نور الدين الشابي',
      'طارق المنصوري',
    ]
    const teachers = await User.insertMany(
      teacherNames.map((fullName, i) => ({
        fullName,
        email: `teacher${i + 1}@quran-sfax.org`,
        phone: `+21691${String(100000 + i).slice(-6)}`,
        role: 'TEACHER',
        passwordHash: teacherPass,
        isEmailVerified: true,
        isActive: true,
        mustChangePassword: false,
      }))
    )

    const year = new Date().getFullYear()
    await Settings.create({
      key: 'enrollment',
      value: {
        format: '{YEAR}-{SEQ}',
        prefix: '',
        sequencePadding: 3,
        resetSequenceYearly: true,
        currentSequence: 60,
        lastResetYear: year,
      },
      description: 'إعدادات ترقيم الانخراط',
      updatedBy: admin._id,
    })

    console.log('🚪 Creating 7 rooms...')
    const rooms = await Room.insertMany(
      ROOM_SEED.map((r, i) => ({
        name: r.name,
        capacity: r.cap,
        description: `قاعة دراسة قرآنية مجهزة — ${r.loc}`,
        location: r.loc,
        features: ROOM_FEATURES.filter((_, j) => (i + j) % 3 !== 0),
        isActive: true,
      }))
    )

    console.log('🎓 Creating 60 students...')
    const studentsData: {
      firstName: string
      lastName: string
      gender: 'MALE' | 'FEMALE'
      cin: string
      phone: string
      email: string
      fatherName: string
      parentName: string
      parentPhone: string
      parentEmail: string
      enrollmentNumber: string
    }[] = []

    for (let i = 0; i < 60; i++) {
      const isMale = i < 35
      const firstName = isMale ? MALE_FIRST[i % MALE_FIRST.length]! : FEMALE_FIRST[i % FEMALE_FIRST.length]!
      const lastName = LAST_NAMES[i % LAST_NAMES.length]!
      const seq = String(i + 1).padStart(3, '0')
      const enrollmentNumber = `${year}-${seq}`
      const cin = String(10000000 + i).padStart(8, '0')
      const phone = `+216${String(92000000 + i).slice(-8)}`
      const email = `student.demo${i + 1}@example.com`
      const fatherName = `${pick(MALE_FIRST)} ${lastName}`
      const parentName = `${pick(MALE_FIRST)} بن ${pick(LAST_NAMES)}`
      const parentPhone = `+216${String(93000000 + i).slice(-8)}`
      const parentEmail = `parent${i + 1}@example.com`
      studentsData.push({
        firstName,
        lastName,
        gender: isMale ? 'MALE' : 'FEMALE',
        cin,
        phone,
        email,
        fatherName,
        parentName,
        parentPhone,
        parentEmail,
        enrollmentNumber,
      })
    }

    const students = await Student.insertMany(
      studentsData.map((s, i) => {
        const n = 1 + (i % 3)
        const areas = ACTIVITY_AREA_KEYS.filter((_, j) => j < n || j === i % 5)
        const unique = [...new Set(areas)].slice(0, 3) as string[]
        return {
          ...s,
          profession: 'طالب',
          dateOfBirth: new Date(2005 + (i % 10), (i % 12), 1 + (i % 20)),
          placeOfBirth: PLACES[i % PLACES.length],
          educationLevel: EDUCATION_LEVELS[i % EDUCATION_LEVELS.length],
          address: `${pick(STREETS)}، ${pick(PLACES)}`,
          activityAreas: unique,
          declarationAccepted: true,
          signatureLocation: 'صفاقس',
          signatureDate: addDays(new Date(), -randomInt(30, 200)),
          photoUrl: `https://placehold.co/200x200?text=${encodeURIComponent(s.firstName)}`,
          cinFrontUrl: `https://placehold.co/400x250?text=CIN+Front+${i + 1}`,
          cinBackUrl: `https://placehold.co/400x250?text=CIN+Back+${i + 1}`,
          qrUuid: randomUUID(),
          isActive: true,
          hasPortalAccess: false,
          notes: i % 7 === 0 ? 'طالب متميز — يُنصح بالمشاركة في المسابقات' : undefined,
          fullName: `${s.firstName} ${s.lastName}`,
        }
      })
    )
    console.log('🔐 Creating 10 student portal accounts...')
    const portalCount = 10
    const studentUsers: mongoose.Document[] = []
    for (let i = 0; i < portalCount; i++) {
      const st = students[i]!
      const u = await User.create({
        fullName: `${st.firstName} ${st.lastName}`,
        email: `student${i + 1}@quran-sfax.org`,
        phone: st.phone,
        role: 'STUDENT',
        passwordHash: studentPass,
        isEmailVerified: true,
        isActive: true,
        mustChangePassword: false,
        studentId: st._id,
      })
      studentUsers.push(u)
      await Student.updateOne(
        { _id: st._id },
        { $set: { userId: u._id, hasPortalAccess: true } }
      )
    }

    console.log('📅 Creating 21 session templates (3 × 7 days)...')
    const templatesPayload: Record<string, unknown>[] = []
    let tIdx = 0
    const effectiveFrom = new Date('2025-09-01')
    for (let dow = 0; dow < 7; dow++) {
      for (let slot = 0; slot < 3; slot++) {
        const times = SLOT_TIMES[slot]!
        const teacher = teachers[tIdx % teachers.length]!
        const room = rooms[tIdx % rooms.length]!
        const qrOpen = 15 + (tIdx % 4) * 10
        const qrClose = 30 + (tIdx % 3) * 15
        templatesPayload.push({
          name: `حلقة ${['حفظ', 'تجويد', 'مراجعة', 'علوم', 'تحضير مسابقة'][slot % 5]} — ${DAY_NAMES_AR[dow]} ${times.label}`,
          teacherId: teacher._id,
          roomId: room._id,
          dayOfWeek: dow,
          startTime: times.start,
          endTime: times.end,
          qrOpenOffsetBeforeMin: Math.min(60, qrOpen),
          qrCloseOffsetAfterMin: Math.min(120, qrClose),
          isActive: true,
          effectiveFromDate: effectiveFrom,
          description: `حصة أسبوعية يوم ${DAY_NAMES_AR[dow]} من ${times.start} إلى ${times.end}. القاعة: ${room.name}. يشرف عليها الأستاذ ${teacher.fullName}.`,
        })
        tIdx++
      }
    }
    const sessionTemplates = await SessionTemplate.insertMany(templatesPayload)

    console.log('📝 Assigning students to sessions (4–8 each, 15–30 per session)...')
    const templateIds = sessionTemplates.map((t) => t._id)
    const perStudent = new Map<string, number>()
    const perTemplate = new Map<string, number>()
    templateIds.forEach((id) => perTemplate.set(id.toString(), 0))
    students.forEach((s) => perStudent.set(s._id.toString(), 0))

    const assignments: { studentId: mongoose.Types.ObjectId; sessionTemplateId: mongoose.Types.ObjectId; isActive: boolean }[] = []
    const seen = new Set<string>()

    function addAssignment(sid: mongoose.Types.ObjectId, tid: mongoose.Types.ObjectId) {
      const key = `${sid}-${tid}`
      if (seen.has(key)) return
      seen.add(key)
      assignments.push({ studentId: sid, sessionTemplateId: tid, isActive: true })
      perStudent.set(sid.toString(), (perStudent.get(sid.toString()) || 0) + 1)
      perTemplate.set(tid.toString(), (perTemplate.get(tid.toString()) || 0) + 1)
    }

    for (let si = 0; si < students.length; si++) {
      const sid = students[si]!._id
      const count = 4 + (si % 5)
      const start = (si * 5) % templateIds.length
      for (let k = 0; k < count; k++) {
        addAssignment(sid, templateIds[(start + k) % templateIds.length]!)
      }
    }

    for (let ti = 0; ti < templateIds.length; ti++) {
      const tid = templateIds[ti]!
      let guard = 0
      while ((perTemplate.get(tid.toString()) || 0) < 15 && guard++ < 500) {
        const si = randomInt(0, students.length - 1)
        addAssignment(students[si]!._id, tid)
      }
    }

    for (const s of students) {
      let guard = 0
      while ((perStudent.get(s._id.toString()) || 0) < 4 && guard++ < 200) {
        addAssignment(s._id, templateIds[randomInt(0, templateIds.length - 1)]!)
      }
    }

    await StudentSession.insertMany(assignments)
    console.log(`   ✅ ${assignments.length} enrollments`)

    const assignmentByTemplate = new Map<string, mongoose.Types.ObjectId[]>()
    for (const a of assignments) {
      const k = a.sessionTemplateId.toString()
      if (!assignmentByTemplate.has(k)) assignmentByTemplate.set(k, [])
      assignmentByTemplate.get(k)!.push(a.studentId)
    }

    console.log('📆 Creating session occurrences (90 past + 21 future)...')
    const today = stripTime(new Date())
    const occurrences: Record<string, unknown>[] = []

    for (let offset = -90; offset <= 21; offset++) {
      const date = addDays(today, offset)
      const dow = date.getDay()
      for (const tmpl of sessionTemplates) {
        if (tmpl.dayOfWeek !== dow) continue
        const [sh, sm] = tmpl.startTime.split(':').map(Number)
        const [eh, em] = tmpl.endTime.split(':').map(Number)
        const startDateTime = new Date(date)
        startDateTime.setHours(sh!, sm!, 0, 0)
        const endDateTime = new Date(date)
        endDateTime.setHours(eh!, em!, 0, 0)
        const openMin = tmpl.qrOpenOffsetBeforeMin ?? DEFAULT_QR_OPEN
        const closeMin = tmpl.qrCloseOffsetAfterMin ?? DEFAULT_QR_CLOSE
        const qrOpenDateTime = new Date(startDateTime.getTime() - openMin * 60 * 1000)
        const qrCloseDateTime = new Date(endDateTime.getTime() + closeMin * 60 * 1000)

        let status: (typeof SESSION_STATUS)[number] = 'SCHEDULED'
        let notes: string | undefined
        if (offset < 0) {
          if (rng() < 0.05) {
            status = 'CANCELLED'
            notes = 'تم إلغاء الحصة لظرف طارئ.'
          } else {
            status = 'FINISHED'
          }
        } else if (offset === 0) {
          const now = Date.now()
          if (now >= qrOpenDateTime.getTime() && now <= endDateTime.getTime()) status = 'IN_PROGRESS'
          else if (now > endDateTime.getTime()) status = 'FINISHED'
          else status = 'SCHEDULED'
        } else {
          status = 'SCHEDULED'
        }

        occurrences.push({
          sessionTemplateId: tmpl._id,
          teacherId: tmpl.teacherId,
          date,
          startDateTime,
          endDateTime,
          qrOpenDateTime,
          qrCloseDateTime,
          status,
          notes,
        })
      }
    }

    const createdOccurrences = await SessionOccurrence.insertMany(occurrences)
    console.log(`   ✅ ${createdOccurrences.length} occurrences`)

    console.log('✅ Creating attendance (finished sessions only)...')
    const attendanceBatch: Record<string, unknown>[] = []

    for (const occ of createdOccurrences) {
      if ((occ as { status: string }).status !== 'FINISHED') continue
      const tid = (occ as { sessionTemplateId: mongoose.Types.ObjectId }).sessionTemplateId.toString()
      const studs = assignmentByTemplate.get(tid) || []
      const startDt = (occ as { startDateTime: Date }).startDateTime
      for (const studentId of studs) {
        const r = rng()
        let status: (typeof ATTENDANCE_STATUS)[number]
        if (r < 0.55) status = 'PRESENT'
        else if (r < 0.75) status = 'LATE'
        else if (r < 0.9) status = 'ABSENT'
        else status = 'JUSTIFIED_ABSENCE'

        let checkInTime: Date | undefined
        if (status === 'PRESENT') {
          checkInTime = new Date(startDt.getTime() - randomInt(1, 10) * 60 * 1000)
        } else if (status === 'LATE') {
          checkInTime = new Date(startDt.getTime() + randomInt(5, 25) * 60 * 1000)
        }

        const cr = rng()
        const createdBy =
          cr < 0.7 ? 'SYSTEM' : cr < 0.9 ? 'TEACHER' : 'ADMIN'
        const notes =
          status === 'JUSTIFIED_ABSENCE'
            ? 'عذر مقبول — ظرف عائلي'
            : status === 'ABSENT' && rng() < 0.15
              ? 'لم يُعلّل الغياب'
              : undefined

        attendanceBatch.push({
          studentId,
          sessionOccurrenceId: occ._id,
          status,
          checkInTime,
          createdBy,
          notes,
        })
      }
    }

    const chunk = 2000
    for (let i = 0; i < attendanceBatch.length; i += chunk) {
      await Attendance.insertMany(attendanceBatch.slice(i, i + chunk))
    }
    console.log(`   ✅ ${attendanceBatch.length} attendance rows`)

    console.log('📊 Creating grades (200+)...')
    const grades: Record<string, unknown>[] = []
    const gradeTitles: Record<string, string> = {
      EXAM: 'اختبار',
      MONTHLY_EVALUATION: 'تقييم شهري',
      ORAL_TEST: 'اختبار شفهي',
      MEMORIZATION: 'حفظ',
      TAJWEED: 'تجويد',
    }
    for (let si = 0; si < students.length; si++) {
      const st = students[si]!
      const nGrades = 4 + (si % 2)
      for (let g = 0; g < nGrades; g++) {
        const type = GRADE_TYPE[(si + g) % GRADE_TYPE.length]!
        const teacher = teachers[(si + g) % teachers.length]!
        const tmpl = sessionTemplates[(si + g) % sessionTemplates.length]!
        const maxScore = type === 'EXAM' ? 20 : type === 'MONTHLY_EVALUATION' ? 20 : 10
        const ratio = 0.55 + rng() * 0.35
        const score = Math.round(maxScore * ratio * 10) / 10
        const surah = pick(SURAH_NAMES)
        const fromVerse = 1 + (si % 5)
        const toVerse = fromVerse + 3 + (g % 4)
        const juz = 1 + ((si + g) % 30)
        grades.push({
          studentId: st._id,
          sessionTemplateId: tmpl._id,
          teacherId: teacher._id,
          type,
          title: `${gradeTitles[type]} — ${surah} (${st.firstName})`,
          score,
          maxScore,
          date: addDays(new Date(), -randomInt(5, 120)),
          notes: 'ملاحظات المعلم على الأداء والمستوى.',
          surah,
          fromVerse,
          toVerse,
          juz,
        })
      }
    }
    await Grade.insertMany(grades)
    console.log(`   ✅ ${grades.length} grades`)

    console.log('💬 Creating teacher feedback (120+)...')
    const feedbacks: Record<string, unknown>[] = []
    const finishedOccs = createdOccurrences.filter((o) => (o as { status: string }).status === 'FINISHED')
    for (let i = 0; i < 120; i++) {
      const st = students[i % students.length]!
      const teacher = teachers[i % teachers.length]!
      const positive = rng() < 0.75
      const content = positive ? pick(FEEDBACK_POSITIVE) : pick(FEEDBACK_NEGATIVE)
      const occ = finishedOccs.length ? pick(finishedOccs) : null
      feedbacks.push({
        studentId: st._id,
        teacherId: teacher._id,
        sessionOccurrenceId: occ?._id,
        content,
        isPositive: positive,
        date: addDays(new Date(), -randomInt(1, 60)),
      })
    }
    await TeacherFeedback.insertMany(feedbacks)
    console.log(`   ✅ ${feedbacks.length} feedback entries`)

    console.log('💳 Creating monthly payments (Sep 2025 – Apr 2026)...')
    const paymentMonths: { month: number; year: number }[] = [
      { month: 9, year: 2025 },
      { month: 10, year: 2025 },
      { month: 11, year: 2025 },
      { month: 12, year: 2025 },
      { month: 1, year: 2026 },
      { month: 2, year: 2026 },
      { month: 3, year: 2026 },
      { month: 4, year: 2026 },
    ]
    const payments: Record<string, unknown>[] = []
    for (const st of students) {
      paymentMonths.forEach((my, mi) => {
        const recent = mi >= paymentMonths.length - 2
        const paidBase = recent ? 0.55 : 0.78
        const isPaid = rng() < paidBase
        const amount = 30 + randomInt(0, 20)
        payments.push({
          studentId: st._id,
          month: my.month,
          year: my.year,
          isPaid,
          paidAt: isPaid ? addDays(new Date(), -randomInt(1, 40)) : undefined,
          markedByUserId: isPaid ? admin._id : undefined,
          amount: isPaid ? amount : undefined,
          notes: !isPaid && recent ? 'قيد المتابعة' : undefined,
        })
      })
    }
    await MonthlyPayment.insertMany(payments)
    console.log(`   ✅ ${payments.length} payments`)

    console.log('⚠️ Creating attendance claims...')
    const absencesForClaims: { occ: (typeof createdOccurrences)[0]; studentId: mongoose.Types.ObjectId }[] = []
    for (const occ of createdOccurrences) {
      if ((occ as { status: string }).status !== 'FINISHED') continue
      const tid = (occ as { sessionTemplateId: mongoose.Types.ObjectId }).sessionTemplateId.toString()
      const studs = assignmentByTemplate.get(tid) || []
      for (const studentId of studs) {
        if (rng() < 0.03) absencesForClaims.push({ occ, studentId })
      }
    }

    const claims: Record<string, unknown>[] = []
    const usedClaimPairs = new Set<string>()
    let ci = 0
    for (const { occ, studentId } of absencesForClaims) {
      const key = `${studentId}-${occ._id}`
      if (usedClaimPairs.has(key)) continue
      usedClaimPairs.add(key)
      if (claims.length >= 30) break
      let status: (typeof CLAIM_STATUS)[number]
      if (ci < 9) status = 'PENDING'
      else if (ci < 21) status = 'APPROVED'
      else status = 'REJECTED'
      ci++
      claims.push({
        studentId,
        sessionOccurrenceId: occ._id,
        date: (occ as { date: Date }).date,
        reason: pick(CLAIM_REASONS),
        status,
        reviewedBy: status !== 'PENDING' ? admin._id : undefined,
        reviewNotes:
          status === 'APPROVED'
            ? 'تم التحقق وقبول الاعتراض.'
            : status === 'REJECTED'
              ? 'لا تتوفر أدلة كافية.'
              : undefined,
        reviewedAt: status !== 'PENDING' ? addDays(new Date(), -randomInt(1, 14)) : undefined,
      })
    }
    let claimFillAttempts = 0
    while (claims.length < 25 && claimFillAttempts < 400) {
      claimFillAttempts++
      const occ = pick(finishedOccs)
      const tid = (occ as { sessionTemplateId: mongoose.Types.ObjectId }).sessionTemplateId.toString()
      const studs = assignmentByTemplate.get(tid) || []
      if (!studs.length) continue
      const studentId = pick(studs)
      const key = `${studentId}-${occ._id}`
      if (usedClaimPairs.has(key)) continue
      usedClaimPairs.add(key)
      claims.push({
        studentId,
        sessionOccurrenceId: occ._id,
        date: (occ as { date: Date }).date,
        reason: pick(CLAIM_REASONS),
        status: 'PENDING',
      })
    }
    await AttendanceClaim.insertMany(claims)
    console.log(`   ✅ ${claims.length} claims`)

    console.log('📚 Creating learning documents...')
    const docSpecs: {
      title: string
      category: (typeof DOCUMENT_CATEGORIES)[number]
      fileType: string
      isPublic: boolean
    }[] = [
      { title: 'مقدمة في أحكام النون الساكنة والتنوين', category: 'TAJWEED', fileType: 'pdf', isPublic: true },
      { title: 'خطة حفظ شهرية — المستوى المتوسط', category: 'MEMORIZATION_GUIDE', fileType: 'pdf', isPublic: true },
      { title: 'أسئلة اختبار نصف الموسم', category: 'EXAM_MATERIAL', fileType: 'pdf', isPublic: true },
      { title: 'تسجيلات تجويد — ورشة عمل', category: 'TAJWEED', fileType: 'mp3', isPublic: true },
      { title: 'دراسات تفسيرية موجزة — سورة الكهف', category: 'QURAN_STUDY', fileType: 'docx', isPublic: true },
      { title: 'دليل المشارك في مسابقة القرآن', category: 'COMPETITION', fileType: 'pdf', isPublic: true },
      { title: 'لائحة النظام الداخلي للحلقات', category: 'GENERAL', fileType: 'pdf', isPublic: true },
      { title: 'تمارين عملية على المدود', category: 'TAJWEED', fileType: 'pdf', isPublic: false },
      { title: 'مذكرة حفظ — الجزء الثامن', category: 'MEMORIZATION_GUIDE', fileType: 'pdf', isPublic: false },
      { title: 'مواد مراجعة — الجزء الأول', category: 'EXAM_MATERIAL', fileType: 'pdf', isPublic: true },
      { title: 'محاضرة علوم القرآن — الناسخ والمنسوخ', category: 'QURAN_STUDY', fileType: 'pdf', isPublic: true },
      { title: 'نصائح للمشاركين في المسابقة المحلية', category: 'COMPETITION', fileType: 'pdf', isPublic: true },
      { title: 'ملحق: مصطلحات التجويد', category: 'OTHER', fileType: 'pdf', isPublic: true },
      { title: 'جدول مراجعة أسبوعي', category: 'GENERAL', fileType: 'xlsx', isPublic: true },
      { title: 'فيديو: طريقة أداء الميم والنون المشددتين', category: 'TAJWEED', fileType: 'mp4', isPublic: true },
      { title: 'ورقة عمل — سورة الملك', category: 'QURAN_STUDY', fileType: 'pdf', isPublic: false },
      { title: 'نماذج اختبارات شفهية', category: 'EXAM_MATERIAL', fileType: 'pdf', isPublic: true },
      { title: 'دليل الحفظ السريع للمبتدئين', category: 'MEMORIZATION_GUIDE', fileType: 'pdf', isPublic: true },
      { title: 'تكريم الفائزين — ألبوم صور', category: 'COMPETITION', fileType: 'pdf', isPublic: true },
      { title: 'سياسة استخدام المكتبة الرقمية', category: 'GENERAL', fileType: 'pdf', isPublic: true },
      { title: 'مراجع إضافية للبحث', category: 'OTHER', fileType: 'pdf', isPublic: true },
    ]

    const documents = await LearningDocument.insertMany(
      docSpecs.map((d, i) => ({
        title: d.title,
        description: `وثيقة تعليمية — ${d.category}. رفع تلقائي للعرض التجريبي.`,
        category: d.category,
        fileUrl: `https://example.com/qtrust-docs/${i + 1}.${d.fileType}`,
        fileType: d.fileType,
        fileSize: 50000 + randomInt(0, 500000),
        thumbnailUrl: i % 3 === 0 ? `https://placehold.co/320x180?text=Doc+${i + 1}` : undefined,
        uploadedBy: admin._id,
        isPublic: d.isPublic,
        targetStudents: d.isPublic ? [] : [students[i % students.length]!._id, students[(i + 1) % students.length]!._id],
        targetSessions: d.isPublic ? [] : [sessionTemplates[i % sessionTemplates.length]!._id],
        downloadCount: randomInt(0, 200),
      }))
    )
    console.log(`   ✅ ${documents.length} documents`)

    console.log('📋 Creating activity logs (150+)...')
    type LogRow = {
      type: string
      description: string
      details?: string
      userId?: mongoose.Types.ObjectId
      studentId?: mongoose.Types.ObjectId
      sessionId?: mongoose.Types.ObjectId
      metadata?: Record<string, unknown>
      createdAt: Date
      updatedAt: Date
    }
    const logs: LogRow[] = []
    const pushLog = (
      type: (typeof ACTIVITY_TYPES)[number],
      description: string,
      at: Date,
      opts?: Omit<LogRow, 'type' | 'description' | 'createdAt' | 'updatedAt'>
    ) => {
      logs.push({ type, description, createdAt: at, updatedAt: at, ...opts })
    }

    teachers.forEach((t, i) => {
      pushLog('TEACHER_CREATED', t.fullName as string, addDays(new Date(), -80 + i), {
        details: 'معلم جديد',
        userId: admin._id as mongoose.Types.ObjectId,
      })
    })

    sessionTemplates.forEach((s, i) => {
      pushLog('SESSION_CREATED', s.name as string, addDays(new Date(), -70 + (i % 30)), {
        sessionId: s._id as mongoose.Types.ObjectId,
        userId: admin._id as mongoose.Types.ObjectId,
      })
    })

    students.forEach((st, i) => {
      pushLog('STUDENT_CREATED', `${st.firstName} ${st.lastName}` as string, addDays(new Date(), -85 + (i % 60)), {
        studentId: st._id as mongoose.Types.ObjectId,
        userId: admin._id as mongoose.Types.ObjectId,
      })
    })

    for (let i = 0; i < 15; i++) {
      const st = students[i]!
      pushLog('STUDENT_UPDATED', `تحديث بيانات ${st.firstName}`, addDays(new Date(), -20 - i), {
        studentId: st._id as mongoose.Types.ObjectId,
        userId: admin._id as mongoose.Types.ObjectId,
        details: 'تعديل بيانات الاتصال',
      })
    }

    for (let i = 0; i < 12; i++) {
      const t = teachers[i % teachers.length]!
      pushLog('TEACHER_UPDATED', `تحديث ملف ${t.fullName}`, addDays(new Date(), -15 - i), {
        userId: admin._id as mongoose.Types.ObjectId,
        details: 'تحديث معلومات الاتصال',
      })
    }

    for (let i = 0; i < 12; i++) {
      const s = sessionTemplates[i % sessionTemplates.length]!
      pushLog('SESSION_UPDATED', `تعديل إعدادات: ${s.name}`, addDays(new Date(), -10 - i), {
        sessionId: s._id as mongoose.Types.ObjectId,
        userId: admin._id as mongoose.Types.ObjectId,
      })
    }

    for (let i = 0; i < 12; i++) {
      pushLog('ATTENDANCE_UPDATED', 'تعديل سجل حضور', addDays(new Date(), -7 - i), {
        userId: teachers[i % teachers.length]!._id as mongoose.Types.ObjectId,
        details: 'تغيير حالة من غائب إلى متأخر',
      })
    }

    for (let i = 0; i < 65; i++) {
      const st = students[i % students.length]!
      const tmpl = sessionTemplates[i % sessionTemplates.length]!
      pushLog('ATTENDANCE_CHECK_IN', `${st.firstName} ${st.lastName}`, addDays(new Date(), -randomInt(0, 45)), {
        studentId: st._id as mongoose.Types.ObjectId,
        sessionId: tmpl._id as mongoose.Types.ObjectId,
        details: tmpl.name as string,
      })
    }

    await ActivityLog.collection.insertMany(logs as unknown as Record<string, unknown>[])
    console.log(`   ✅ ${logs.length} activity logs`)

    console.log('\n✨ Seed completed successfully!')
    console.log('\n📋 Summary:')
    console.log(`   Users:           1 admin + 7 teachers + ${portalCount} students = ${1 + 7 + portalCount}`)
    console.log(`   Rooms:           ${rooms.length}`)
    console.log(`   Students:        ${students.length}`)
    console.log(`   Session templates: ${sessionTemplates.length}`)
    console.log(`   Enrollments:     ${assignments.length}`)
    console.log(`   Occurrences:     ${createdOccurrences.length}`)
    console.log(`   Attendance:      ${attendanceBatch.length}`)
    console.log(`   Grades:          ${grades.length}`)
    console.log(`   Feedback:        ${feedbacks.length}`)
    console.log(`   Payments:        ${payments.length}`)
    console.log(`   Claims:          ${claims.length}`)
    console.log(`   Documents:       ${documents.length}`)
    console.log(`   Activity logs:   ${logs.length}`)
    console.log(`   Settings:        enrollment (sequence 60)`)

    console.log('\n🔑 Staff login:')
    console.log('   Admin:   admin@quran-sfax.org / admin123')
    console.log('   Teacher: teacher1@quran-sfax.org … teacher7@quran-sfax.org / teacher123')
    console.log('\n🎓 Student portal (first 10 students):')
    console.log('   student1@quran-sfax.org … student10@quran-sfax.org / student123')
  } catch (error) {
    console.error('❌ Seed failed:', error)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
    console.log('\n🔌 Disconnected from MongoDB')
  }
}

seed()
