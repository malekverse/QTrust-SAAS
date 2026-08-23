import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import dbConnect from '@/lib/db'
import { requireSuperAdmin, TenantAuthError } from '@/lib/tenant'
import User from '@/models/User'
import ActivationToken, {
  DEFAULT_ACTIVATION_TTL_MS,
  generateActivationToken,
} from '@/models/ActivationToken'
import { hashPassword } from '@/lib/auth'
import { ROLES } from '@/lib/constants'
import { logPlatformAudit } from '@/models/PlatformAuditLog'
import { getClientIp } from '@/lib/rate-limit'

void User
void ActivationToken

// GET /api/super-admin/operators — list every SUPER_ADMIN. Small
// collection, no pagination.
export async function GET() {
  try {
    await requireSuperAdmin()
    await dbConnect()
    const rows = await User.find({ role: ROLES.SUPER_ADMIN })
      .sort({ createdAt: 1 })
      .select('_id fullName email isActive mustChangePassword lastLoginAt createdAt')
      .lean()
    return NextResponse.json(rows)
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('operators list error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}

const createSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(200),
})

// POST /api/super-admin/operators — create a new SUPER_ADMIN and issue
// an activation link. Same mechanism as Phase 2 tenant admins:
// unknowable random password, activation token stored as sha256, link
// shown once. tenantId is deliberately not set — SUPER_ADMINs are
// cross-tenant. The public /t/[slug]/activate page validates the
// tenant slug in the URL against the user's tenantId, so a
// SUPER_ADMIN's activation URL uses a distinct entry — see
// /auth/operator-activate.
export async function POST(request: NextRequest) {
  try {
    const actor = await requireSuperAdmin()
    const parsed = createSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
    }
    const d = parsed.data
    await dbConnect()

    const unknowablePassword = randomBytes(48).toString('base64')
    const passwordHash = await hashPassword(unknowablePassword)

    let user
    try {
      user = await User.create({
        fullName: d.fullName,
        email: d.email,
        role: ROLES.SUPER_ADMIN,
        passwordHash,
        isActive: true,
        isEmailVerified: false,
        mustChangePassword: true,
        // tenantId intentionally omitted — the User schema's `required`
        // function allows this only for SUPER_ADMIN.
      })
    } catch (err: any) {
      if (err?.code === 11000) {
        return NextResponse.json(
          { message: 'البريد الإلكتروني مستخدم بالفعل' },
          { status: 409 }
        )
      }
      throw err
    }

    const { token, tokenHash } = generateActivationToken()
    const expiresAt = new Date(Date.now() + DEFAULT_ACTIVATION_TTL_MS)
    await ActivationToken.create({
      userId: user._id,
      tokenHash,
      expiresAt,
      issuedBy: new mongoose.Types.ObjectId(actor.id),
      issuedAt: new Date(),
      purpose: 'activation',
    })

    const siteUrl = (
      process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
    ).replace(/\/$/, '')
    const activationUrl = `${siteUrl}/auth/operator-activate?token=${encodeURIComponent(token)}`

    await logPlatformAudit({
      actorUserId: actor.id,
      actorEmail: actor.email || 'unknown',
      action: 'SUPER_ADMIN_CREATED',
      targetType: 'User',
      targetId: user._id,
      metadata: { email: user.email, fullName: user.fullName },
      ip: getClientIp(request),
      userAgent: request.headers.get('user-agent') || undefined,
    })

    return NextResponse.json(
      {
        user: { _id: user._id, fullName: user.fullName, email: user.email },
        activation: { url: activationUrl, expiresAt },
      },
      { status: 201 }
    )
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('operators create error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
