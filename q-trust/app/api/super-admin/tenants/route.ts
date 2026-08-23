import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import dbConnect from '@/lib/db'
import { requireSuperAdmin, TenantAuthError } from '@/lib/tenant'
import Tenant from '@/models/Tenant'
import User from '@/models/User'
import Student from '@/models/Student'
import { PLANS, ROLES } from '@/lib/constants'
import { parsePagination, buildPaginatedResponse } from '@/lib/pagination'
import { logPlatformAudit } from '@/models/PlatformAuditLog'
import { getClientIp } from '@/lib/rate-limit'
import { provisionTenant, ProvisionError, normalizeTunisiaPhone } from '@/lib/provisioning'

// Force model registration for serverless
void Tenant
void User
void Student

const createTenantSchema = z.object({
  name: z.string().min(2, 'اسم المؤسسة مطلوب').max(200),
  slug: z
    .string()
    .min(2, 'المعرّف قصير جداً')
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'المعرّف: أحرف لاتينية صغيرة وأرقام وشرطات فقط'),
  plan: z.enum([PLANS.STARTER, PLANS.STANDARD, PLANS.PREMIUM]),
  adminFullName: z.string().min(2, 'اسم المدير مطلوب').max(100),
  adminEmail: z.string().email('البريد الإلكتروني غير صالح'),
  adminPhone: z.string().max(30).optional().or(z.literal('')),
  setupFeeAmountTND: z.coerce.number().min(0).default(0),
  annualFeeAmountTND: z.coerce.number().min(0).default(0),
  // Optional lead being converted. On success the lead is atomically claimed
  // as CONVERTED with convertedTenantId set; a second submit gets a 409.
  leadId: z.string().optional(),
})

// GET /api/super-admin/tenants?page=&limit=&search= — list tenants.
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin()
    await dbConnect()

    const url = new URL(request.url)
    const search = url.searchParams.get('search')?.trim()
    const pg = parsePagination(request, { limit: 25 })

    const filter: Record<string, unknown> = {}
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const rx = new RegExp(escaped, 'i')
      filter.$or = [{ name: rx }, { slug: rx }, { 'contact.email': rx }]
    }
    // Hide half-provisioned tenants from the list.
    filter.provisioningState = { $ne: 'PROVISIONING' }

    const [tenants, total] = await Promise.all([
      Tenant.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit).lean(),
      Tenant.countDocuments(filter),
    ])

    // Fold student counts and admin emails in via two aggregations rather
    // than per-tenant N+1 queries.
    const tenantIds = tenants.map((t: any) => t._id)
    const [studentCounts, adminEmails] = await Promise.all([
      Student.aggregate([
        { $match: { tenantId: { $in: tenantIds }, isActive: true } },
        { $group: { _id: '$tenantId', count: { $sum: 1 } } },
      ]),
      User.aggregate([
        { $match: { tenantId: { $in: tenantIds }, role: ROLES.ADMIN } },
        { $sort: { createdAt: 1 } },
        { $group: { _id: '$tenantId', email: { $first: '$email' } } },
      ]),
    ])
    const studentMap = new Map<string, number>(
      studentCounts.map((s: any) => [String(s._id), s.count])
    )
    const emailMap = new Map<string, string>(
      adminEmails.map((a: any) => [String(a._id), a.email])
    )

    const withStats = tenants.map((t: any) => ({
      ...t,
      studentCount: studentMap.get(String(t._id)) ?? 0,
      adminEmail: emailMap.get(String(t._id)) ?? null,
    }))

    return NextResponse.json(buildPaginatedResponse(withStats, total, pg))
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('List tenants error:', e)
    return NextResponse.json({ message: 'حدث خطأ أثناء جلب المؤسسات' }, { status: 500 })
  }
}

// POST /api/super-admin/tenants — provision a new tenant (and its first admin).
// Optionally converts a lead (`leadId`) in the same atomic step.
export async function POST(request: NextRequest) {
  try {
    const actor = await requireSuperAdmin()

    const body = await request.json()
    const parsed = createTenantSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
    }
    const d = parsed.data

    // Normalize the operator-typed phone (accepts 8 digits or +216XXXXXXXX).
    let adminPhone: string | undefined
    try {
      adminPhone = normalizeTunisiaPhone(d.adminPhone)
    } catch (e) {
      if (e instanceof ProvisionError) {
        return NextResponse.json({ message: e.message }, { status: e.status })
      }
      throw e
    }

    await dbConnect()

    const result = await provisionTenant(
      {
        name: d.name,
        slug: d.slug,
        plan: d.plan,
        adminFullName: d.adminFullName,
        adminEmail: d.adminEmail,
        adminPhone,
        setupFeeAmountTND: d.setupFeeAmountTND,
        annualFeeAmountTND: d.annualFeeAmountTND,
        leadId: d.leadId,
      },
      { id: actor.id, email: actor.email || 'unknown' }
    )

    await logPlatformAudit({
      actorUserId: actor.id,
      actorEmail: actor.email || 'unknown',
      action: 'TENANT_PROVISIONED',
      targetType: 'Tenant',
      targetId: result.tenant._id,
      tenantId: result.tenant._id,
      metadata: {
        name: result.tenant.name,
        slug: result.tenant.slug,
        plan: result.tenant.plan,
        leadId: d.leadId,
        leadClaimed: result.leadClaimed,
      },
      ip: getClientIp(request),
      userAgent: request.headers.get('user-agent') || undefined,
    })

    if (result.leadClaimed && d.leadId) {
      await logPlatformAudit({
        actorUserId: actor.id,
        actorEmail: actor.email || 'unknown',
        action: 'LEAD_CONVERTED',
        targetType: 'Lead',
        targetId: d.leadId,
        tenantId: result.tenant._id,
        ip: getClientIp(request),
        userAgent: request.headers.get('user-agent') || undefined,
      })
    }

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, '')
    const activationUrl = `${siteUrl}/t/${result.tenant.slug}/activate?token=${encodeURIComponent(result.activation.token)}`

    return NextResponse.json(
      {
        tenant: {
          _id: result.tenant._id,
          name: result.tenant.name,
          slug: result.tenant.slug,
          plan: result.tenant.plan,
        },
        admin: { email: result.admin.email },
        activation: {
          url: activationUrl,
          expiresAt: result.activation.expiresAt,
        },
        loginUrl: `/t/${result.tenant.slug}`,
      },
      { status: 201 }
    )
  } catch (e: any) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    if (e instanceof ProvisionError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    if (e?.code === 11000) {
      return NextResponse.json(
        { message: 'المعرّف أو البريد مستخدم بالفعل' },
        { status: 409 }
      )
    }
    console.error('Create tenant error:', e)
    return NextResponse.json({ message: 'حدث خطأ أثناء إنشاء المؤسسة' }, { status: 500 })
  }
}
