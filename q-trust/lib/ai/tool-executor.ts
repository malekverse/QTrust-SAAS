/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from 'mongoose'
import dbConnect from '@/lib/db'
import { hashPassword, generateTempPassword } from '@/lib/auth'
import { generateQrUuid } from '@/lib/utils'
import { ROLES, ATTENDANCE_STATUS, CLAIM_STATUS, SESSION_STATUS } from '@/lib/constants'

async function getModels() {
  await dbConnect()
  const Student = (await import('@/models/Student')).default
  const User = (await import('@/models/User')).default
  const SessionTemplate = (await import('@/models/SessionTemplate')).default
  const SessionOccurrence = (await import('@/models/SessionOccurrence')).default
  const StudentSession = (await import('@/models/StudentSession')).default
  const Attendance = (await import('@/models/Attendance')).default
  const Room = (await import('@/models/Room')).default
  const MonthlyPayment = (await import('@/models/MonthlyPayment')).default
  const AttendanceClaim = (await import('@/models/AttendanceClaim')).default
  const LearningDocument = (await import('@/models/LearningDocument')).default
  const ActivityLog = (await import('@/models/ActivityLog')).default
  const Settings = (await import('@/models/Settings')).default
  return {
    Student, User, SessionTemplate, SessionOccurrence,
    StudentSession, Attendance, Room, MonthlyPayment,
    AttendanceClaim, LearningDocument, ActivityLog, Settings,
  }
}

const STRIP_FIELDS = ['createdAt', 'updatedAt', '__v', 'passwordHash', 'qrUuid']

/** Mongoose `create()` overload returns `T | T[]`; normalize to a single document. */
function oneDoc<T>(doc: T | T[]): T {
  return Array.isArray(doc) ? doc[0] : doc
}

function stripMeta(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(stripMeta)
  const cleaned: any = {}
  for (const [k, v] of Object.entries(obj)) {
    if (STRIP_FIELDS.includes(k)) continue
    cleaned[k] = v
  }
  return cleaned
}

function summarize(items: any[], maxItems = 10): any[] {
  const stripped = items.map(stripMeta)
  if (stripped.length <= maxItems) return stripped
  return [...stripped.slice(0, maxItems), { _note: `... و ${items.length - maxItems} آخرين` }]
}

type Models = Awaited<ReturnType<typeof getModels>>

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isValidMongoObjectId(id: unknown): id is string {
  if (typeof id !== 'string') return false
  const t = id.trim()
  if (t.length !== 24) return false
  return mongoose.Types.ObjectId.isValid(t)
}

async function resolveTeacherObjectId(
  models: Models,
  raw: unknown
): Promise<{ ok: true; id: string } | { ok: false; error: string; candidates?: Array<{ _id: string; fullName: string }> }> {
  if (raw === undefined || raw === null) return { ok: false, error: 'معرف المعلم مطلوب' }
  const s = String(raw).trim()
  if (!s) return { ok: false, error: 'معرف المعلم مطلوب' }
  if (isValidMongoObjectId(s)) {
    const u = await models.User.findOne({ _id: s, role: ROLES.TEACHER }).select('_id fullName').lean()
    if (u) return { ok: true, id: String(u._id) }
    return { ok: false, error: 'لم يُعثر على معلم بهذا المعرّف' }
  }
  const results = await models.User.find({
    role: ROLES.TEACHER,
    fullName: { $regex: escapeRegex(s), $options: 'i' },
  })
    .select('_id fullName')
    .limit(8)
    .lean()
  if (results.length === 0) {
    return { ok: false, error: `لم يُعثر على معلم يطابق "${s}". جرّب الاسم الكامل أو استخدم list_teachers.` }
  }
  if (results.length === 1) return { ok: true, id: String(results[0]._id) }
  return {
    ok: false,
    error: 'عدة معلمين يطابقون هذا الاسم. مرّر معرّف MongoDB (_id) من القائمة أدناه.',
    candidates: results.map((t: any) => ({ _id: String(t._id), fullName: t.fullName })),
  }
}

async function resolveStudentObjectId(
  models: Models,
  raw: unknown
): Promise<{ ok: true; id: string } | { ok: false; error: string; candidates?: Array<{ _id: string; fullName?: string; firstName?: string; lastName?: string }> }> {
  if (raw === undefined || raw === null) return { ok: false, error: 'معرف الطالب مطلوب' }
  const s = String(raw).trim()
  if (!s) return { ok: false, error: 'معرف الطالب مطلوب' }
  if (isValidMongoObjectId(s)) {
    const st = await models.Student.findById(s).select('_id').lean()
    if (st) return { ok: true, id: String(st._id) }
    return { ok: false, error: 'لم يُعثر على طالب بهذا المعرّف' }
  }
  const results = await models.Student.find({
    $or: [
      { firstName: { $regex: escapeRegex(s), $options: 'i' } },
      { lastName: { $regex: escapeRegex(s), $options: 'i' } },
      { fullName: { $regex: escapeRegex(s), $options: 'i' } },
    ],
  })
    .select('_id firstName lastName enrollmentNumber')
    .limit(8)
    .lean()
  if (results.length === 0) {
    return { ok: false, error: `لم يُعثر على طالب يطابق "${s}".` }
  }
  if (results.length === 1) {
    const r = results[0] as any
    return { ok: true, id: String(r._id) }
  }
  return {
    ok: false,
    error: 'عدة طلاب يطابقون هذا الاسم. مرّر معرّف MongoDB (_id).',
    candidates: results.map((st: any) => ({
      _id: String(st._id),
      firstName: st.firstName,
      lastName: st.lastName,
      enrollmentNumber: st.enrollmentNumber,
    })),
  }
}

async function resolveRoomObjectId(
  models: Models,
  raw: unknown
): Promise<{ ok: true; id: string | undefined } | { ok: false; error: string; candidates?: Array<{ _id: string; name: string }> }> {
  if (raw === undefined || raw === null || raw === '') return { ok: true, id: undefined }
  const s = String(raw).trim()
  if (!s) return { ok: true, id: undefined }
  if (isValidMongoObjectId(s)) {
    const room = await models.Room.findById(s).select('_id').lean()
    if (room) return { ok: true, id: String(room._id) }
    return { ok: false, error: 'لم يُعثر على قاعة بهذا المعرّف' }
  }
  const results = await models.Room.find({
    name: { $regex: escapeRegex(s), $options: 'i' },
  })
    .select('_id name')
    .limit(8)
    .lean()
  if (results.length === 0) return { ok: false, error: `لم يُعثر على قاعة تطابق "${s}".` }
  if (results.length === 1) return { ok: true, id: String(results[0]._id) }
  return {
    ok: false,
    error: 'عدة قاعات تطابق الاسم. مرّر معرّف MongoDB (_id).',
    candidates: results.map((r: any) => ({ _id: String(r._id), name: r.name })),
  }
}

async function resolveSessionTemplateObjectId(
  models: Models,
  raw: unknown
): Promise<{ ok: true; id: string } | { ok: false; error: string; candidates?: Array<{ _id: string; name: string }> }> {
  if (raw === undefined || raw === null) return { ok: false, error: 'معرف قالب الحصة مطلوب' }
  const s = String(raw).trim()
  if (!s) return { ok: false, error: 'معرف قالب الحصة مطلوب' }
  if (isValidMongoObjectId(s)) {
    const tpl = await models.SessionTemplate.findById(s).select('_id').lean()
    if (tpl) return { ok: true, id: String(tpl._id) }
    return { ok: false, error: 'لم يُعثر على حصة بهذا المعرّف' }
  }
  const results = await models.SessionTemplate.find({
    name: { $regex: escapeRegex(s), $options: 'i' },
  })
    .select('_id name')
    .limit(8)
    .lean()
  if (results.length === 0) return { ok: false, error: `لم يُعثر على قالب حصة يطابق "${s}".` }
  if (results.length === 1) return { ok: true, id: String(results[0]._id) }
  return {
    ok: false,
    error: 'عدة حصص تطابق الاسم. مرّر معرّف MongoDB (_id).',
    candidates: results.map((t: any) => ({ _id: String(t._id), name: t.name })),
  }
}

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  adminUserId: string
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const models = await getModels()
    const { logActivity } = await import('@/models/ActivityLog')

    switch (toolName) {
      // ─── Students ───
      case 'list_students': {
        const query: Record<string, unknown> = {}
        if (args.isActive !== undefined) query.isActive = args.isActive
        if (args.search) {
          const s = args.search as string
          query.$or = [
            { firstName: { $regex: escapeRegex(s), $options: 'i' } },
            { lastName: { $regex: escapeRegex(s), $options: 'i' } },
            { fullName: { $regex: escapeRegex(s), $options: 'i' } },
            { enrollmentNumber: { $regex: escapeRegex(s), $options: 'i' } },
            { cin: s },
          ]
        }
        const limit = Math.min((args.limit as number) || 20, 50)
        const students = await models.Student.find(query)
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean()
        const total = await models.Student.countDocuments(query)
        return {
          success: true,
          data: {
            students: summarize(students.map((s: any) => ({
              _id: s._id, firstName: s.firstName, lastName: s.lastName,
              enrollmentNumber: s.enrollmentNumber, phone: s.phone,
              isActive: s.isActive, gender: s.gender,
            }))),
            total,
          },
        }
      }

      case 'get_student': {
        let student
        if (args.id) {
          student = await models.Student.findById(args.id).lean()
        } else if (args.name) {
          const s = args.name as string
          const results = await models.Student.find({
            $or: [
              { firstName: { $regex: escapeRegex(s), $options: 'i' } },
              { lastName: { $regex: escapeRegex(s), $options: 'i' } },
              { fullName: { $regex: escapeRegex(s), $options: 'i' } },
            ],
          }).limit(5).lean()
          if (results.length === 1) {
            student = results[0]
          } else if (results.length > 1) {
            return {
              success: true,
              data: {
                multipleResults: true,
                students: results.map((s: any) => ({
                  _id: s._id, firstName: s.firstName, lastName: s.lastName,
                  enrollmentNumber: s.enrollmentNumber,
                })),
              },
            }
          }
        }
        if (!student) return { success: false, error: 'الطالب غير موجود' }
        return { success: true, data: student }
      }

      case 'create_student': {
        const qrUuid = generateQrUuid()
        const year = new Date().getFullYear()
        const lastStudent = await models.Student.findOne({
          enrollmentNumber: { $regex: `^${year}-` },
        }).sort({ enrollmentNumber: -1 }).select('enrollmentNumber').lean()

        let nextNum = 1
        if (lastStudent?.enrollmentNumber) {
          const last = parseInt(lastStudent.enrollmentNumber.split('-')[1], 10)
          if (!isNaN(last)) nextNum = last + 1
        }
        const enrollmentNumber = `${year}-${nextNum.toString().padStart(3, '0')}`

        const studentData: any = {
          firstName: args.firstName,
          lastName: args.lastName,
          gender: args.gender,
          phone: args.phone,
          email: args.email,
          cin: args.cin,
          fatherName: args.fatherName,
          dateOfBirth: args.dateOfBirth ? new Date(args.dateOfBirth as string) : undefined,
          address: args.address,
          educationLevel: args.educationLevel,
          activityAreas: args.activityAreas || [],
          notes: args.notes,
          enrollmentNumber,
          qrUuid,
          declarationAccepted: true,
          isActive: true,
          fullName: `${args.firstName} ${args.lastName}`,
        }

        const student = oneDoc(await models.Student.create(studentData))
        await logActivity('STUDENT_CREATED', `${args.firstName} ${args.lastName}`, {
          studentId: student._id, userId: adminUserId,
        })
        return { success: true, data: { _id: student._id, enrollmentNumber, name: `${args.firstName} ${args.lastName}` } }
      }

      case 'update_student': {
        const { id, ...updateData } = args
        if (updateData.dateOfBirth) updateData.dateOfBirth = new Date(updateData.dateOfBirth as string)
        const student = await models.Student.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).lean()
        if (!student) return { success: false, error: 'الطالب غير موجود' }
        await logActivity('STUDENT_UPDATED', `${student.firstName} ${student.lastName}`, {
          studentId: student._id, userId: adminUserId,
        })
        return { success: true, data: { _id: student._id, name: `${student.firstName} ${student.lastName}` } }
      }

      case 'delete_student': {
        const student = await models.Student.findByIdAndUpdate(args.id, { isActive: false }, { new: true }).lean()
        if (!student) return { success: false, error: 'الطالب غير موجود' }
        return { success: true, data: { _id: student._id, name: `${student.firstName} ${student.lastName}` } }
      }

      case 'create_student_account': {
        const student = await models.Student.findById(args.studentId)
        if (!student) return { success: false, error: 'الطالب غير موجود' }
        if (student.hasPortalAccess) return { success: false, error: 'الطالب لديه حساب بالفعل' }

        const email = (args.email as string) || student.email
        const phone = (args.phone as string) || student.phone
        if (!email) return { success: false, error: 'البريد الإلكتروني مطلوب لإنشاء الحساب' }

        const tempPassword = generateTempPassword()
        const passwordHash = await hashPassword(tempPassword)
        const user = await models.User.create({
          fullName: `${student.firstName} ${student.lastName}`,
          email,
          phone,
          role: ROLES.STUDENT,
          passwordHash,
          isActive: true,
          mustChangePassword: true,
          studentId: student._id,
        })
        student.userId = user._id
        student.hasPortalAccess = true
        await student.save()
        return { success: true, data: { userId: user._id, email, tempPassword } }
      }

      case 'reset_student_password': {
        const student = await models.Student.findById(args.studentId).lean()
        if (!student) return { success: false, error: 'الطالب غير موجود' }
        if (!student.userId) return { success: false, error: 'الطالب ليس لديه حساب' }
        const tempPassword = generateTempPassword()
        const passwordHash = await hashPassword(tempPassword)
        await models.User.findByIdAndUpdate(student.userId, {
          passwordHash, mustChangePassword: true,
        })
        return { success: true, data: { tempPassword } }
      }

      // ─── Teachers ───
      case 'list_teachers': {
        const query: Record<string, unknown> = { role: ROLES.TEACHER }
        if (args.isActive !== undefined) query.isActive = args.isActive
        if (args.search) {
          query.$or = [
            { fullName: { $regex: escapeRegex(args.search as string), $options: 'i' } },
            { email: { $regex: escapeRegex(args.search as string), $options: 'i' } },
          ]
        }
        const teachers = await models.User.find(query)
          .select('fullName email phone isActive createdAt')
          .sort({ createdAt: -1 }).lean()
        return { success: true, data: { teachers: summarize(teachers), total: teachers.length } }
      }

      case 'get_teacher': {
        let teacher
        if (args.id) {
          teacher = await models.User.findOne({ _id: args.id, role: ROLES.TEACHER })
            .select('-passwordHash').lean()
        } else if (args.name) {
          const results = await models.User.find({
            role: ROLES.TEACHER,
            fullName: { $regex: escapeRegex(args.name as string), $options: 'i' },
          }).select('-passwordHash').limit(5).lean()
          if (results.length === 1) teacher = results[0]
          else if (results.length > 1) {
            return {
              success: true,
              data: {
                multipleResults: true,
                teachers: results.map((t: any) => ({ _id: t._id, fullName: t.fullName, email: t.email })),
              },
            }
          }
        }
        if (!teacher) return { success: false, error: 'المعلم غير موجود' }
        return { success: true, data: teacher }
      }

      case 'create_teacher': {
        const password = (args.password as string) || generateTempPassword()
        const passwordHash = await hashPassword(password)
        const teacherData: any = {
          fullName: args.fullName,
          email: args.email,
          phone: args.phone,
          role: ROLES.TEACHER,
          passwordHash,
          isActive: true,
          mustChangePassword: !args.password,
        }
        const teacher = oneDoc(await models.User.create(teacherData))
        await logActivity('TEACHER_CREATED', args.fullName as string, { userId: adminUserId })
        return { success: true, data: { _id: teacher._id, fullName: args.fullName, email: args.email, tempPassword: args.password ? undefined : password } }
      }

      case 'update_teacher': {
        const { id: tid, ...tUpdate } = args
        const teacher = await models.User.findOneAndUpdate(
          { _id: tid, role: ROLES.TEACHER } as any, tUpdate as any,
          { new: true, runValidators: true }
        ).select('-passwordHash').lean()
        if (!teacher) return { success: false, error: 'المعلم غير موجود' }
        await logActivity('TEACHER_UPDATED', teacher.fullName, { userId: adminUserId })
        return { success: true, data: { _id: teacher._id, fullName: teacher.fullName } }
      }

      case 'delete_teacher': {
        const teacher = await models.User.findOneAndUpdate(
          { _id: args.id, role: ROLES.TEACHER } as any, { isActive: false } as any, { new: true }
        ).select('fullName').lean()
        if (!teacher) return { success: false, error: 'المعلم غير موجود' }
        return { success: true, data: { _id: teacher._id, fullName: teacher.fullName } }
      }

      // ─── Sessions ───
      case 'list_sessions': {
        const query: Record<string, unknown> = {}
        if (args.teacherId) {
          const tr = await resolveTeacherObjectId(models, args.teacherId)
          if (!tr.ok) {
            return {
              success: false,
              error: tr.error,
              ...(tr.candidates ? { data: { teacherCandidates: tr.candidates } } : {}),
            }
          }
          query.teacherId = tr.id
        }
        if (args.dayOfWeek !== undefined) query.dayOfWeek = args.dayOfWeek
        if (args.isActive !== undefined) query.isActive = args.isActive
        const sessions = await models.SessionTemplate.find(query)
          .populate('teacherId', 'fullName')
          .populate('roomId', 'name')
          .sort({ dayOfWeek: 1, startTime: 1 }).lean()
        return { success: true, data: { sessions: summarize(sessions), total: sessions.length } }
      }

      case 'get_session': {
        let session
        if (args.id) {
          session = await models.SessionTemplate.findById(args.id)
            .populate('teacherId', 'fullName email')
            .populate('roomId', 'name capacity').lean()
        } else if (args.name) {
          const results = await models.SessionTemplate.find({
            name: { $regex: escapeRegex(args.name as string), $options: 'i' },
          }).populate('teacherId', 'fullName').limit(5).lean()
          if (results.length === 1) session = results[0]
          else if (results.length > 1) {
            return {
              success: true,
              data: { multipleResults: true, sessions: results.map((s: any) => ({ _id: s._id, name: s.name })) },
            }
          }
        }
        if (!session) return { success: false, error: 'الحصة غير موجودة' }
        const enrolled = await models.StudentSession.find({ sessionTemplateId: session._id, isActive: true })
          .populate('studentId', 'firstName lastName enrollmentNumber').lean()
        return { success: true, data: { session, enrolledStudents: enrolled.map((e: any) => e.studentId), enrolledCount: enrolled.length } }
      }

      case 'create_session': {
        const teacherRes = await resolveTeacherObjectId(models, args.teacherId)
        if (!teacherRes.ok) {
          return {
            success: false,
            error: teacherRes.error,
            ...(teacherRes.candidates ? { data: { teacherCandidates: teacherRes.candidates } } : {}),
          }
        }
        const roomRes = await resolveRoomObjectId(models, args.roomId)
        if (!roomRes.ok) {
          return {
            success: false,
            error: roomRes.error,
            ...(roomRes.candidates ? { data: { roomCandidates: roomRes.candidates } } : {}),
          }
        }
        const sessionData: any = {
          name: args.name,
          teacherId: teacherRes.id,
          dayOfWeek: args.dayOfWeek,
          startTime: args.startTime,
          endTime: args.endTime,
          roomId: roomRes.id,
          effectiveFromDate: new Date(args.effectiveFromDate as string),
          effectiveToDate: args.effectiveToDate ? new Date(args.effectiveToDate as string) : undefined,
          description: args.description,
          isActive: true,
        }
        const session = oneDoc(await models.SessionTemplate.create(sessionData))
        await logActivity('SESSION_CREATED', args.name as string, {
          sessionId: session._id, userId: adminUserId,
        })
        return { success: true, data: { _id: session._id, name: args.name } }
      }

      case 'update_session': {
        const { id: sid, ...sUpdate } = args as any
        if (sUpdate.teacherId !== undefined) {
          const tr = await resolveTeacherObjectId(models, sUpdate.teacherId)
          if (!tr.ok) {
            return {
              success: false,
              error: tr.error,
              ...(tr.candidates ? { data: { teacherCandidates: tr.candidates } } : {}),
            }
          }
          sUpdate.teacherId = tr.id
        }
        if (Object.prototype.hasOwnProperty.call(sUpdate, 'roomId')) {
          const rr = await resolveRoomObjectId(models, sUpdate.roomId)
          if (!rr.ok) {
            return {
              success: false,
              error: rr.error,
              ...(rr.candidates ? { data: { roomCandidates: rr.candidates } } : {}),
            }
          }
          if (rr.id === undefined) delete sUpdate.roomId
          else sUpdate.roomId = rr.id
        }
        if (sUpdate.effectiveFromDate) sUpdate.effectiveFromDate = new Date(sUpdate.effectiveFromDate as string)
        if (sUpdate.effectiveToDate) sUpdate.effectiveToDate = new Date(sUpdate.effectiveToDate as string)
        const session = await models.SessionTemplate.findByIdAndUpdate(sid, sUpdate, { new: true, runValidators: true }).lean()
        if (!session) return { success: false, error: 'الحصة غير موجودة' }
        await logActivity('SESSION_UPDATED', session.name, { sessionId: session._id, userId: adminUserId })
        return { success: true, data: { _id: session._id, name: session.name } }
      }

      case 'delete_session': {
        const session = await models.SessionTemplate.findByIdAndUpdate(args.id, { isActive: false }, { new: true }).lean()
        if (!session) return { success: false, error: 'الحصة غير موجودة' }
        return { success: true, data: { _id: session._id, name: session.name } }
      }

      case 'enroll_student': {
        const studentRes = await resolveStudentObjectId(models, args.studentId)
        if (!studentRes.ok) {
          return {
            success: false,
            error: studentRes.error,
            ...(studentRes.candidates ? { data: { studentCandidates: studentRes.candidates } } : {}),
          }
        }
        const tplRes = await resolveSessionTemplateObjectId(models, args.sessionTemplateId)
        if (!tplRes.ok) {
          return {
            success: false,
            error: tplRes.error,
            ...(tplRes.candidates ? { data: { sessionCandidates: tplRes.candidates } } : {}),
          }
        }
        const existing = await models.StudentSession.findOne({
          studentId: studentRes.id, sessionTemplateId: tplRes.id,
        } as any)
        if (existing) {
          if (existing.isActive) return { success: false, error: 'الطالب مسجل بالفعل في هذه الحصة' }
          existing.isActive = true
          await existing.save()
          return { success: true, data: { reactivated: true } }
        }
        await models.StudentSession.create({
          studentId: studentRes.id, sessionTemplateId: tplRes.id, isActive: true,
        } as any)
        return { success: true, data: { enrolled: true } }
      }

      case 'unenroll_student': {
        const studentResU = await resolveStudentObjectId(models, args.studentId)
        if (!studentResU.ok) {
          return {
            success: false,
            error: studentResU.error,
            ...(studentResU.candidates ? { data: { studentCandidates: studentResU.candidates } } : {}),
          }
        }
        const tplResU = await resolveSessionTemplateObjectId(models, args.sessionTemplateId)
        if (!tplResU.ok) {
          return {
            success: false,
            error: tplResU.error,
            ...(tplResU.candidates ? { data: { sessionCandidates: tplResU.candidates } } : {}),
          }
        }
        const enrollment = await models.StudentSession.findOneAndUpdate(
          { studentId: studentResU.id, sessionTemplateId: tplResU.id } as any,
          { isActive: false } as any, { new: true }
        )
        if (!enrollment) return { success: false, error: 'الطالب غير مسجل في هذه الحصة' }
        return { success: true, data: { unenrolled: true } }
      }

      case 'generate_occurrences': {
        const start = new Date(args.startDate as string)
        const end = new Date(args.endDate as string)
        const templateQuery: Record<string, unknown> = { isActive: true }
        if (args.sessionTemplateId) {
          const tplRes = await resolveSessionTemplateObjectId(models, args.sessionTemplateId)
          if (!tplRes.ok) {
            return {
              success: false,
              error: tplRes.error,
              ...(tplRes.candidates ? { data: { sessionCandidates: tplRes.candidates } } : {}),
            }
          }
          templateQuery._id = tplRes.id
        }

        const templates = await models.SessionTemplate.find(templateQuery).lean()
        let created = 0

        for (const tpl of templates) {
          const current = new Date(start)
          while (current <= end) {
            if (current.getDay() === tpl.dayOfWeek) {
              const dateStr = current.toISOString().split('T')[0]
              const exists = await models.SessionOccurrence.findOne({
                sessionTemplateId: tpl._id,
                date: { $gte: new Date(`${dateStr}T00:00:00`), $lt: new Date(`${dateStr}T23:59:59`) },
              })
              if (!exists) {
                const [sh, sm] = tpl.startTime.split(':').map(Number)
                const [eh, em] = tpl.endTime.split(':').map(Number)
                const startDT = new Date(current)
                startDT.setHours(sh, sm, 0, 0)
                const endDT = new Date(current)
                endDT.setHours(eh, em, 0, 0)
                const qrOpen = new Date(startDT.getTime() - (tpl.qrOpenOffsetBeforeMin || 60) * 60000)
                const qrClose = new Date(endDT.getTime() + (tpl.qrCloseOffsetAfterMin || 60) * 60000)

                await models.SessionOccurrence.create({
                  sessionTemplateId: tpl._id,
                  teacherId: tpl.teacherId,
                  date: new Date(dateStr),
                  startDateTime: startDT,
                  endDateTime: endDT,
                  qrOpenDateTime: qrOpen,
                  qrCloseDateTime: qrClose,
                  status: SESSION_STATUS.SCHEDULED,
                })
                created++
              }
            }
            current.setDate(current.getDate() + 1)
          }
        }
        return { success: true, data: { created, templatesProcessed: templates.length } }
      }

      // ─── Rooms ───
      case 'list_rooms': {
        const query: Record<string, unknown> = {}
        if (args.isActive !== undefined) query.isActive = args.isActive
        const rooms = await models.Room.find(query).sort({ name: 1 }).lean()
        return { success: true, data: { rooms, total: rooms.length } }
      }

      case 'get_room': {
        let room
        if (args.id) {
          room = await models.Room.findById(args.id).lean()
        } else if (args.name) {
          const results = await models.Room.find({
            name: { $regex: escapeRegex(args.name as string), $options: 'i' },
          }).limit(5).lean()
          if (results.length === 1) room = results[0]
          else if (results.length > 1) {
            return {
              success: true,
              data: { multipleResults: true, rooms: results.map((r: any) => ({ _id: r._id, name: r.name })) },
            }
          }
        }
        if (!room) return { success: false, error: 'القاعة غير موجودة' }
        return { success: true, data: room }
      }

      case 'create_room': {
        const roomData: any = {
          name: args.name, capacity: args.capacity,
          description: args.description, location: args.location,
          features: args.features || [], isActive: true,
        }
        const room = oneDoc(await models.Room.create(roomData))
        return { success: true, data: { _id: room._id, name: room.name } }
      }

      case 'update_room': {
        const { id: rid, ...rUpdate } = args
        const room = await models.Room.findByIdAndUpdate(rid, rUpdate as any, { new: true, runValidators: true }).lean()
        if (!room) return { success: false, error: 'القاعة غير موجودة' }
        return { success: true, data: { _id: room._id, name: room.name } }
      }

      case 'delete_room': {
        const room = await models.Room.findByIdAndUpdate(args.id, { isActive: false }, { new: true }).lean()
        if (!room) return { success: false, error: 'القاعة غير موجودة' }
        return { success: true, data: { _id: room._id, name: room.name } }
      }

      case 'check_room_availability': {
        const room = await models.Room.findById(args.roomId).lean()
        if (!room) return { success: false, error: 'القاعة غير موجودة' }
        const sessQuery: Record<string, unknown> = { roomId: args.roomId, isActive: true }
        if (args.dayOfWeek !== undefined) sessQuery.dayOfWeek = args.dayOfWeek
        const sessions = await models.SessionTemplate.find(sessQuery)
          .populate('teacherId', 'fullName').lean()
        return {
          success: true,
          data: { room, sessions, sessionsCount: sessions.length },
        }
      }

      // ─── Schedule ───
      case 'view_schedule': {
        const query: Record<string, unknown> = { isActive: true }
        if (args.teacherId && typeof args.teacherId === 'string') query.teacherId = args.teacherId
        if (args.roomId && typeof args.roomId === 'string') query.roomId = args.roomId
        const sessions = await models.SessionTemplate.find(query)
          .populate('teacherId', 'fullName')
          .populate('roomId', 'name')
          .sort({ dayOfWeek: 1, startTime: 1 }).lean()
        const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
        const schedule = days.map((day, i) => ({
          day,
          dayOfWeek: i,
          sessions: sessions.filter((s: any) => s.dayOfWeek === i),
        }))
        return { success: true, data: { schedule } }
      }

      case 'check_conflicts': {
        const activeSessions = await models.SessionTemplate.find({ isActive: true })
          .populate('teacherId', 'fullName')
          .populate('roomId', 'name').lean()

        const conflicts: Array<{ type: string; details: string; sessions: unknown[] }> = []

        for (let i = 0; i < activeSessions.length; i++) {
          for (let j = i + 1; j < activeSessions.length; j++) {
            const a = activeSessions[i]
            const b = activeSessions[j]
            if (a.dayOfWeek !== b.dayOfWeek) continue
            const aStart = a.startTime, aEnd = a.endTime
            const bStart = b.startTime, bEnd = b.endTime
            if (aStart < bEnd && bStart < aEnd) {
              if (a.roomId && b.roomId && (a.roomId as any)._id && (b.roomId as any)._id && String((a.roomId as any)._id) === String((b.roomId as any)._id)) {
                conflicts.push({
                  type: 'ROOM_CONFLICT',
                  details: `تعارض في القاعة: ${(a.roomId as any).name}`,
                  sessions: [{ name: a.name, time: `${a.startTime}-${a.endTime}` }, { name: b.name, time: `${b.startTime}-${b.endTime}` }],
                })
              }
              if (a.teacherId && b.teacherId && (a.teacherId as any)._id && (b.teacherId as any)._id && String((a.teacherId as any)._id) === String((b.teacherId as any)._id)) {
                conflicts.push({
                  type: 'TEACHER_CONFLICT',
                  details: `تعارض للمعلم: ${(a.teacherId as any).fullName}`,
                  sessions: [{ name: a.name, time: `${a.startTime}-${a.endTime}` }, { name: b.name, time: `${b.startTime}-${b.endTime}` }],
                })
              }
            }
          }
        }
        return { success: true, data: { conflicts, totalConflicts: conflicts.length } }
      }

      case 'auto_assign_rooms': {
        const unassigned = await models.SessionTemplate.find({ isActive: true, roomId: null }).lean()
        const rooms = await models.Room.find({ isActive: true }).sort({ capacity: -1 }).lean()
        const assigned: Array<{ session: string; room: string }> = []

        for (const sess of unassigned) {
          for (const room of rooms) {
            const conflict = await models.SessionTemplate.findOne({
              isActive: true, roomId: room._id, dayOfWeek: sess.dayOfWeek,
              startTime: { $lt: sess.endTime }, endTime: { $gt: sess.startTime },
            })
            if (!conflict) {
              if (args.confirm) {
                await models.SessionTemplate.findByIdAndUpdate(sess._id, { roomId: room._id })
              }
              assigned.push({ session: sess.name, room: room.name })
              break
            }
          }
        }
        return { success: true, data: { assigned, count: assigned.length, confirmed: !!args.confirm } }
      }

      // ─── Attendance ───
      case 'view_attendance': {
        const date = args.date as string || new Date().toISOString().split('T')[0]
        const dayStart = new Date(`${date}T00:00:00`)
        const dayEnd = new Date(`${date}T23:59:59`)

        const occQuery: Record<string, unknown> = {
          date: { $gte: dayStart, $lte: dayEnd },
        }
        if (args.sessionTemplateId) occQuery.sessionTemplateId = args.sessionTemplateId

        const occurrences = await models.SessionOccurrence.find(occQuery)
          .populate('sessionTemplateId', 'name').lean()

        if (occurrences.length === 0) {
          return { success: true, data: { message: 'لا توجد حصص في هذا التاريخ', date } }
        }

        const occIds = occurrences.map((o: any) => o._id)
        const attQuery: Record<string, unknown> = { sessionOccurrenceId: { $in: occIds } }
        if (args.studentId) attQuery.studentId = args.studentId

        const records = await models.Attendance.find(attQuery)
          .populate('studentId', 'firstName lastName enrollmentNumber')
          .populate('sessionOccurrenceId', 'date').lean()

        const stats = {
          total: records.length,
          present: records.filter((r: any) => r.status === ATTENDANCE_STATUS.PRESENT).length,
          absent: records.filter((r: any) => r.status === ATTENDANCE_STATUS.ABSENT).length,
          late: records.filter((r: any) => r.status === ATTENDANCE_STATUS.LATE).length,
          justified: records.filter((r: any) => r.status === ATTENDANCE_STATUS.JUSTIFIED_ABSENCE).length,
        }

        return { success: true, data: { date, occurrences: occurrences.length, stats, records: summarize(records) } }
      }

      case 'update_attendance': {
        if (args.attendanceId) {
          const att = await models.Attendance.findByIdAndUpdate(args.attendanceId, {
            status: args.status, notes: args.notes,
            lastModifiedByUserId: adminUserId, lastModifiedAt: new Date(),
          }, { new: true, runValidators: true }).lean()
          if (!att) return { success: false, error: 'سجل الحضور غير موجود' }
          return { success: true, data: att }
        }
        if (args.studentId && args.sessionOccurrenceId) {
          const att = await models.Attendance.findOneAndUpdate(
            { studentId: args.studentId, sessionOccurrenceId: args.sessionOccurrenceId },
            {
              status: args.status, notes: args.notes,
              lastModifiedByUserId: adminUserId, lastModifiedAt: new Date(),
              createdBy: 'ADMIN',
            },
            { new: true, upsert: true, runValidators: true }
          ).lean()
          return { success: true, data: att }
        }
        return { success: false, error: 'يجب تحديد معرف سجل الحضور أو معرف الطالب والحصة' }
      }

      case 'get_attendance_stats': {
        const date = args.date as string || new Date().toISOString().split('T')[0]
        const dayStart = new Date(`${date}T00:00:00`)
        const dayEnd = new Date(`${date}T23:59:59`)

        const occQuery: Record<string, unknown> = { date: { $gte: dayStart, $lte: dayEnd } }
        if (args.sessionTemplateId) occQuery.sessionTemplateId = args.sessionTemplateId

        const occurrences = await models.SessionOccurrence.find(occQuery).lean()
        const occIds = occurrences.map((o: any) => o._id)

        const total = await models.Attendance.countDocuments({ sessionOccurrenceId: { $in: occIds } })
        const present = await models.Attendance.countDocuments({ sessionOccurrenceId: { $in: occIds }, status: ATTENDANCE_STATUS.PRESENT })
        const late = await models.Attendance.countDocuments({ sessionOccurrenceId: { $in: occIds }, status: ATTENDANCE_STATUS.LATE })
        const absent = await models.Attendance.countDocuments({ sessionOccurrenceId: { $in: occIds }, status: ATTENDANCE_STATUS.ABSENT })
        const justified = await models.Attendance.countDocuments({ sessionOccurrenceId: { $in: occIds }, status: ATTENDANCE_STATUS.JUSTIFIED_ABSENCE })

        const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0

        return {
          success: true,
          data: { date, sessionsCount: occurrences.length, total, present, late, absent, justified, attendanceRate: rate },
        }
      }

      // ─── Payments ───
      case 'view_payments': {
        const now = new Date()
        const month = (args.month as number) || (now.getMonth() + 1)
        const year = (args.year as number) || now.getFullYear()

        const query: Record<string, unknown> = { month, year }
        if (args.studentId) query.studentId = args.studentId
        if (args.isPaid !== undefined) query.isPaid = args.isPaid

        const payments = await models.MonthlyPayment.find(query)
          .populate('studentId', 'firstName lastName enrollmentNumber').lean()
        const total = payments.length
        const paid = payments.filter((p: any) => p.isPaid).length

        return { success: true, data: { month, year, payments: summarize(payments), total, paid, unpaid: total - paid } }
      }

      case 'mark_payment': {
        const payment = await models.MonthlyPayment.findOneAndUpdate(
          { studentId: args.studentId, month: args.month, year: args.year } as any,
          {
            isPaid: args.isPaid,
            paidAt: args.isPaid ? new Date() : undefined,
            markedByUserId: adminUserId,
            amount: args.amount,
            notes: args.notes,
          } as any,
          { new: true, upsert: true, runValidators: true }
        ).lean()
        return { success: true, data: payment }
      }

      case 'bulk_mark_payments': {
        const ids = args.studentIds as string[]
        let updated = 0
        for (const sid of ids) {
          await models.MonthlyPayment.findOneAndUpdate(
            { studentId: sid, month: args.month, year: args.year } as any,
            {
              isPaid: args.isPaid,
              paidAt: args.isPaid ? new Date() : undefined,
              markedByUserId: adminUserId,
              amount: args.amount,
            } as any,
            { upsert: true, runValidators: true }
          )
          updated++
        }
        return { success: true, data: { updated } }
      }

      // ─── Claims ───
      case 'list_claims': {
        const query: Record<string, unknown> = {}
        if (args.status) query.status = args.status
        const claims = await models.AttendanceClaim.find(query)
          .populate('studentId', 'firstName lastName enrollmentNumber')
          .populate('sessionOccurrenceId', 'date')
          .sort({ createdAt: -1 }).lean()
        return { success: true, data: { claims: summarize(claims), total: claims.length } }
      }

      case 'review_claim': {
        const claim = await models.AttendanceClaim.findByIdAndUpdate(args.claimId, {
          status: args.status,
          reviewedBy: adminUserId,
          reviewNotes: args.reviewNotes,
          reviewedAt: new Date(),
        }, { new: true, runValidators: true }).lean()
        if (!claim) return { success: false, error: 'الاعتراض غير موجود' }

        if (args.status === CLAIM_STATUS.APPROVED) {
          await models.Attendance.findOneAndUpdate(
            { studentId: claim.studentId, sessionOccurrenceId: claim.sessionOccurrenceId },
            { status: ATTENDANCE_STATUS.PRESENT, lastModifiedByUserId: adminUserId, lastModifiedAt: new Date() },
            { runValidators: true }
          )
        }
        return { success: true, data: { claimId: claim._id, status: args.status } }
      }

      // ─── Documents ───
      case 'list_documents': {
        const query: Record<string, unknown> = {}
        if (args.category) query.category = args.category
        const docs = await models.LearningDocument.find(query)
          .sort({ createdAt: -1 }).lean()
        return { success: true, data: { documents: summarize(docs), total: docs.length } }
      }

      case 'delete_document': {
        const doc = await models.LearningDocument.findByIdAndDelete(args.id).lean()
        if (!doc) return { success: false, error: 'المستند غير موجود' }
        return { success: true, data: { deleted: true, title: doc.title } }
      }

      // ─── Dashboard ───
      case 'get_dashboard_stats': {
        const totalStudents = await models.Student.countDocuments({ isActive: true })
        const totalTeachers = await models.User.countDocuments({ role: ROLES.TEACHER, isActive: true })
        const totalSessions = await models.SessionTemplate.countDocuments({ isActive: true })
        const totalRooms = await models.Room.countDocuments({ isActive: true })

        const today = new Date().toISOString().split('T')[0]
        const dayStart = new Date(`${today}T00:00:00`)
        const dayEnd = new Date(`${today}T23:59:59`)
        const todayOccurrences = await models.SessionOccurrence.find({ date: { $gte: dayStart, $lte: dayEnd } }).lean()
        const occIds = todayOccurrences.map((o: any) => o._id)

        const totalAtt = await models.Attendance.countDocuments({ sessionOccurrenceId: { $in: occIds } })
        const presentAtt = await models.Attendance.countDocuments({
          sessionOccurrenceId: { $in: occIds },
          status: { $in: [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE] },
        })
        const attendanceRate = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0

        const pendingClaims = await models.AttendanceClaim.countDocuments({ status: CLAIM_STATUS.PENDING })

        return {
          success: true,
          data: {
            totalStudents, totalTeachers, totalSessions, totalRooms,
            todaySessions: todayOccurrences.length,
            todayAttendanceRate: attendanceRate,
            pendingClaims,
          },
        }
      }

      // ─── Activity Log ───
      case 'get_activity_log': {
        const limit = Math.min((args.limit as number) || 20, 50)
        const query: Record<string, unknown> = {}
        if (args.type) query.type = args.type
        const logs = await models.ActivityLog.find(query)
          .populate('userId', 'fullName')
          .sort({ createdAt: -1 }).limit(limit).lean()
        return { success: true, data: { logs, total: logs.length } }
      }

      // ─── Settings ───
      case 'get_settings': {
        if (args.key) {
          const setting = await models.Settings.findOne({ key: args.key }).lean()
          return { success: true, data: setting || { message: 'الإعداد غير موجود' } }
        }
        const settings = await models.Settings.find({}).lean()
        return { success: true, data: { settings } }
      }

      case 'update_settings': {
        const setting = await models.Settings.findOneAndUpdate(
          { key: args.key } as any,
          { value: args.value, updatedBy: adminUserId } as any,
          { new: true, upsert: true, runValidators: true }
        ).lean()
        return { success: true, data: setting }
      }

      default:
        return { success: false, error: `الأداة "${toolName}" غير معروفة` }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'حدث خطأ غير متوقع'
    console.error(`Tool executor error [${toolName}]:`, err)
    return { success: false, error: message }
  }
}
