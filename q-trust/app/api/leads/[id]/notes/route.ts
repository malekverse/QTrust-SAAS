import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { z } from 'zod'
import { requireSuperAdmin, TenantAuthError } from '@/lib/tenant'
import dbConnect from '@/lib/db'
import Lead from '@/models/Lead'

void Lead

const noteSchema = z.object({
  body: z.string().min(1, 'الملاحظة مطلوبة').max(2000),
})

// POST /api/leads/[id]/notes — append a follow-up note to a lead.
// Super-admin only. Notes are embedded (Lead is a small collection),
// authored by the current operator.
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
    const parsed = noteSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
    }

    await dbConnect()
    const lead = await Lead.findByIdAndUpdate(
      id,
      {
        $push: {
          notes: {
            body: parsed.data.body,
            authorId: new mongoose.Types.ObjectId(actor.id),
            authorName: actor.fullName || actor.email || 'المشغّل',
            createdAt: new Date(),
          },
        },
      },
      { new: true, runValidators: true }
    )
    if (!lead) {
      return NextResponse.json({ message: 'الطلب غير موجود' }, { status: 404 })
    }
    return NextResponse.json(lead)
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('Add lead note error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}
