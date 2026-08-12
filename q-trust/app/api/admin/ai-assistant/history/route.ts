import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ROLES } from '@/lib/constants'
import { getConversation, listConversations, deleteConversation } from '@/lib/ai'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || session.user.role !== ROLES.ADMIN) {
      return NextResponse.json({ message: 'غير مصرح لك بالوصول' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversationId')
    const adminId = session.user.id

    if (conversationId) {
      const conversation = await getConversation(conversationId, adminId)
      if (!conversation) {
        return NextResponse.json({ message: 'المحادثة غير موجودة' }, { status: 404 })
      }
      return NextResponse.json(conversation)
    }

    const conversations = await listConversations(adminId)
    return NextResponse.json({ conversations })
  } catch (error: unknown) {
    console.error('AI Assistant history error:', error)
    const message = error instanceof Error ? error.message : 'حدث خطأ أثناء جلب البيانات'
    return NextResponse.json({ message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || session.user.role !== ROLES.ADMIN) {
      return NextResponse.json({ message: 'غير مصرح لك بالوصول' }, { status: 403 })
    }

    const { conversationId } = await request.json()
    if (!conversationId) {
      return NextResponse.json({ message: 'معرف المحادثة مطلوب' }, { status: 400 })
    }

    const deleted = await deleteConversation(conversationId, session.user.id)
    if (!deleted) {
      return NextResponse.json({ message: 'المحادثة غير موجودة' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('AI Assistant delete error:', error)
    const message = error instanceof Error ? error.message : 'حدث خطأ أثناء الحذف'
    return NextResponse.json({ message }, { status: 500 })
  }
}
