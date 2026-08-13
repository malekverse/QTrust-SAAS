import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { ROLES, PLANS } from '@/lib/constants'
import { tenantHasTier } from '@/lib/entitlements'
import {
  getGroqClient,
  AI_MODEL,
  AI_CONFIG,
  buildSystemPrompt,
  AI_TOOLS,
  READ_ONLY_TOOLS,
  executeTool,
  createConversation,
  getConversation,
  appendMessages,
  addPendingAction,
  generateSmartTitle,
  getMessageHistoryForGroq,
  popAfterLastUserMessage,
} from '@/lib/ai'
import type { IConversationMessage, IToolCall } from '@/models/Conversation'
import { aiLimiter, enforceRateLimit } from '@/lib/rate-limit'

const MAX_TOOL_ROUNDS = 5
const MAX_RETRIES = 2
const TOOL_TIMEOUT_MS = 15_000

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function cleanArgs(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    const cleaned = obj.map(cleanArgs).filter((v) => v !== undefined)
    return cleaned
  }
  if (isPlainObject(obj)) {
    const cleaned: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      const c = cleanArgs(v)
      if (c === undefined) continue
      if (typeof c === 'string' && c.trim() === '') continue
      if (Array.isArray(c) && c.length === 0) continue
      if (isPlainObject(c) && Object.keys(c).length === 0) continue
      cleaned[k] = c
    }
    return cleaned
  }
  if (obj === null || obj === undefined) return undefined
  return obj
}

const DAY_NAME_MAP: Record<string, number> = {
  'sunday': 0, 'الأحد': 0, 'الاحد': 0, 'أحد': 0, 'احد': 0,
  'monday': 1, 'الإثنين': 1, 'الاثنين': 1, 'إثنين': 1, 'اثنين': 1,
  'tuesday': 2, 'الثلاثاء': 2, 'ثلاثاء': 2,
  'wednesday': 3, 'الأربعاء': 3, 'الاربعاء': 3, 'أربعاء': 3, 'اربعاء': 3,
  'thursday': 4, 'الخميس': 4, 'خميس': 4,
  'friday': 5, 'الجمعة': 5, 'جمعة': 5,
  'saturday': 6, 'السبت': 6, 'سبت': 6,
}

function coerceToolArgs(_toolName: string, args: Record<string, unknown>): Record<string, unknown> {
  const coerced = { ...args }

  if ('dayOfWeek' in coerced) {
    const val = coerced.dayOfWeek
    if (typeof val === 'string') {
      const lower = val.toLowerCase().trim()
      if (lower === 'today' || lower === 'اليوم' || lower === 'هذا اليوم') {
        const tunisiaDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Tunis' }))
        coerced.dayOfWeek = tunisiaDate.getDay()
      } else if (lower in DAY_NAME_MAP) {
        coerced.dayOfWeek = DAY_NAME_MAP[lower]
      } else {
        const parsed = parseInt(val, 10)
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 6) {
          coerced.dayOfWeek = parsed
        }
      }
    }
  }

  for (const field of ['startTime', 'endTime']) {
    if (field in coerced && typeof coerced[field] === 'string') {
      const val = (coerced[field] as string).toLowerCase().trim()
      if (val === 'now' || val === 'الآن' || val === 'الان') {
        const tunisiaDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Tunis' }))
        coerced[field] = `${tunisiaDate.getHours().toString().padStart(2, '0')}:${tunisiaDate.getMinutes().toString().padStart(2, '0')}`
      }
    }
  }

  for (const field of ['effectiveFromDate', 'effectiveToDate', 'startDate', 'endDate', 'date']) {
    if (field in coerced && typeof coerced[field] === 'string') {
      const val = (coerced[field] as string).toLowerCase().trim()
      if (val === 'today' || val === 'اليوم' || val === 'هذا اليوم') {
        const tunisiaDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Tunis' }))
        coerced[field] = tunisiaDate.toISOString().split('T')[0]
      } else if (val === 'tomorrow' || val === 'غداً' || val === 'غدا') {
        const tunisiaDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Tunis' }))
        tunisiaDate.setDate(tunisiaDate.getDate() + 1)
        coerced[field] = tunisiaDate.toISOString().split('T')[0]
      } else if (val === 'indefinite' || val === 'غير محدد' || val === 'مفتوح') {
        delete coerced[field]
      }
    }
  }

  for (const field of ['month', 'year', 'limit', 'capacity']) {
    if (field in coerced && typeof coerced[field] === 'string') {
      const parsed = parseInt(coerced[field] as string, 10)
      if (!isNaN(parsed)) coerced[field] = parsed
    }
  }

  return coerced
}

function isGroqToolValidationError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status
    if (status === 400) {
      const msg = error instanceof Error ? error.message : String(error)
      return (
        msg.includes('tool_use_failed') ||
        msg.includes('Failed to call a function') ||
        msg.includes('tool call validation failed') ||
        msg.includes('failed_generation')
      )
    }
  }
  return false
}

const TOOL_NAME_AR: Record<string, string> = {
  list_students: 'البحث عن الطلاب',
  get_student: 'عرض بيانات طالب',
  list_teachers: 'البحث عن المعلمين',
  get_teacher: 'عرض بيانات معلم',
  list_sessions: 'عرض الحصص',
  get_session: 'عرض تفاصيل حصة',
  list_rooms: 'عرض القاعات',
  get_room: 'عرض تفاصيل قاعة',
  check_room_availability: 'التحقق من توفر القاعة',
  view_schedule: 'عرض الجدول الزمني',
  check_conflicts: 'كشف التعارضات',
  view_attendance: 'عرض سجلات الحضور',
  get_attendance_stats: 'عرض إحصائيات الحضور',
  view_payments: 'عرض المدفوعات',
  list_claims: 'عرض الاعتراضات',
  list_documents: 'عرض المستندات',
  get_dashboard_stats: 'عرض إحصائيات لوحة التحكم',
  get_activity_log: 'عرض سجل النشاطات',
  get_settings: 'عرض الإعدادات',
  create_student: 'إنشاء طالب جديد',
  update_student: 'تحديث بيانات طالب',
  delete_student: 'إلغاء تنشيط طالب',
  create_teacher: 'إنشاء معلم جديد',
  update_teacher: 'تحديث بيانات معلم',
  delete_teacher: 'إلغاء تنشيط معلم',
  create_session: 'إنشاء حصة جديدة',
  update_session: 'تحديث حصة',
  delete_session: 'إلغاء تنشيط حصة',
  enroll_student: 'تسجيل طالب في حصة',
  unenroll_student: 'إلغاء تسجيل طالب',
  generate_occurrences: 'إنشاء حصص فعلية',
  create_room: 'إنشاء قاعة',
  update_room: 'تحديث قاعة',
  delete_room: 'إلغاء تنشيط قاعة',
  auto_assign_rooms: 'تعيين القاعات تلقائياً',
  update_attendance: 'تحديث حضور',
  mark_payment: 'تسجيل دفعة',
  bulk_mark_payments: 'تسجيل دفعات جماعية',
  review_claim: 'مراجعة اعتراض',
  delete_document: 'حذف مستند',
  update_settings: 'تحديث إعدادات',
  create_student_account: 'إنشاء حساب بوابة',
  reset_student_password: 'إعادة تعيين كلمة مرور',
}

function describeAction(toolName: string, args: Record<string, unknown>): string {
  const descriptionMap: Record<string, string> = {
    create_student: `إنشاء طالب جديد: ${args.firstName || ''} ${args.lastName || ''}`,
    update_student: `تحديث بيانات طالب`,
    delete_student: `إلغاء تنشيط طالب`,
    create_student_account: `إنشاء حساب بوابة لطالب`,
    reset_student_password: `إعادة تعيين كلمة مرور طالب`,
    create_teacher: `إنشاء معلم جديد: ${args.fullName || ''}`,
    update_teacher: `تحديث بيانات معلم`,
    delete_teacher: `إلغاء تنشيط معلم`,
    create_session: `إنشاء حصة جديدة: ${args.name || ''}`,
    update_session: `تحديث حصة`,
    delete_session: `إلغاء تنشيط حصة`,
    enroll_student: `تسجيل طالب في حصة`,
    unenroll_student: `إلغاء تسجيل طالب من حصة`,
    generate_occurrences: `إنشاء حصص فعلية من ${args.startDate || ''} إلى ${args.endDate || ''}`,
    create_room: `إنشاء قاعة جديدة: ${args.name || ''}`,
    update_room: `تحديث بيانات قاعة`,
    delete_room: `إلغاء تنشيط قاعة`,
    auto_assign_rooms: `تعيين القاعات تلقائياً`,
    update_attendance: `تحديث حالة حضور`,
    mark_payment: `تسجيل دفعة شهرية`,
    bulk_mark_payments: `تسجيل دفعات جماعية لـ ${(args.studentIds as string[] || []).length} طلاب`,
    review_claim: `مراجعة اعتراض حضور`,
    delete_document: `حذف مستند`,
    update_settings: `تحديث إعدادات النظام`,
  }
  return descriptionMap[toolName] || `تنفيذ: ${toolName}`
}

function sseEvent(type: string, data: Record<string, unknown>): string {
  return `data: ${JSON.stringify({ type, ...data })}\n\n`
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Tool "${label}" timed out after ${ms}ms`)), ms)
    ),
  ])
}

interface AssembledToolCall {
  id: string
  name: string
  arguments: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session || session.user.role !== ROLES.ADMIN) {
      return new Response(JSON.stringify({ message: 'غير مصرح لك بالوصول' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const tenantId = session.user.tenantId
    if (!tenantId) {
      return new Response(JSON.stringify({ message: 'لا يوجد سياق مؤسسة' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    // The AI assistant is a Premium-only feature; verify the plan fresh from the DB.
    if (!(await tenantHasTier(tenantId, PLANS.PREMIUM))) {
      return new Response(
        JSON.stringify({ message: 'المساعد الذكي متاح ضمن الباقة المتقدمة فقط. يرجى ترقية اشتراك مؤسستك.' }),
        { status: 402, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Cost/abuse control: cap AI chat requests per admin.
    const limited = await enforceRateLimit(aiLimiter, `ai:${session.user.id}`)
    if (limited) return limited

    const body = await request.json()
    const { conversationId, regenerate } = body
    let { message } = body
    const adminId = session.user.id
    const adminName = session.user.fullName

    if (regenerate) {
      if (!conversationId) {
        return new Response(JSON.stringify({ message: 'لا يمكن إعادة التوليد بدون محادثة' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const lastUserText = await popAfterLastUserMessage(conversationId, adminId, tenantId)
      if (!lastUserText) {
        return new Response(JSON.stringify({ message: 'لا توجد رسالة لإعادة التوليد' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      message = lastUserText
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return new Response(JSON.stringify({ message: 'الرسالة مطلوبة' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let conversation
    if (conversationId) {
      conversation = await getConversation(conversationId, adminId, tenantId)
      if (!conversation) {
        return new Response(JSON.stringify({ message: 'المحادثة غير موجودة' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    } else {
      conversation = await createConversation(adminId, tenantId)
    }

    const convId = conversation._id.toString()
    const isNewConversation = !conversationId

    const userMessage: IConversationMessage = {
      role: 'user',
      content: message.trim(),
      timestamp: new Date(),
    }
    conversation.messages.push(userMessage)

    let stats
    try {
      const statsResult = await executeTool('get_dashboard_stats', {}, adminId, tenantId)
      if (statsResult.success && statsResult.data) {
        stats = statsResult.data as Record<string, number>
      }
    } catch { /* stats are optional */ }

    const systemPrompt = buildSystemPrompt(adminName, stats)
    const history = getMessageHistoryForGroq(conversation)

    const groq = getGroqClient()
    type GroqMessages = Parameters<typeof groq.chat.completions.create>[0]['messages']
    const groqMessages: GroqMessages = [
      { role: 'system', content: systemPrompt },
      ...history,
    ]

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        let isClosed = false
        const send = (type: string, data: Record<string, unknown>) => {
          if (isClosed) return
          try {
            controller.enqueue(encoder.encode(sseEvent(type, data)))
          } catch {
            isClosed = true
          }
        }
        const close = () => {
          if (isClosed) return
          isClosed = true
          try { controller.close() } catch { /* ignore */ }
        }

        const allNewMessages: IConversationMessage[] = [userMessage]
        const pendingActionsRaised: Array<{ id: string; toolName: string; description: string; params: Record<string, unknown> }> = []
        let finalContent = ''

        try {
          send('conv_id', { conversationId: convId })
          send('status', { text: 'يفكر أحمد...' })

          for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            let assistantContent = ''
            const toolCallBuffer = new Map<number, { id?: string; name?: string; arguments: string }>()
            let finishReason: string | null = null
            let retryCount = 0
            let streamSucceeded = false

            while (retryCount <= MAX_RETRIES && !streamSucceeded) {
              try {
                const groqStream = await groq.chat.completions.create({
                  model: AI_MODEL,
                  messages: groqMessages,
                  tools: AI_TOOLS,
                  tool_choice: 'auto',
                  parallel_tool_calls: false,
                  temperature: AI_CONFIG.temperature,
                  max_tokens: AI_CONFIG.max_tokens_tool_round,
                  top_p: AI_CONFIG.top_p,
                  stream: true,
                })

                for await (const chunk of groqStream) {
                  const choice = chunk.choices[0]
                  if (!choice) continue
                  const delta = choice.delta

                  if (delta?.content) {
                    assistantContent += delta.content
                    send('text', { content: delta.content })
                  }

                  if (delta?.tool_calls) {
                    for (const tc of delta.tool_calls) {
                      const idx = tc.index
                      const existing = toolCallBuffer.get(idx) || { arguments: '' }
                      if (tc.id) existing.id = tc.id
                      if (tc.function?.name) existing.name = tc.function.name
                      if (tc.function?.arguments) existing.arguments += tc.function.arguments
                      toolCallBuffer.set(idx, existing)
                    }
                  }

                  if (choice.finish_reason) {
                    finishReason = choice.finish_reason
                  }
                }

                streamSucceeded = true
              } catch (err: unknown) {
                if (isGroqToolValidationError(err) && retryCount < MAX_RETRIES) {
                  retryCount++
                  const errorMsg = err instanceof Error ? err.message : String(err)
                  console.warn(`Groq tool validation error (retry ${retryCount}/${MAX_RETRIES}):`, errorMsg)
                  assistantContent = ''
                  toolCallBuffer.clear()
                  finishReason = null
                  groqMessages.push({
                    role: 'user' as const,
                    content: `[تنبيه نظام] فشل استدعاء الأداة. استخدم JSON صحيحاً، أداة واحدة في كل مرة. dayOfWeek=رقم(0-6)، الأوقات=HH:mm، التواريخ=YYYY-MM-DD، المعرّفات=ObjectId.`,
                  })
                  continue
                }
                throw err
              }
            }

            if (!streamSucceeded) break

            const assembledToolCalls: AssembledToolCall[] = Array.from(toolCallBuffer.entries())
              .sort(([a], [b]) => a - b)
              .map(([, tc]) => ({
                id: tc.id || `call_${Math.random().toString(36).slice(2, 12)}`,
                name: tc.name || '',
                arguments: tc.arguments || '{}',
              }))
              .filter((tc) => tc.name)

            if (assembledToolCalls.length === 0) {
              finalContent = assistantContent
              if (assistantContent.trim()) {
                allNewMessages.push({
                  role: 'assistant',
                  content: assistantContent,
                  timestamp: new Date(),
                })
              }
              break
            }

            const toolCalls: IToolCall[] = assembledToolCalls.map((tc) => {
              let parsedArgs: Record<string, unknown> = {}
              try {
                parsedArgs = JSON.parse(tc.arguments)
              } catch {
                parsedArgs = {}
              }
              return { id: tc.id, name: tc.name, arguments: parsedArgs }
            })

            allNewMessages.push({
              role: 'assistant',
              content: assistantContent,
              toolCalls,
              timestamp: new Date(),
            })

            groqMessages.push({
              role: 'assistant',
              content: assistantContent || null,
              tool_calls: assembledToolCalls.map((tc) => ({
                id: tc.id,
                type: 'function' as const,
                function: { name: tc.name, arguments: tc.arguments },
              })),
            })

            let hasWriteTools = false

            for (const tc of assembledToolCalls) {
              const toolName = tc.name
              let rawArgs: Record<string, unknown> = {}
              try {
                rawArgs = JSON.parse(tc.arguments)
              } catch {
                rawArgs = {}
              }
              const cleanedArgs = (cleanArgs(rawArgs) as Record<string, unknown>) || {}
              const toolArgs = coerceToolArgs(toolName, cleanedArgs)

              if (READ_ONLY_TOOLS.has(toolName)) {
                send('tool', { name: toolName, label: TOOL_NAME_AR[toolName] || toolName, status: 'running' })

                let result: Awaited<ReturnType<typeof executeTool>>
                try {
                  result = await withTimeout(executeTool(toolName, toolArgs, adminId, tenantId), TOOL_TIMEOUT_MS, toolName)
                } catch (toolErr) {
                  result = {
                    success: false,
                    error: toolErr instanceof Error ? toolErr.message : 'خطأ غير معروف',
                  }
                }
                const resultStr = JSON.stringify(result)

                send('tool', { name: toolName, label: TOOL_NAME_AR[toolName] || toolName, status: 'done' })

                allNewMessages.push({
                  role: 'tool',
                  content: resultStr,
                  toolCalls: [{ id: tc.id, name: toolName, arguments: toolArgs, result }],
                  timestamp: new Date(),
                })

                groqMessages.push({
                  role: 'tool' as const,
                  tool_call_id: tc.id,
                  content: resultStr,
                })
              } else {
                hasWriteTools = true

                const description = describeAction(toolName, toolArgs)
                const actionId = await addPendingAction(convId, {
                  toolName,
                  description,
                  params: toolArgs,
                })
                pendingActionsRaised.push({ id: actionId, toolName, description, params: toolArgs })

                groqMessages.push({
                  role: 'tool' as const,
                  tool_call_id: tc.id,
                  content: JSON.stringify({
                    status: 'pending_approval',
                    message: 'العملية تحتاج موافقة المدير، اعرض ملخصاً موجزاً للإجراء واطلب الموافقة.',
                    actionId,
                  }),
                })

                allNewMessages.push({
                  role: 'tool',
                  content: JSON.stringify({ status: 'pending_approval', actionId }),
                  toolCalls: [{ id: tc.id, name: toolName, arguments: toolArgs }],
                  timestamp: new Date(),
                })
              }
            }

            if (hasWriteTools) {
              send('status', { text: 'يُعدّ أحمد الملخص...' })

              let summaryContent = ''
              const summaryStream = await groq.chat.completions.create({
                model: AI_MODEL,
                messages: groqMessages,
                temperature: AI_CONFIG.temperature,
                max_tokens: AI_CONFIG.max_tokens_final,
                stream: true,
              })

              for await (const chunk of summaryStream) {
                const choice = chunk.choices[0]
                const delta = choice?.delta
                if (delta?.content) {
                  summaryContent += delta.content
                  send('text', { content: delta.content })
                }
              }

              finalContent = summaryContent
              if (summaryContent.trim()) {
                allNewMessages.push({
                  role: 'assistant',
                  content: summaryContent,
                  timestamp: new Date(),
                })
              }
              break
            }

            if (finishReason === 'stop') {
              finalContent = assistantContent
              break
            }

            send('status', { text: 'يحلل أحمد النتائج...' })
          }

          if (allNewMessages.length > 0) {
            await appendMessages(convId, allNewMessages)
          }

          if (isNewConversation) {
            generateSmartTitle(convId, message, finalContent || '').catch(() => {})
          }

          send('done', { conversationId: convId, pendingActions: pendingActionsRaised })
        } catch (error: unknown) {
          console.error('AI Assistant chat error:', error)

          let userMessage = 'عذراً، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.'

          if (error && typeof error === 'object' && 'status' in error) {
            const status = (error as { status: number }).status
            if (status === 429) {
              userMessage = 'عذراً، تم تجاوز حد الاستخدام المسموح. يرجى الانتظار دقيقة ثم المحاولة مرة أخرى.'
            } else if (status === 503 || status === 502) {
              userMessage = 'عذراً، خدمة الذكاء الاصطناعي غير متاحة حالياً. يرجى المحاولة بعد قليل.'
            }
          }

          allNewMessages.push({
            role: 'assistant',
            content: userMessage,
            timestamp: new Date(),
          })

          try {
            await appendMessages(convId, allNewMessages)
          } catch (saveErr) {
            console.error('Failed to persist error state:', saveErr)
          }

          send('error', { message: userMessage, conversationId: convId })
        } finally {
          close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error: unknown) {
    console.error('AI Assistant chat error:', error)
    return new Response(JSON.stringify({ message: 'عذراً، حدث خطأ.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
