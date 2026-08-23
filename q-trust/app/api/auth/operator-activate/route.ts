import { NextRequest, NextResponse } from 'next/server'
import type mongoose from 'mongoose'
import { z } from 'zod'
import dbConnect from '@/lib/db'
import User from '@/models/User'
import ActivationToken, { hashToken } from '@/models/ActivationToken'
import { hashPassword } from '@/lib/auth'
import { enforceRateLimit, getClientIp, loginLimiter } from '@/lib/rate-limit'
import { ROLES } from '@/lib/constants'

void User
void ActivationToken

// Tenant-less activation flow for a platform SUPER_ADMIN — its tenant
// slug column would be null, so the /t/[slug]/activate flow doesn't
// apply. Same shape as /api/auth/activate otherwise: single-use,
// atomic claim, hashed-at-rest token.
const verifySchema = z.object({ token: z.string().min(20).max(200) })
const activateSchema = verifySchema.extend({
  newPassword: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل').max(200),
})

export async function GET(request: NextRequest) {
  try {
    const limited = await enforceRateLimit(loginLimiter, `op-activate:${getClientIp(request)}`)
    if (limited) return limited
    const parsed = verifySchema.safeParse({
      token: new URL(request.url).searchParams.get('token') || '',
    })
    if (!parsed.success) {
      return NextResponse.json({ valid: false, reason: 'invalid' }, { status: 400 })
    }
    await dbConnect()
    const r = await resolve(parsed.data.token)
    if (!r.ok) {
      return NextResponse.json({ valid: false, reason: r.reason }, { status: r.status })
    }
    return NextResponse.json({
      valid: true,
      user: { fullName: r.user.fullName, email: r.user.email },
    })
  } catch (e) {
    console.error('operator-activate GET error:', e)
    return NextResponse.json({ valid: false, reason: 'error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const limited = await enforceRateLimit(loginLimiter, `op-activate:${getClientIp(request)}`)
    if (limited) return limited
    const parsed = activateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
    }
    await dbConnect()
    const r = await resolve(parsed.data.token)
    if (!r.ok) {
      return NextResponse.json({ message: reasonMessage(r.reason) }, { status: r.status })
    }
    const claimed = await ActivationToken.findOneAndUpdate(
      { _id: r.tokenId, usedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { usedAt: new Date() } },
      { returnDocument: 'after' }
    )
    if (!claimed) {
      return NextResponse.json({ message: reasonMessage('used') }, { status: 410 })
    }
    const passwordHash = await hashPassword(parsed.data.newPassword)
    await User.updateOne(
      { _id: r.user._id },
      { $set: { passwordHash, mustChangePassword: false, isEmailVerified: true } }
    )
    return NextResponse.json({ ok: true, loginUrl: '/auth/login' })
  } catch (e) {
    console.error('operator-activate POST error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}

type Reason = 'invalid' | 'expired' | 'used' | 'wrong_role'
type Ok = {
  ok: true
  tokenId: mongoose.Types.ObjectId
  user: {
    _id: mongoose.Types.ObjectId
    email: string
    fullName: string
    role: string
    isActive: boolean
  }
}
type Fail = { ok: false; reason: Reason; status: number }

async function resolve(token: string): Promise<Ok | Fail> {
  const tokenHash = hashToken(token)
  const tokenDoc = await ActivationToken.findOne({ tokenHash })
    .select('_id userId expiresAt usedAt')
    .lean<{
      _id: mongoose.Types.ObjectId
      userId: mongoose.Types.ObjectId
      expiresAt: Date
      usedAt?: Date
    } | null>()
  if (!tokenDoc) return { ok: false, reason: 'invalid', status: 404 }
  if (tokenDoc.usedAt) return { ok: false, reason: 'used', status: 410 }
  if (tokenDoc.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: 'expired', status: 410 }
  }
  const user = await User.findById(tokenDoc.userId)
    .select('_id email fullName role isActive')
    .lean<{
      _id: mongoose.Types.ObjectId
      email: string
      fullName: string
      role: string
      isActive: boolean
    } | null>()
  if (!user || !user.isActive) return { ok: false, reason: 'invalid', status: 404 }
  if (user.role !== ROLES.SUPER_ADMIN) {
    return { ok: false, reason: 'wrong_role', status: 403 }
  }
  return { ok: true, tokenId: tokenDoc._id, user }
}

function reasonMessage(r: Reason): string {
  if (r === 'expired') return 'انتهت صلاحية رابط التفعيل.'
  if (r === 'used') return 'تم استخدام هذا الرابط.'
  if (r === 'wrong_role') return 'الرابط لا يخص حساب مدير منصة.'
  return 'الرابط غير صالح.'
}
