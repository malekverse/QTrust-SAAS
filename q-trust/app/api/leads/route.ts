import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import dbConnect from '@/lib/db'
import Lead from '@/models/Lead'
import { requireSuperAdmin, TenantAuthError } from '@/lib/tenant'
import { leadLimiter, enforceRateLimit, getClientIp } from '@/lib/rate-limit'

const leadSchema = z.object({
  name: z.string().min(2, 'الاسم مطلوب').max(120),
  associationName: z.string().min(2, 'اسم الجمعية مطلوب').max(200),
  city: z.string().max(120).optional().or(z.literal('')),
  phone: z.string().min(8, 'رقم الهاتف مطلوب').max(30),
  email: z.string().email('البريد الإلكتروني غير صالح').max(200).optional().or(z.literal('')),
  studentCount: z.string().max(30).optional().or(z.literal('')),
  message: z.string().max(2000).optional().or(z.literal('')),
  locale: z.string().max(5).optional(),
  // Honeypot — a hidden field real users never see or fill. Bots often do.
  company: z.string().optional(),
})

// POST /api/leads — public demo-request form submission.
export async function POST(request: NextRequest) {
  try {
    const limited = await enforceRateLimit(leadLimiter, `lead:${getClientIp(request)}`)
    if (limited) return limited

    const parsed = leadSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
    }
    const d = parsed.data

    // Honeypot tripped: answer success (so the bot learns nothing) but save nothing.
    if (d.company && d.company.trim() !== '') {
      return NextResponse.json({ ok: true }, { status: 201 })
    }

    await dbConnect()
    await Lead.create({
      name: d.name,
      associationName: d.associationName,
      city: d.city || undefined,
      phone: d.phone,
      email: d.email || undefined,
      studentCount: d.studentCount || undefined,
      message: d.message || undefined,
      locale: d.locale || 'ar',
    })

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (e) {
    console.error('Lead submit error:', e)
    return NextResponse.json({ message: 'حدث خطأ. حاول مرة أخرى.' }, { status: 500 })
  }
}

// GET /api/leads — super-admin only: list demo requests.
export async function GET() {
  try {
    await requireSuperAdmin()
    await dbConnect()
    const leads = await Lead.find({}).sort({ createdAt: -1 }).limit(200).lean()
    return NextResponse.json(leads)
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('List leads error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
