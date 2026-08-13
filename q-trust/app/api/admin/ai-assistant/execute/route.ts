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
  getConversation,
  appendMessages,
  addPendingAction,
  resolvePendingAction,
  getMessageHistoryForGroq,
} from '@/lib/ai'
import type { IConversationMessage, IToolCall } from '@/models/Conversation'

const MAX_TOOL_ROUNDS = 5
const TOOL_TIMEOUT_MS = 15_000

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function cleanArgs(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(cleanArgs).filter((v) => v !== undefined)
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
    if (!(await tenantHasTier(tenantId, PLANS.PREMIUM))) {
      return new Response(
        JSON.stringify({ message: 'المساعد الذكي متاح ضمن الباقة المتقدمة فقط. يرجى ترقية اشتراك مؤسستك.' }),
        { status: 402, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { conversationId, actionId, approved, modifiedParams } = await request.json()

    if (!conversationId || !actionId || typeof approved !== 'boolean') {
      return new Response(JSON.stringify({ message: 'بيانات غير صالحة' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const adminId = session.user.id

    const conversation = await getConversation(conversationId, adminId, tenantId)
    if (!conversation) {
      return new Response(JSON.stringify({ message: 'المحادثة غير موجودة' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const action = conversation.pendingActions.find((a) => a.id === actionId)
    if (!action) {
      return new Response(JSON.stringify({ message: 'الإجراء غير موجود' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (action.status !== 'pending') {
      return new Response(JSON.stringify({ message: 'الإجراء تم معالجته مسبقاً' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const allNewMessages: IConversationMessage[] = []
    let resultData: unknown = null
    let resultError: string | undefined
    let executionContextMessage: string

    if (approved) {
      const finalParams = modifiedParams
        ? { ...action.params, ...modifiedParams }
        : action.params

      try {
        const result = await withTimeout(
          executeTool(action.toolName, finalParams, adminId, tenantId),
          TOOL_TIMEOUT_MS,
          action.toolName
        )
        resultData = result.data
        resultError = result.success ? undefined : result.error
      } catch (err) {
        resultError = err instanceof Error ? err.message : 'خطأ غير معروف أثناء التنفيذ'
      }

      await resolvePendingAction(conversationId, actionId, true, resultData, resultError)

      const modNote = modifiedParams ? ' (مع تعديلات من المدير)' : ''
      allNewMessages.push({
        role: 'user',
        content: `✅ تمت الموافقة على: ${action.description}${modNote}`,
        timestamp: new Date(),
      })

      executionContextMessage = resultError
        ? `[نظام] فشل تنفيذ "${action.description}": ${resultError}. اشرح للمدير بإيجاز واقترح خطوة بديلة.`
        : `[نظام] تم تنفيذ "${action.description}" بنجاح. النتيجة: ${JSON.stringify(resultData)}. أكّد للمدير بإيجاز، وإذا كانت هناك خطوات تالية منطقية (مثل إنشاء حساب بوابة بعد إنشاء طالب) فاطلب الإذن لها.`
    } else {
      await resolvePendingAction(conversationId, actionId, false)

      allNewMessages.push({
        role: 'user',
        content: `❌ تم رفض: ${action.description}`,
        timestamp: new Date(),
      })

      executionContextMessage = `[نظام] رفض المدير تنفيذ "${action.description}". اكتفِ بالإقرار بالرفض بجملة قصيرة.`
    }

    const updatedConversation = await getConversation(conversationId, adminId, tenantId)
    if (!updatedConversation) {
      return new Response(JSON.stringify({ message: 'خطأ في تحميل المحادثة' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const groq = getGroqClient()
    const systemPrompt = buildSystemPrompt(session.user.fullName)
    const history = getMessageHistoryForGroq(updatedConversation)

    type GroqMessages = Parameters<typeof groq.chat.completions.create>[0]['messages']
    const groqMessages: GroqMessages = [
      { role: 'system', content: systemPrompt },
      ...history,
      ...allNewMessages.map((m) => ({ role: m.role as 'user', content: m.content })),
      { role: 'user', content: executionContextMessage },
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

        const pendingActionsRaised: Array<{ id: string; toolName: string; description: string; params: Record<string, unknown> }> = []
        let finalContent = ''

        try {
          send('conv_id', { conversationId })

          for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            let assistantContent = ''
            const toolCallBuffer = new Map<number, { id?: string; name?: string; arguments: string }>()
            let finishReason: string | null = null

            const groqStream = await groq.chat.completions.create({
              model: AI_MODEL,
              messages: groqMessages,
              tools: AI_TOOLS,
              tool_choice: 'auto',
              parallel_tool_calls: false,
              temperature: AI_CONFIG.temperature,
              max_tokens: AI_CONFIG.max_tokens_final,
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

              if (READ_ONLY_TOOLS.has(toolName)) {
                send('tool', { name: toolName, label: TOOL_NAME_AR[toolName] || toolName, status: 'running' })

                let result: Awaited<ReturnType<typeof executeTool>>
                try {
                  result = await withTimeout(executeTool(toolName, cleanedArgs, adminId, tenantId), TOOL_TIMEOUT_MS, toolName)
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
                  toolCalls: [{ id: tc.id, name: toolName, arguments: cleanedArgs, result }],
                  timestamp: new Date(),
                })

                groqMessages.push({
                  role: 'tool' as const,
                  tool_call_id: tc.id,
                  content: resultStr,
                })
              } else {
                hasWriteTools = true

                const description = describeAction(toolName, cleanedArgs)
                const newActionId = await addPendingAction(conversationId, {
                  toolName,
                  description,
                  params: cleanedArgs,
                })
                pendingActionsRaised.push({ id: newActionId, toolName, description, params: cleanedArgs })

                groqMessages.push({
                  role: 'tool' as const,
                  tool_call_id: tc.id,
                  content: JSON.stringify({
                    status: 'pending_approval',
                    message: 'العملية تحتاج موافقة المدير، اعرض ملخصاً موجزاً للإجراء واطلب الموافقة.',
                    actionId: newActionId,
                  }),
                })

                allNewMessages.push({
                  role: 'tool',
                  content: JSON.stringify({ status: 'pending_approval', actionId: newActionId }),
                  toolCalls: [{ id: tc.id, name: toolName, arguments: cleanedArgs }],
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
                const delta = chunk.choices[0]?.delta
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
          }

          if (allNewMessages.length > 0) {
            await appendMessages(conversationId, allNewMessages)
          }

          send('done', {
            conversationId,
            actionId,
            approved,
            result: resultData,
            error: resultError,
            pendingActions: pendingActionsRaised,
            message: finalContent,
          })
        } catch (error: unknown) {
          console.error('AI Assistant execute error:', error)

          let userMessage = 'عذراً، حدث خطأ أثناء معالجة الطلب. يرجى المحاولة مرة أخرى.'
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
            await appendMessages(conversationId, allNewMessages)
          } catch (saveErr) {
            console.error('Failed to persist error state:', saveErr)
          }

          send('error', { message: userMessage, conversationId, actionId, approved })
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
    console.error('AI Assistant execute error:', error)
    const message = error instanceof Error ? error.message : 'حدث خطأ أثناء معالجة الطلب'
    return new Response(JSON.stringify({ message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
