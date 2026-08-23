import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import dbConnect from '@/lib/db'
import { requireSuperAdmin, TenantAuthError } from '@/lib/tenant'
import Tenant from '@/models/Tenant'
import User from '@/models/User'
import ActivationToken from '@/models/ActivationToken'
import { ROLES } from '@/lib/constants'

void Tenant
void User
void ActivationToken

// GET /api/super-admin/tenants/[id]/access
//
// Read-only summary for the AccessCard. Returns the admin's contact info,
// activation state (issued / used / expired / never), and the last-send
// metadata. NEVER returns the plaintext token — that only exists once, at
// the moment it is issued.
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
    const tenant = await Tenant.findById(id).select('_id slug').lean<
      { _id: mongoose.Types.ObjectId; slug: string } | null
    >()
    if (!tenant) return NextResponse.json({ message: 'المؤسسة غير موجودة' }, { status: 404 })

    const admin = await User.findOne({ tenantId: tenant._id, role: ROLES.ADMIN })
      .sort({ createdAt: 1 })
      .select('_id fullName email phone mustChangePassword isActive lastLoginAt')
      .lean<{
        _id: mongoose.Types.ObjectId
        fullName: string
        email: string
        phone?: string
        mustChangePassword: boolean
        isActive: boolean
        lastLoginAt?: Date
      } | null>()

    const token = admin
      ? await ActivationToken.findOne({ userId: admin._id })
          .select('expiresAt usedAt sendCount lastSentAt issuedAt purpose')
          .lean<{
            expiresAt: Date
            usedAt?: Date
            sendCount: number
            lastSentAt?: Date
            issuedAt: Date
            purpose: string
          } | null>()
      : null

    return NextResponse.json({
      admin,
      // If null, the AccessCard offers "Issue link" instead of "Copy / Re-issue".
      activation: token
        ? {
            expiresAt: token.expiresAt,
            usedAt: token.usedAt ?? null,
            sendCount: token.sendCount ?? 0,
            lastSentAt: token.lastSentAt ?? null,
            issuedAt: token.issuedAt,
            purpose: token.purpose,
            expired: token.expiresAt.getTime() < Date.now(),
          }
        : null,
    })
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('access read error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
