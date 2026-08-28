import SubstituteAssignment from '@/models/SubstituteAssignment'
import SessionTemplate from '@/models/SessionTemplate'
import StudentSession from '@/models/StudentSession'

void SubstituteAssignment
void SessionTemplate
void StudentSession

// Session-template ids the given user may currently access as a substitute
// (i.e. has an assignment whose [validFrom, validTo] window contains now).
export async function getActiveSubstituteTemplateIds(
  tenantId: string,
  userId: string
): Promise<string[]> {
  const now = new Date()
  const rows = await SubstituteAssignment.find({
    tenantId,
    substituteUserId: userId,
    validFrom: { $lte: now },
    validTo: { $gte: now },
  })
    .select('sessionTemplateId')
    .lean<{ sessionTemplateId: { toString(): string } }[]>()
  return rows.map((r) => r.sessionTemplateId.toString())
}

// Whether the user may act as substitute on a specific template right now.
export async function isActiveSubstituteFor(
  tenantId: string,
  userId: string,
  sessionTemplateId: string
): Promise<boolean> {
  const now = new Date()
  const found = await SubstituteAssignment.exists({
    tenantId,
    substituteUserId: userId,
    sessionTemplateId,
    validFrom: { $lte: now },
    validTo: { $gte: now },
  })
  return !!found
}

// Whether a teacher may record data (hifz, behavior, grades, feedback) about a
// student: true when the student is enrolled in at least one session the
// teacher owns, or one they currently substitute for. Admins bypass this — call
// it only for ROLES.TEACHER. Mirrors the ownership rule that
// /api/sessions/[id]/attendance already enforces, so a teacher can never write
// records for a student outside their own halaqa.
export async function teacherCanAccessStudent(
  tenantId: string,
  userId: string,
  studentId: string
): Promise<boolean> {
  // Templates the teacher owns outright, plus any they substitute for now.
  const owned = await SessionTemplate.find({ tenantId, teacherId: userId })
    .select('_id')
    .lean<{ _id: { toString(): string } }[]>()
  const templateIds = owned.map((t) => t._id.toString())
  templateIds.push(...(await getActiveSubstituteTemplateIds(tenantId, userId)))

  if (templateIds.length === 0) return false

  const enrolled = await StudentSession.exists({
    tenantId,
    studentId,
    sessionTemplateId: { $in: templateIds },
    isActive: true,
  })
  return !!enrolled
}
