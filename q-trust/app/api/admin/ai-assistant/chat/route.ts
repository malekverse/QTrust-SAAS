import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { ROLES, PLANS } from '@/lib/constants'
import { tenantHasTier } from '@/lib/entitlements'
import {
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
import { aiLimiter, aiTenantLimiter, enforceRateLimit } from '@/lib/rate-limit'
import { ensureAiQuota, recordAiRound } from '@/lib/ai/usage'
import { validateToolArgs } from '@/lib/ai/tool-schemas'
import { streamChat, type ChatMessages } from '@/lib/ai/llm-provider'
import {
  MAX_TOOL_ROUNDS,
  MAX_RETRIES,
  TOOL_TIMEOUT_MS,
  cleanArgs,
  coerceToolArgs,
  isGroqToolValidationError,
  TOOL_NAME_AR,
  describeAction,
  sseEvent,
  withTimeout,
  type AssembledToolCall,
} from '@/lib/ai/shared'

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

    // Cost/abuse control: cap AI chat requests per admin and per tenant.
    const limited = await enforceRateLimit(aiLimiter, `ai:${session.user.id}`)
    if (limited) return limited
    const tenantLimited = await enforceRateLimit(aiTenantLimiter, `ai:tenant:${tenantId}`)
    if (tenantLimited) return tenantLimited

    // Monthly AI usage quota (a Premium entitlement). Checked at the start of
    // each turn; a single turn may then consume several tool-calling rounds.
    const quota = await ensureAiQuota(tenantId)
    if (!quota.allowed) {
      const resetStr = quota.resetAt.toLocaleDateString('ar-TN', { year: 'numeric', month: 'long', day: 'numeric' })
      return new Response(
        JSON.stringify({ message: `لقد بلغت مؤسستك الحدّ الشهري لاستخدام المساعد الذكي (${quota.quota}). يتجدّد في ${resetStr}.` }),
        { status: 402, headers: { 'Content-Type': 'application/json' } }
      )
    }

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

    const groqMessages: ChatMessages = [
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
            let roundUsage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null = null
            const toolCallBuffer = new Map<number, { id?: string; name?: string; arguments: string }>()
            let finishReason: string | null = null
            let retryCount = 0
            let streamSucceeded = false

            while (retryCount <= MAX_RETRIES && !streamSucceeded) {
              try {
                const groqStream = await streamChat({
                  messages: groqMessages,
                  tools: AI_TOOLS,
                  maxTokens: AI_CONFIG.max_tokens_tool_round,
                })

                for await (const chunk of groqStream) {
                  if (chunk.usage) roundUsage = chunk.usage
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

            // Count this completed round against the monthly quota + log token usage.
            await recordAiRound({
              tenantId, userId: adminId, conversationId: convId, route: 'chat', model: AI_MODEL,
              promptTokens: roundUsage?.prompt_tokens,
              completionTokens: roundUsage?.completion_tokens,
              totalTokens: roundUsage?.total_tokens,
            })

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
              let toolArgs = coerceToolArgs(toolName, cleanedArgs)

              // Validate the LLM's tool args against the tool schema before doing
              // anything with them — a parse failure otherwise becomes {} and an
              // out-of-schema value flows straight into Mongoose.
              const validation = validateToolArgs(toolName, toolArgs)
              if (!validation.ok) {
                const errStr = JSON.stringify({ success: false, error: validation.error })
                send('tool', { name: toolName, label: TOOL_NAME_AR[toolName] || toolName, status: 'done' })
                allNewMessages.push({
                  role: 'tool',
                  content: errStr,
                  toolCalls: [{ id: tc.id, name: toolName, arguments: toolArgs }],
                  timestamp: new Date(),
                })
                groqMessages.push({ role: 'tool' as const, tool_call_id: tc.id, content: errStr })
                continue
              }
              toolArgs = validation.data

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
              const summaryStream = await streamChat({
                messages: groqMessages,
                maxTokens: AI_CONFIG.max_tokens_final,
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
