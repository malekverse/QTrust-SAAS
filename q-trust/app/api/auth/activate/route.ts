import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import dbConnect from '@/lib/db'
import User from '@/models/User'
import Tenant from '@/models/Tenant'
import ActivationToken, { hashToken } from '@/models/ActivationToken'
import { hashPassword } from '@/lib/auth'
import { enforceRateLimit, getClientIp, loginLimiter } from '@/lib/rate-limit'

void User
void Tenant
void ActivationToken

const verifySchema = z.object({
  token: z.string().min(20).max(200),
  slug: z.string().min(2).max(60),
})
const activateSchema = verifySchema.extend({
  newPassword: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل').max(200),
})

// GET /api/auth/activate?token=…&slug=…
// Public. Returns whether the token is valid + the target admin's summary,
// so the /t/[slug]/activate page can render "welcome, X" before asking for
// a password. No user enumeration: an invalid or expired token gets the
// same response shape as any other failure.
export async function GET(request: NextRequest) {
  try {
    const limited = await enforceRateLimit(loginLimiter, `activate:${getClientIp(request)}`)
    if (limited) return limited

    const url = new URL(request.url)
    const parsed = verifySchema.safeParse({
      token: url.searchParams.get('token') || '',
      slug: url.searchParams.get('slug') || '',
    })
    if (!parsed.success) {
      return NextResponse.json({ valid: false, reason: 'invalid' }, { status: 400 })
    }
    const { token, slug } = parsed.data
    await dbConnect()
    const check = await resolveToken(token, slug)
    if (!check.ok) {
      return NextResponse.json({ valid: false, reason: check.reason }, { status: check.status })
    }
    return NextResponse.json({
      valid: true,
      user: { fullName: check.user.fullName, email: check.user.email },
      tenant: { name: check.tenant.name, slug: check.tenant.slug },
    })
  } catch (e) {
    console.error('activate GET error:', e)
    return NextResponse.json({ valid: false, reason: 'error' }, { status: 500 })
  }
}

// POST /api/auth/activate
// Consumes the token, sets the user's password, clears mustChangePassword,
// marks the token used. Idempotent — a used token errors out with 410.
export async function POST(request: NextRequest) {
  try {
    const limited = await enforceRateLimit(loginLimiter, `activate:${getClientIp(request)}`)
    if (limited) return limited

    const parsed = activateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
    }
    const { token, slug, newPassword } = parsed.data
    await dbConnect()

    const check = await resolveToken(token, slug)
    if (!check.ok) {
      return NextResponse.json(
        { message: statusMessage(check.reason) },
        { status: check.status }
      )
    }

    // Atomically claim the token: only proceed if it's still unused and
    // unexpired. If someone else already consumed it, this returns null
    // and we fail with 410 GONE — no chance to double-activate.
    const claimed = await ActivationToken.findOneAndUpdate(
      {
        _id: check.tokenDoc._id,
        usedAt: null,
        expiresAt: { $gt: new Date() },
      },
      { $set: { usedAt: new Date() } },
      { returnDocument: 'after' }
    )
    if (!claimed) {
      return NextResponse.json(
        { message: statusMessage('used') },
        { status: 410 }
      )
    }

    // Set the password and clear the first-login flag. Setting passwordHash
    // is what a future purge hook (Phase 3+) hangs off of; today it does
    // the direct update.
    const passwordHash = await hashPassword(newPassword)
    await User.updateOne(
      { _id: check.user._id },
      { $set: { passwordHash, mustChangePassword: false, isEmailVerified: true } }
    )

    return NextResponse.json({ ok: true, loginUrl: `/t/${check.tenant.slug}` })
  } catch (e) {
    console.error('activate POST error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}

type TokenReason = 'invalid' | 'expired' | 'used' | 'tenant_mismatch' | 'blocked'
import type mongooseType from 'mongoose'
type ResolveOk = {
  ok: true
  tokenDoc: { _id: mongooseType.Types.ObjectId }
  user: { _id: mongooseType.Types.ObjectId; email: string; fullName: string }
  tenant: {
    _id: mongooseType.Types.ObjectId
    name: string
    slug: string
    provisioningState?: string
    status: string
  }
}
type ResolveFail = { ok: false; reason: TokenReason; status: number }

async function resolveToken(token: string, slug: string): Promise<ResolveOk | ResolveFail> {
  const tokenHash = hashToken(token)
  const tokenDoc = await ActivationToken.findOne({ tokenHash })
    .select('_id userId tenantId expiresAt usedAt')
    .lean<{
      _id: mongooseType.Types.ObjectId
      userId: mongooseType.Types.ObjectId
      tenantId?: mongooseType.Types.ObjectId
      expiresAt: Date
      usedAt?: Date
    } | null>()
  if (!tokenDoc) return { ok: false, reason: 'invalid', status: 404 }
  if (tokenDoc.usedAt) return { ok: false, reason: 'used', status: 410 }
  if (tokenDoc.expiresAt.getTime() <= Date.now()) return { ok: false, reason: 'expired', status: 410 }

  const [user, tenant] = await Promise.all([
    User.findById(tokenDoc.userId)
      .select('_id email fullName tenantId isActive')
      .lean<{
        _id: mongooseType.Types.ObjectId
        email: string
        fullName: string
        tenantId?: mongooseType.Types.ObjectId
        isActive: boolean
      } | null>(),
    Tenant.findOne({ slug: slug.toLowerCase() })
      .select('_id name slug status provisioningState')
      .lean<{
        _id: mongooseType.Types.ObjectId
        name: string
        slug: string
        status: string
        provisioningState?: string
      } | null>(),
  ])
  if (!user || !user.isActive) return { ok: false, reason: 'invalid', status: 404 }
  if (!tenant) return { ok: false, reason: 'tenant_mismatch', status: 404 }
  if (String(user.tenantId) !== String(tenant._id)) {
    return { ok: false, reason: 'tenant_mismatch', status: 404 }
  }
  if (tenant.provisioningState && tenant.provisioningState !== 'READY') {
    return { ok: false, reason: 'blocked', status: 409 }
  }
  if (tenant.status === 'SUSPENDED' || tenant.status === 'CANCELLED') {
    return { ok: false, reason: 'blocked', status: 403 }
  }

  return { ok: true, tokenDoc: { _id: tokenDoc._id }, user, tenant }
}

function statusMessage(reason: TokenReason): string {
  switch (reason) {
    case 'expired':
      return 'انتهت صلاحية رابط التفعيل. اطلب رابطاً جديداً.'
    case 'used':
      return 'تم استخدام هذا الرابط. سجّل الدخول باستخدام كلمة المرور.'
    case 'tenant_mismatch':
      return 'الرابط لا يطابق هذه المؤسسة.'
    case 'blocked':
      return 'المؤسسة معلّقة. يرجى التواصل مع إدارة المنصة.'
    default:
      return 'رابط التفعيل غير صالح.'
  }
}
