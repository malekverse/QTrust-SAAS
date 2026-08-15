import Student from '@/models/Student'

// Generate the next per-tenant enrollment number (format: YYYY-XXX).
// Shared so every creation path — the admin students API, AI create_student,
// and admissions approval — produces identically-formatted numbers.
export async function generateEnrollmentNumber(tenantId: string): Promise<string> {
  const currentYear = new Date().getFullYear()
  const yearPrefix = `${currentYear}-`

  const lastStudent = await Student.findOne({
    tenantId,
    enrollmentNumber: { $regex: `^${yearPrefix}` },
  })
    .sort({ enrollmentNumber: -1 })
    .select('enrollmentNumber')
    .lean<{ enrollmentNumber?: string }>()

  let nextNumber = 1
  if (lastStudent?.enrollmentNumber) {
    const lastNumber = parseInt(lastStudent.enrollmentNumber.split('-')[1], 10)
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1
    }
  }

  return `${yearPrefix}${nextNumber.toString().padStart(3, '0')}`
}
