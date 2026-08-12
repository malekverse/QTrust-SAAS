export { default as User } from './User'
export type { IUser } from './User'

export { default as Student } from './Student'
export type { IStudent } from './Student'

export { default as SessionTemplate } from './SessionTemplate'
export type { ISessionTemplate } from './SessionTemplate'

export { default as SessionOccurrence } from './SessionOccurrence'
export type { ISessionOccurrence } from './SessionOccurrence'

export { default as StudentSession } from './StudentSession'
export type { IStudentSession } from './StudentSession'

export { default as Attendance } from './Attendance'
export type { IAttendance } from './Attendance'

export { default as ActivityLog, logActivity } from './ActivityLog'
export type { IActivityLog, ActivityType } from './ActivityLog'

export { default as Settings, DEFAULT_ENROLLMENT_SETTINGS, generateEnrollmentNumber, parseEnrollmentNumber } from './Settings'
export type { ISettings, IEnrollmentSettings } from './Settings'

export { default as Grade } from './Grade'
export type { IGrade } from './Grade'

export { default as TeacherFeedback } from './TeacherFeedback'
export type { ITeacherFeedback } from './TeacherFeedback'

export { default as AttendanceClaim } from './AttendanceClaim'
export type { IAttendanceClaim } from './AttendanceClaim'

export { default as LearningDocument } from './LearningDocument'
export type { ILearningDocument } from './LearningDocument'
// Note: DOCUMENT_CATEGORY_LABELS is exported from @/lib/constants (client-safe)

export { default as MonthlyPayment } from './MonthlyPayment'
export type { IMonthlyPayment } from './MonthlyPayment'

export { default as Room } from './Room'
export type { IRoom } from './Room'

export { default as Conversation } from './Conversation'
export type { IConversation, IConversationMessage, IPendingAction, IToolCall } from './Conversation'
