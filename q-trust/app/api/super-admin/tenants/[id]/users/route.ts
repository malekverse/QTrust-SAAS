import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import dbConnect from '@/lib/db'
import { requireSuperAdmin, TenantAuthError } from '@/lib/tenant'
import Tenant from '@/models/Tenant'
import User from '@/models/User'
import ActivationToken, {
  DEFAULT_ACTIVATION_TTL_MS,
  generateActivationToken,
} from '@/models/ActivationToken'
import { logPlatformAudit } from '@/models/PlatformAuditLog'
import { getClientIp } from '@/lib/rate-limit'
import { hashPassword } from '@/lib/auth'
import { ROLES } from '@/lib/constants'
import { normalizeTunisiaPhone } from '@/lib/provisioning'

void Tenant
void User
void ActivationToken

// GET /api/super-admin/tenants/[id]/users
// Lists all users for a tenant with the fields the operator cares about
// on the users panel: role, activation state, last login, contact.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin()
    const { id } = await params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'معرّف غير صالح' }, { status: 400 })
    }
    await dbConnect()
    const tenantId = new mongoose.Types.ObjectId(id)
    const users = await User.find({ tenantId })
      .sort({ role: 1, createdAt: 1 })
      .select('_id fullName email phone role isActive mustChangePassword lastLoginAt createdAt')
      .lean()
    return NextResponse.json(users)
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('list tenant users error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}

const createSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  // For safety, this endpoint only creates additional ADMIN operators —
  // creating TEACHERs or STUDENTs is a tenant-side workflow.
  role: z.enum([ROLES.ADMIN]).default(ROLES.ADMIN),
})

// POST /api/super-admin/tenants/[id]/users
// Creates a second admin on the tenant and issues an activation token so
// the person can set their own password. Mirrors the Phase 2 flow used
// at provisioning. Returns the activation URL exactly once.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireSuperAdmin()
    const { id } = await params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'معرّف غير صالح' }, { status: 400 })
    }
    const parsed = createSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
    }
    const d = parsed.data

    await dbConnect()
    const tenant = await Tenant.findById(id).select('_id slug').lean<
      { _id: mongoose.Types.ObjectId; slug: string } | null
    >()
    if (!tenant) return NextResponse.json({ message: 'المؤسسة غير موجودة' }, { status: 404 })

    let phone: string | undefined
    try {
      phone = normalizeTunisiaPhone(d.phone)
    } catch {
      return NextResponse.json(
        { message: 'رقم الهاتف يجب أن يكون بصيغة +216XXXXXXXX' },
        { status: 400 }
      )
    }

    // Unknowable password — like Phase 2. The new admin authenticates via
    // the activation link.
    const unknowablePassword = randomBytes(48).toString('base64')
    const passwordHash = await hashPassword(unknowablePassword)

    let user
    try {
      user = await User.create({
        tenantId: tenant._id,
        fullName: d.fullName,
        email: d.email,
        phone,
        role: d.role,
        passwordHash,
        isActive: true,
        isEmailVerified: false,
        mustChangePassword: true,
      })
    } catch (err: any) {
      if (err?.code === 11000) {
        return NextResponse.json(
          { message: 'البريد الإلكتروني مستخدم بالفعل ضمن هذه المؤسسة' },
          { status: 409 }
        )
      }
      throw err
    }

    const { token, tokenHash } = generateActivationToken()
    const expiresAt = new Date(Date.now() + DEFAULT_ACTIVATION_TTL_MS)
    await ActivationToken.create({
      userId: user._id,
      tenantId: tenant._id,
      tokenHash,
      expiresAt,
      issuedBy: new mongoose.Types.ObjectId(actor.id),
      issuedAt: new Date(),
      purpose: 'activation',
    })

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, '')
    const activationUrl = `${siteUrl}/t/${tenant.slug}/activate?token=${encodeURIComponent(token)}`

    await logPlatformAudit({
      actorUserId: actor.id,
      actorEmail: actor.email || 'unknown',
      action: 'TENANT_UPDATED',
      targetType: 'User',
      targetId: user._id,
      tenantId: tenant._id,
      metadata: { addedUser: user.email, role: user.role },
      ip: getClientIp(request),
      userAgent: request.headers.get('user-agent') || undefined,
    })

    return NextResponse.json(
      {
        user: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
        },
        activation: { url: activationUrl, expiresAt },
      },
      { status: 201 }
    )
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('create tenant user error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
