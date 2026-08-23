import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { z } from 'zod'
import dbConnect from '@/lib/db'
import AdmissionApplication from '@/models/AdmissionApplication'
import Student from '@/models/Student'
import Tenant from '@/models/Tenant'
import { logActivity } from '@/models/ActivityLog'
import { requireTenantSession, TenantAuthError } from '@/lib/tenant'
import { ROLES, ADMISSION_STATUS } from '@/lib/constants'
import { generateQrUuid } from '@/lib/utils'
import { generateEnrollmentNumber } from '@/lib/enrollment'

void Student
void Tenant

const patchSchema = z.object({
  status: z.enum([
    ADMISSION_STATUS.PENDING,
    ADMISSION_STATUS.APPROVED,
    ADMISSION_STATUS.WAITLISTED,
    ADMISSION_STATUS.REJECTED,
  ]),
  reviewNotes: z.string().trim().max(500).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireTenantSession()
    if (ctx.role !== ROLES.ADMIN) {
      return NextResponse.json({ message: 'غير مصرح' }, { status: 403 })
    }

    const { id } = await params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'معرّف غير صالح' }, { status: 400 })
    }

    const parsed = patchSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
    }

    await dbConnect()

    const application = await AdmissionApplication.findOne({ _id: id, tenantId: ctx.tenantId })
    if (!application) {
      return NextResponse.json({ message: 'الطلب غير موجود' }, { status: 404 })
    }

    const { status, reviewNotes } = parsed.data

    // Approving converts the application into a real Student (once).
    if (status === ADMISSION_STATUS.APPROVED) {
      if (application.convertedStudentId) {
        return NextResponse.json({ message: 'تم قبول هذا الطلب مسبقاً' }, { status: 409 })
      }

      const tenant = await Tenant.findById(ctx.tenantId)
        .select('plan limits')
        .lean<{ plan: string; limits?: { maxStudents?: number | null } }>()
      if (!tenant) {
        return NextResponse.json({ message: 'المؤسسة غير موجودة' }, { status: 403 })
      }
      const { getEffectiveLimits } = await import('@/lib/entitlements')
      const { maxStudents } = getEffectiveLimits(tenant as any)
      if (maxStudents !== null) {
        const activeCount = await Student.countDocuments({ tenantId: ctx.tenantId, isActive: true })
        if (activeCount >= maxStudents) {
          return NextResponse.json(
            {
              message: `لقد بلغت الحدّ الأقصى لعدد الطلاب في باقتك (${maxStudents} طالب). يرجى ترقية الاشتراك قبل قبول طلبات جديدة.`,
            },
            { status: 403 }
          )
        }
      }

      const enrollmentNumber = await generateEnrollmentNumber(ctx.tenantId)
      const student = await Student.create({
        tenantId: ctx.tenantId,
        firstName: application.firstName,
        lastName: application.lastName,
        fullName: `${application.firstName} ${application.lastName}`,
        gender: application.gender,
        cin: application.cin,
        dateOfBirth: application.dateOfBirth,
        educationLevel: application.educationLevel,
        address: application.address,
        parentName: application.parentName,
        parentPhone: application.parentPhone,
        parentEmail: application.parentEmail,
        notes: application.medicalNotes,
        // Admin approval stands in for the paper declaration.
        declarationAccepted: true,
        enrollmentNumber,
        qrUuid: generateQrUuid(),
        isActive: true,
      })

      application.status = ADMISSION_STATUS.APPROVED
      application.convertedStudentId = student._id
      application.reviewNotes = reviewNotes
      application.reviewedByUserId = mongoose.Types.ObjectId.createFromHexString(ctx.userId)
      application.reviewedAt = new Date()
      await application.save()

      await logActivity('STUDENT_CREATED', `${student.firstName} ${student.lastName}`, {
        tenantId: ctx.tenantId,
        studentId: student._id,
        userId: ctx.userId,
      })

      return NextResponse.json({ application, studentId: student._id })
    }

    // Non-approval status changes: just record the decision.
    application.status = status
    application.reviewNotes = reviewNotes
    application.reviewedByUserId = mongoose.Types.ObjectId.createFromHexString(ctx.userId)
    application.reviewedAt = new Date()
    await application.save()

    return NextResponse.json({ application })
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    if (e instanceof Error && e.name === 'ValidationError') {
      const errors = (e as unknown as { errors: Record<string, { message: string }> }).errors
      const msg = Object.values(errors).map((err) => err.message).join(', ')
      return NextResponse.json({ message: msg }, { status: 400 })
    }
    const err = e as { code?: number; keyPattern?: Record<string, unknown> }
    if (err.code === 11000 && err.keyPattern?.cin) {
      return NextResponse.json({ message: 'رقم بطاقة التعريف مستخدم مسبقاً' }, { status: 400 })
    }
    console.error('Admission review error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
