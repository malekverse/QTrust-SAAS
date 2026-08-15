import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import dbConnect from '@/lib/db'
import AdmissionApplication from '@/models/AdmissionApplication'
import { resolveTenantBySlug } from '@/lib/tenant'
import { admissionLimiter, enforceRateLimit, getClientIp } from '@/lib/rate-limit'

const enrollSchema = z.object({
  firstName: z.string().trim().min(2, 'الاسم مطلوب').max(50),
  lastName: z.string().trim().min(2, 'اللقب مطلوب').max(50),
  gender: z.enum(['MALE', 'FEMALE']),
  cin: z.string().trim().regex(/^\d{8}$/, 'رقم بطاقة التعريف يجب أن يكون 8 أرقام').optional().or(z.literal('')),
  dateOfBirth: z.string().optional().or(z.literal('')),
  educationLevel: z.string().trim().max(100).optional().or(z.literal('')),
  address: z.string().trim().max(200).optional().or(z.literal('')),
  parentName: z.string().trim().max(100).optional().or(z.literal('')),
  parentPhone: z.string().trim().regex(/^\+216\d{8}$/, 'رقم الهاتف يجب أن يكون بصيغة +216XXXXXXXX').optional().or(z.literal('')),
  parentEmail: z.string().trim().email('البريد الإلكتروني غير صالح').optional().or(z.literal('')),
  medicalNotes: z.string().trim().max(500).optional().or(z.literal('')),
  // Honeypot: real users never fill this hidden field; bots often do.
  company: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  try {
    const { tenantSlug } = await params

    const limited = await enforceRateLimit(admissionLimiter, getClientIp(request))
    if (limited) return limited

    const parsed = enrollSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
    }

    // Honeypot tripped — pretend success so bots don't learn, but store nothing.
    if (parsed.data.company && parsed.data.company.trim() !== '') {
      return NextResponse.json({ ok: true }, { status: 201 })
    }

    const tenant = await resolveTenantBySlug(tenantSlug)
    if (!tenant) {
      return NextResponse.json({ message: 'المؤسسة غير موجودة' }, { status: 404 })
    }

    await dbConnect()

    const d = parsed.data
    const empty = (v?: string) => (v && v.trim() !== '' ? v.trim() : undefined)

    await AdmissionApplication.create({
      tenantId: tenant._id,
      firstName: d.firstName,
      lastName: d.lastName,
      gender: d.gender,
      cin: empty(d.cin),
      dateOfBirth: empty(d.dateOfBirth) ? new Date(d.dateOfBirth as string) : undefined,
      educationLevel: empty(d.educationLevel),
      address: empty(d.address),
      parentName: empty(d.parentName),
      parentPhone: empty(d.parentPhone),
      parentEmail: empty(d.parentEmail),
      medicalNotes: empty(d.medicalNotes),
    })

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (e) {
    if (e instanceof Error && e.name === 'ValidationError') {
      const errors = (e as unknown as { errors: Record<string, { message: string }> }).errors
      const msg = Object.values(errors).map((err) => err.message).join(', ')
      return NextResponse.json({ message: msg }, { status: 400 })
    }
    console.error('Enroll error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
