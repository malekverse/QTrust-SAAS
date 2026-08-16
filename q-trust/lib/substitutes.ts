import SubstituteAssignment from '@/models/SubstituteAssignment'

void SubstituteAssignment

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
