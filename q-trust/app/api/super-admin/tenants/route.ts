import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import dbConnect from '@/lib/db'
import { requireSuperAdmin, TenantAuthError } from '@/lib/tenant'
import { hashPassword, generateTempPassword } from '@/lib/auth'
import Tenant from '@/models/Tenant'
import User from '@/models/User'
import Student from '@/models/Student'
import Settings, { DEFAULT_ENROLLMENT_SETTINGS } from '@/models/Settings'
import Invoice from '@/models/Invoice'
import {
  ROLES,
  PLANS,
  PLAN_LIMITS,
  TENANT_STATUS,
  PAYMENT_METHODS,
  INVOICE_TYPES,
  INVOICE_STATUS,
} from '@/lib/constants'
import { parsePagination, buildPaginatedResponse } from '@/lib/pagination'

// Force model registration for serverless
void Tenant
void User
void Student
void Settings
void Invoice

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
  adminPhone: z
    .string()
    .regex(/^\+216\d{8}$/, 'رقم الهاتف يجب أن يكون بصيغة +216XXXXXXXX')
    .optional()
    .or(z.literal('')),
  setupFeeAmountTND: z.coerce.number().min(0).default(0),
  annualFeeAmountTND: z.coerce.number().min(0).default(0),
})

// GET /api/super-admin/tenants?page=&limit= — list tenants (paginated, super-admin only)
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin()
    await dbConnect()

    const pg = parsePagination(request, { limit: 25 })

    const [tenants, total] = await Promise.all([
      Tenant.find({}).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit).lean(),
      Tenant.countDocuments({}),
    ])

    const withStats = await Promise.all(
      tenants.map(async (t: any) => {
        const [studentCount, admin] = await Promise.all([
          Student.countDocuments({ tenantId: t._id, isActive: true }),
          User.findOne({ tenantId: t._id, role: ROLES.ADMIN }).select('email').lean(),
        ])
        return { ...t, studentCount, adminEmail: (admin as any)?.email ?? null }
      })
    )

    return NextResponse.json(buildPaginatedResponse(withStats, total, pg))
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('List tenants error:', e)
    return NextResponse.json({ message: 'حدث خطأ أثناء جلب المؤسسات' }, { status: 500 })
  }
}

// POST /api/super-admin/tenants — provision a new tenant + its first admin
export async function POST(request: NextRequest) {
  try {
    const su = await requireSuperAdmin()

    const body = await request.json()
    const parsed = createTenantSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
    }
    const d = parsed.data

    await dbConnect()

    if (await Tenant.findOne({ slug: d.slug }).select('_id').lean()) {
      return NextResponse.json({ message: 'المعرّف مستخدم بالفعل' }, { status: 409 })
    }

    const limits = PLAN_LIMITS[d.plan]
    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setFullYear(periodEnd.getFullYear() + 1)

    const tenant = await Tenant.create({
      name: d.name,
      slug: d.slug,
      plan: d.plan,
      status: TENANT_STATUS.TRIAL,
      maxStudents: limits.maxStudents,
      aiQuotaMonthly: limits.aiQuotaMonthly,
      isDemo: false,
      branding: { displayName: d.name, locale: 'ar' },
      contact: { email: d.adminEmail.toLowerCase(), phone: d.adminPhone || undefined },
      billing: {
        setupFeeAmountTND: d.setupFeeAmountTND,
        annualFeeAmountTND: d.annualFeeAmountTND,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        paymentMethod: PAYMENT_METHODS.BANK_TRANSFER,
      },
    })

    const tempPassword = generateTempPassword()
    const passwordHash = await hashPassword(tempPassword)
    const admin = await User.create({
      tenantId: tenant._id,
      fullName: d.adminFullName,
      email: d.adminEmail.toLowerCase(),
      phone: d.adminPhone || undefined,
      role: ROLES.ADMIN,
      passwordHash,
      isEmailVerified: false,
      isActive: true,
      mustChangePassword: true,
    })

    // Seed the tenant's own enrollment-numbering settings.
    await Settings.create({
      tenantId: tenant._id,
      key: 'enrollment',
      value: DEFAULT_ENROLLMENT_SETTINGS as unknown as Record<string, unknown>,
      description: 'إعدادات ترقيم الانخراط',
      updatedBy: admin._id,
    })

    // Auto-create the opening invoices (setup due now, renewal due in a year).
    const invoices: Record<string, unknown>[] = []
    if (d.setupFeeAmountTND > 0) {
      invoices.push({
        tenantId: tenant._id,
        type: INVOICE_TYPES.SETUP,
        amountTND: d.setupFeeAmountTND,
        status: INVOICE_STATUS.PENDING,
        dueDate: now,
        createdBy: su.id,
      })
    }
    if (d.annualFeeAmountTND > 0) {
      invoices.push({
        tenantId: tenant._id,
        type: INVOICE_TYPES.ANNUAL_RENEWAL,
        amountTND: d.annualFeeAmountTND,
        status: INVOICE_STATUS.PENDING,
        dueDate: periodEnd,
        createdBy: su.id,
      })
    }
    if (invoices.length) await Invoice.insertMany(invoices)

    return NextResponse.json(
      {
        tenant: { _id: tenant._id, name: tenant.name, slug: tenant.slug, plan: tenant.plan },
        admin: { email: admin.email, tempPassword },
        loginUrl: `/t/${tenant.slug}`,
      },
      { status: 201 }
    )
  } catch (e: any) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    if (e?.code === 11000) {
      return NextResponse.json({ message: 'المعرّف أو البريد مستخدم بالفعل' }, { status: 409 })
    }
    console.error('Create tenant error:', e)
    return NextResponse.json({ message: 'حدث خطأ أثناء إنشاء المؤسسة' }, { status: 500 })
  }
}
