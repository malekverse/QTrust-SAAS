import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { requireSuperAdmin, TenantAuthError } from '@/lib/tenant'
import dbConnect from '@/lib/db'
import Lead, { LEAD_STATUS } from '@/models/Lead'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin()
    const { id } = await params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'معرّف غير صالح' }, { status: 400 })
    }

    const body = await request.json()
    const { status } = body
    if (!status || !Object.values(LEAD_STATUS).includes(status)) {
      return NextResponse.json({ message: 'حالة غير صالحة' }, { status: 400 })
    }

    await dbConnect()
    const lead = await Lead.findByIdAndUpdate(id, { status }, { new: true, runValidators: true })
    if (!lead) {
      return NextResponse.json({ message: 'الطلب غير موجود' }, { status: 404 })
    }

    return NextResponse.json(lead)
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('Patch lead error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
