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
  getConversation,
  appendMessages,
  addPendingAction,
  resolvePendingAction,
  getMessageHistoryForGroq,
} from '@/lib/ai'
import type { IConversationMessage, IToolCall } from '@/models/Conversation'
import { aiLimiter, aiTenantLimiter, enforceRateLimit } from '@/lib/rate-limit'
import { recordAiRound } from '@/lib/ai/usage'
import { validateToolArgs } from '@/lib/ai/tool-schemas'
import { logActivity } from '@/models/ActivityLog'
import { streamChat, type ChatMessages } from '@/lib/ai/llm-provider'
import {
  MAX_TOOL_ROUNDS,
  TOOL_TIMEOUT_MS,
  cleanArgs,
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
    if (!(await tenantHasTier(tenantId, PLANS.PREMIUM))) {
      return new Response(
        JSON.stringify({ message: 'المساعد الذكي متاح ضمن الباقة المتقدمة فقط. يرجى ترقية اشتراك مؤسستك.' }),
        { status: 402, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const rl = await enforceRateLimit(aiLimiter, `ai:${session.user.id}`)
    if (rl) return rl
    const trl = await enforceRateLimit(aiTenantLimiter, `ai:tenant:${tenantId}`)
    if (trl) return trl

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

      // Re-validate the (possibly admin-edited) params — modifiedParams from the
      // approval card are otherwise merged and executed with no re-check.
      const paramCheck = validateToolArgs(action.toolName, finalParams)
      if (!paramCheck.ok) {
        resultError = paramCheck.error
      } else {
        try {
          const result = await withTimeout(
            executeTool(action.toolName, paramCheck.data, adminId, tenantId),
            TOOL_TIMEOUT_MS,
            action.toolName
          )
          resultData = result.data
          resultError = result.success ? undefined : result.error
        } catch (err) {
          resultError = err instanceof Error ? err.message : 'خطأ غير معروف أثناء التنفيذ'
        }
      }

      await resolvePendingAction(conversationId, actionId, true, resultData, resultError)

      // Audit trail: one source-marked entry per AI-executed write action. Every
      // AI write funnels through this approval path, so logging here is complete.
      if (!resultError) {
        await logActivity('AI_ACTION_EXECUTED', action.description, {
          tenantId,
          userId: adminId,
          source: 'ai_assistant',
          metadata: { toolName: action.toolName, params: finalParams },
        })
      }

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

    const systemPrompt = buildSystemPrompt(session.user.fullName)
    const history = getMessageHistoryForGroq(updatedConversation)

    const groqMessages: ChatMessages = [
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
            let roundUsage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null = null
            const toolCallBuffer = new Map<number, { id?: string; name?: string; arguments: string }>()
            let finishReason: string | null = null

            const groqStream = await streamChat({
              messages: groqMessages,
              tools: AI_TOOLS,
              maxTokens: AI_CONFIG.max_tokens_final,
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

            // Count this completed round against the monthly quota + log token usage.
            await recordAiRound({
              tenantId, userId: adminId, conversationId, route: 'execute', model: AI_MODEL,
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
              const summaryStream = await streamChat({
                messages: groqMessages,
                maxTokens: AI_CONFIG.max_tokens_final,
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
