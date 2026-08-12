import dbConnect from '@/lib/db'
import Conversation from '@/models/Conversation'
import type { IConversation, IConversationMessage, IPendingAction } from '@/models/Conversation'
import crypto from 'crypto'

export async function createConversation(userId: string): Promise<IConversation> {
  await dbConnect()
  const conversation = await Conversation.create({
    userId,
    title: 'محادثة جديدة',
    messages: [],
    pendingActions: [],
    status: 'active',
  })
  return conversation
}

export async function getConversation(conversationId: string, userId: string): Promise<IConversation | null> {
  await dbConnect()
  return Conversation.findOne({ _id: conversationId, userId })
}

export async function listConversations(userId: string, limit = 20): Promise<IConversation[]> {
  await dbConnect()
  return Conversation.find({ userId, status: 'active' })
    .select('title status createdAt updatedAt')
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean()
}

export async function appendMessage(
  conversationId: string,
  message: IConversationMessage
): Promise<void> {
  await dbConnect()
  await Conversation.findByIdAndUpdate(conversationId, {
    $push: { messages: message },
  })
}

export async function appendMessages(
  conversationId: string,
  messages: IConversationMessage[]
): Promise<void> {
  await dbConnect()
  await Conversation.findByIdAndUpdate(conversationId, {
    $push: { messages: { $each: messages } },
  })
}

export async function addPendingAction(
  conversationId: string,
  action: Omit<IPendingAction, 'id' | 'createdAt' | 'status'>
): Promise<string> {
  const actionId = crypto.randomUUID()
  await dbConnect()
  await Conversation.findByIdAndUpdate(conversationId, {
    $push: {
      pendingActions: {
        id: actionId,
        ...action,
        status: 'pending',
        createdAt: new Date(),
      },
    },
  })
  return actionId
}

export async function resolvePendingAction(
  conversationId: string,
  actionId: string,
  approved: boolean,
  result?: unknown,
  error?: string
): Promise<IPendingAction | null> {
  await dbConnect()
  const conversation = await Conversation.findById(conversationId)
  if (!conversation) return null

  const action = conversation.pendingActions.find((a) => a.id === actionId)
  if (!action || action.status !== 'pending') return null

  action.status = approved ? (error ? 'failed' : 'executed') : 'rejected'
  action.result = result
  action.error = error
  action.resolvedAt = new Date()

  await conversation.save()
  return action
}

export async function deleteConversation(conversationId: string, userId: string): Promise<boolean> {
  await dbConnect()
  const result = await Conversation.findOneAndDelete({ _id: conversationId, userId })
  return !!result
}

/**
 * Pops trailing assistant/tool messages back to (but not including) the last
 * user message, so the next streaming call can regenerate a fresh response.
 * Returns the user message text we should resend (or null if nothing to regenerate).
 */
export async function popAfterLastUserMessage(
  conversationId: string,
  userId: string
): Promise<string | null> {
  await dbConnect()
  const conversation = await Conversation.findOne({ _id: conversationId, userId })
  if (!conversation) return null

  const msgs = conversation.messages
  let lastUserIdx = -1
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === 'user' && !msgs[i].content.startsWith('✅') && !msgs[i].content.startsWith('❌')) {
      lastUserIdx = i
      break
    }
  }
  if (lastUserIdx === -1) return null

  const userText = msgs[lastUserIdx].content
  conversation.messages = msgs.slice(0, lastUserIdx)
  await conversation.save()
  return userText
}

export async function updateTitle(
  conversationId: string,
  title: string
): Promise<void> {
  await dbConnect()
  const trimmed = title.slice(0, 100)
  await Conversation.findByIdAndUpdate(conversationId, { title: trimmed })
}

export async function autoTitle(
  conversationId: string,
  firstMessage: string
): Promise<void> {
  let title = firstMessage.trim()
  const newlineIdx = title.indexOf('\n')
  if (newlineIdx > 0) title = title.slice(0, newlineIdx).trim()
  if (title.length > 50) title = title.slice(0, 47) + '...'
  await updateTitle(conversationId, title)
}

export async function generateSmartTitle(
  conversationId: string,
  userMessage: string,
  assistantReply: string
): Promise<void> {
  try {
    const { getGroqClient, AI_MODEL_FAST } = await import('./groq-client')
    const groq = getGroqClient()

    const replyContext = assistantReply
      ? `\nرد المساعد: ${assistantReply.slice(0, 120)}`
      : ''

    const completion = await groq.chat.completions.create({
      model: AI_MODEL_FAST,
      messages: [
        {
          role: 'system',
          content: 'أنت مُولّد عناوين. مهمتك: اكتب عنوان عربي مختصر (3-6 كلمات) يلخص موضوع المحادثة. القواعد: 1) بالعربية فقط حتى لو كان النص بلغة أخرى 2) بدون علامات ترقيم أو اقتباس 3) لا تكتب شيئاً غير العنوان 4) ابدأ بكلمة فعلية تصف الطلب مثل: عرض، استعلام، إضافة، بحث',
        },
        {
          role: 'user',
          content: `طلب المستخدم: ${userMessage.slice(0, 150)}${replyContext}\n\nالعنوان:`,
        },
      ],
      temperature: 0.2,
      max_tokens: 30,
    })

    const raw = completion.choices[0]?.message?.content?.trim()
    if (raw) {
      const title = raw
        .replace(/["'«»""\-:\.]/g, '')
        .replace(/^\d+[\.\)]\s*/, '')
        .trim()
      if (title.length > 2 && title.length < 80) {
        await updateTitle(conversationId, title)
        return
      }
    }
    await fallbackTitle(conversationId, userMessage)
  } catch {
    await fallbackTitle(conversationId, userMessage).catch(() => {})
  }
}

async function fallbackTitle(conversationId: string, userMessage: string): Promise<void> {
  const arabicKeywords: Record<string, string> = {
    'session': 'استعلام عن الحصص',
    'student': 'استعلام عن الطلاب',
    'teacher': 'استعلام عن المعلمين',
    'room': 'استعلام عن القاعات',
    'payment': 'استعلام عن المدفوعات',
    'attendance': 'استعلام عن الحضور',
    'schedule': 'عرض الجدول الزمني',
    'conflict': 'كشف التعارضات',
    'claim': 'استعلام عن الاعتراضات',
    'stat': 'عرض الإحصائيات',
  }

  const lower = userMessage.toLowerCase()
  for (const [key, title] of Object.entries(arabicKeywords)) {
    if (lower.includes(key)) {
      await updateTitle(conversationId, title)
      return
    }
  }

  let title = userMessage.trim()
  const newlineIdx = title.indexOf('\n')
  if (newlineIdx > 0) title = title.slice(0, newlineIdx).trim()
  if (title.length > 40) title = title.slice(0, 37) + '...'
  await updateTitle(conversationId, title)
}

const MAX_HISTORY_MESSAGES = 30
const RECENT_MESSAGES_KEEP = 20
const MAX_TOOL_RESULT_LENGTH = 600

function compactToolResult(content: string): string {
  if (content.length <= MAX_TOOL_RESULT_LENGTH) return content
  try {
    const parsed = JSON.parse(content)
    if (parsed.data) {
      for (const key of Object.keys(parsed.data)) {
        if (Array.isArray(parsed.data[key]) && parsed.data[key].length > 5) {
          parsed.data[key] = [
            ...parsed.data[key].slice(0, 5),
            { _note: `... و ${parsed.data[key].length - 5} آخرين` },
          ]
        }
      }
    }
    const compact = JSON.stringify(parsed)
    if (compact.length <= MAX_TOOL_RESULT_LENGTH) return compact
    return compact.slice(0, MAX_TOOL_RESULT_LENGTH - 20) + '..."}'
  } catch {
    return content.slice(0, MAX_TOOL_RESULT_LENGTH - 3) + '...'
  }
}

function formatMessageForGroq(m: IConversationMessage) {
  if (m.role === 'tool' && m.toolCalls?.[0]) {
    return {
      role: 'tool' as const,
      tool_call_id: m.toolCalls[0].id,
      content: compactToolResult(m.content),
    }
  }
  if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
    return {
      role: 'assistant' as const,
      content: m.content || null,
      tool_calls: m.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.arguments),
        },
      })),
    }
  }
  return {
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }
}

export function getMessageHistoryForGroq(conversation: IConversation) {
  const filtered = conversation.messages.filter((m) => m.role !== 'system')

  if (filtered.length <= MAX_HISTORY_MESSAGES) {
    return filtered.map(formatMessageForGroq)
  }

  const recent = filtered.slice(-RECENT_MESSAGES_KEEP)
  const older = filtered.slice(0, filtered.length - RECENT_MESSAGES_KEEP)

  const olderSummary = older
    .filter((m) => m.role === 'user' || (m.role === 'assistant' && !m.toolCalls?.length))
    .map((m) => {
      const short = m.content.length > 80 ? m.content.slice(0, 77) + '...' : m.content
      return `[${m.role === 'user' ? 'المدير' : 'أحمد'}]: ${short}`
    })
    .join('\n')

  const summaryMessage = {
    role: 'user' as const,
    content: `[ملخص المحادثة السابقة]:\n${olderSummary}`,
  }

  return [summaryMessage, ...recent.map(formatMessageForGroq)]
}
