import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import dbConnect from '@/lib/db'
import SubstituteAssignment from '@/models/SubstituteAssignment'
import { requireTenantSession, TenantAuthError } from '@/lib/tenant'
import { ROLES } from '@/lib/constants'

export async function DELETE(
  _request: NextRequest,
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

    await dbConnect()
    const deleted = await SubstituteAssignment.findOneAndDelete({ _id: id, tenantId: ctx.tenantId })
    if (!deleted) {
      return NextResponse.json({ message: 'التكليف غير موجود' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('Substitute delete error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
