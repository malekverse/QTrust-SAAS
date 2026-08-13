import dbConnect from '@/lib/db'
import Tenant from '@/models/Tenant'
import AiUsageLog from '@/models/AiUsageLog'

export interface AiQuotaState {
  allowed: boolean
  used: number
  quota: number
  resetAt: Date
}

// Start of next calendar month, in UTC — deterministic regardless of server TZ.
function nextMonthStart(from: Date): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1))
}

/**
 * Lazily rolls the monthly counter over when `aiUsageResetAt` has passed, then
 * reports whether the tenant may start another AI turn this month. The quota
 * unit is one completed tool-calling round (see recordAiRound); a single chat
 * message may consume several rounds. Checked at turn boundaries, not mid-turn.
 */
export async function ensureAiQuota(tenantId: string): Promise<AiQuotaState> {
  await dbConnect()
  const now = new Date()
  const tenant = await Tenant.findById(tenantId)
    .select('aiQuotaMonthly aiUsageCurrentMonth aiUsageResetAt')
    .lean<{ aiQuotaMonthly: number; aiUsageCurrentMonth: number; aiUsageResetAt?: Date }>()
  if (!tenant) return { allowed: false, used: 0, quota: 0, resetAt: nextMonthStart(now) }

  let used = tenant.aiUsageCurrentMonth ?? 0
  let resetAt = tenant.aiUsageResetAt ? new Date(tenant.aiUsageResetAt) : nextMonthStart(now)

  // Roll over the counter if this month's window has elapsed.
  if (now >= resetAt) {
    used = 0
    resetAt = nextMonthStart(now)
    await Tenant.findByIdAndUpdate(tenantId, { aiUsageCurrentMonth: 0, aiUsageResetAt: resetAt })
  }

  const quota = tenant.aiQuotaMonthly ?? 0
  return { allowed: used < quota, used, quota, resetAt }
}

/**
 * Records one completed tool-calling round: atomically bumps the tenant's
 * monthly quota counter and appends a token-usage ledger row. Best-effort —
 * never let usage accounting break the chat stream.
 */
export async function recordAiRound(params: {
  tenantId: string
  userId: string
  conversationId?: string
  route: 'chat' | 'execute'
  model: string
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}): Promise<void> {
  const promptTokens = params.promptTokens ?? 0
  const completionTokens = params.completionTokens ?? 0
  const totalTokens = params.totalTokens ?? promptTokens + completionTokens
  try {
    await dbConnect()
    await Tenant.findByIdAndUpdate(params.tenantId, { $inc: { aiUsageCurrentMonth: 1 } })
    await AiUsageLog.create({
      tenantId: params.tenantId,
      userId: params.userId,
      conversationId: params.conversationId,
      route: params.route,
      modelName: params.model,
      promptTokens,
      completionTokens,
      totalTokens,
    })
  } catch (e) {
    console.error('recordAiRound failed:', e)
  }
}
