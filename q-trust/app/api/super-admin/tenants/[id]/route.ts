import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { z } from 'zod'
import dbConnect from '@/lib/db'
import { requireSuperAdmin, TenantAuthError } from '@/lib/tenant'
import { clearTenantStatusCache } from '@/lib/tenant-status'
import Tenant from '@/models/Tenant'
import Student from '@/models/Student'
import {
  PLANS,
  PLAN_LIMITS,
  PAYMENT_METHODS,
  TENANT_STATUS,
  LOCALES,
} from '@/lib/constants'
import { logPlatformAudit } from '@/models/PlatformAuditLog'
import { getClientIp } from '@/lib/rate-limit'
import { getEffectiveLimits } from '@/lib/entitlements'
import { deleteTenantCascade } from '@/lib/provisioning'

void Tenant
void Student

// GET /api/super-admin/tenants/[id] — full tenant read for the edit form.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin()
    const { id } = await params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'معرّف غير صالح' }, { status: 400 })
    }
    await dbConnect()
    const tenant = await Tenant.findById(id).lean()
    if (!tenant) return NextResponse.json({ message: 'المؤسسة غير موجودة' }, { status: 404 })
    return NextResponse.json(tenant)
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('Get tenant error:', e)
    return NextResponse.json({ message: 'حدث خطأ' }, { status: 500 })
  }
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

const brandingSchema = z.object({
  displayName: z.string().trim().max(200).optional(),
  logoUrl: z.string().trim().max(2048).optional().or(z.literal('')),
  primaryColor: z.string().regex(HEX_COLOR, 'اللون يجب أن يكون بصيغة #RRGGBB').optional(),
  secondaryColor: z.string().regex(HEX_COLOR, 'اللون يجب أن يكون بصيغة #RRGGBB').optional(),
  locale: z.enum(LOCALES).optional(),
})
const contactSchema = z.object({
  email: z.string().email().max(200).optional().or(z.literal('')),
  phone: z.string().max(30).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
})
const billingSchema = z.object({
  setupFeeAmountTND: z.coerce.number().min(0).max(100_000).optional(),
  annualFeeAmountTND: z.coerce.number().min(0).max(100_000).optional(),
  paymentMethod: z.enum(Object.values(PAYMENT_METHODS) as [string, ...string[]]).optional(),
})
const limitsSchema = z.object({
  // Send `null` to clear the override (inherit plan default). Send a number
  // to set a custom limit. `maxStudents: null` also means "unlimited".
  maxStudents: z.union([z.coerce.number().int().min(0).max(100_000), z.null()]).optional(),
  aiQuotaMonthly: z.union([z.coerce.number().int().min(0).max(100_000), z.null()]).optional(),
})

const patchSchema = z
  .object({
    plan: z.enum([PLANS.STARTER, PLANS.STANDARD, PLANS.PREMIUM]).optional(),
    status: z
      .enum([
        TENANT_STATUS.TRIAL,
        TENANT_STATUS.ACTIVE,
        TENANT_STATUS.PAST_DUE,
        TENANT_STATUS.SUSPENDED,
        TENANT_STATUS.CANCELLED,
      ])
      .optional(),
    suspensionReason: z.string().trim().max(500).optional().or(z.literal('')),
    // When true, bypass the "downgrade below current usage" guard.
    force: z.boolean().optional(),
    branding: brandingSchema.optional(),
    contact: contactSchema.optional(),
    billing: billingSchema.optional(),
    limits: limitsSchema.optional(),
  })
  .refine(
    (d) =>
      d.plan !== undefined ||
      d.status !== undefined ||
      d.branding !== undefined ||
      d.contact !== undefined ||
      d.billing !== undefined ||
      d.limits !== undefined,
    { message: 'لا توجد تغييرات' }
  )

// PATCH /api/super-admin/tenants/[id]
//
// Split into three logical actions, all in the same route because they all
// mutate a Tenant document and share the audit + status-cache invalidation
// pattern:
//   • Profile edit — contact, branding, billing amounts, per-field limit
//     overrides. Audited as TENANT_UPDATED (with a small diff) and
//     TENANT_LIMITS_CHANGED when limits change.
//   • Plan change — reads effective limits BEFORE and AFTER; blocks a
//     downgrade that would put the tenant over the new seat cap unless
//     `force: true` is passed.
//   • Status change — writes suspendedAt/By/Reason on transition into
//     SUSPENDED, cancelledAt on CANCELLED, and clears both on any
//     transition back out. Audited with the reason.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireSuperAdmin()
    const { id } = await params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'معرّف غير صالح' }, { status: 400 })
    }
    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 })
    }
    const d = parsed.data

    await dbConnect()
    const tenant = await Tenant.findById(id)
    if (!tenant) {
      return NextResponse.json({ message: 'المؤسسة غير موجودة' }, { status: 404 })
    }

    const ip = getClientIp(request)
    const userAgent = request.headers.get('user-agent') || undefined
    const auditBase = {
      actorUserId: actor.id,
      actorEmail: actor.email || 'unknown',
      targetType: 'Tenant',
      targetId: tenant._id,
      tenantId: tenant._id,
      ip,
      userAgent,
    }

    // ── Profile fields ─────────────────────────────────────────────────
    const profileDiff: Record<string, { from?: unknown; to?: unknown }> = {}
    if (d.contact) {
      for (const [k, v] of Object.entries(d.contact) as [
        'email' | 'phone' | 'address',
        string | undefined,
      ][]) {
        if (v !== undefined) {
          const prev = (tenant.contact as any)?.[k]
          if ((v || undefined) !== (prev || undefined)) {
            profileDiff[`contact.${k}`] = { from: prev, to: v || undefined }
          }
          ;(tenant.contact as any)[k] = v || undefined
        }
      }
    }
    if (d.branding) {
      for (const [k, v] of Object.entries(d.branding) as [string, unknown][]) {
        if (v !== undefined) {
          const prev = (tenant.branding as any)?.[k]
          if (v !== prev) profileDiff[`branding.${k}`] = { from: prev, to: v }
          ;(tenant.branding as any)[k] = v === '' ? undefined : v
        }
      }
    }
    if (d.billing) {
      for (const [k, v] of Object.entries(d.billing) as [string, unknown][]) {
        if (v !== undefined) {
          const prev = (tenant.billing as any)?.[k]
          if (v !== prev) profileDiff[`billing.${k}`] = { from: prev, to: v }
          ;(tenant.billing as any)[k] = v
        }
      }
    }

    // ── Limits overrides ────────────────────────────────────────────────
    let limitsDiff: Record<string, { from?: unknown; to?: unknown }> | null = null
    if (d.limits) {
      const before = tenant.limits ?? {}
      tenant.limits = { ...before, ...d.limits }
      // Undefined vs null vs number are semantically different — undefined =
      // "inherit plan", null = "explicit unlimited", number = "custom".
      // Only record a diff when the *effective* value changes.
      limitsDiff = {}
      if (d.limits.maxStudents !== undefined && before.maxStudents !== d.limits.maxStudents) {
        limitsDiff['limits.maxStudents'] = { from: before.maxStudents, to: d.limits.maxStudents }
      }
      if (d.limits.aiQuotaMonthly !== undefined && before.aiQuotaMonthly !== d.limits.aiQuotaMonthly) {
        limitsDiff['limits.aiQuotaMonthly'] = { from: before.aiQuotaMonthly, to: d.limits.aiQuotaMonthly }
      }
    }

    // ── Plan change (with downgrade guard) ──────────────────────────────
    let planChanged: { from: string; to: string } | null = null
    if (d.plan && d.plan !== tenant.plan) {
      const from = tenant.plan
      // Compare effective seat caps: only block when the *new* effective
      // cap is a hard number smaller than the current active student count.
      const nextEffective = getEffectiveLimits({ plan: d.plan, limits: tenant.limits })
      if (nextEffective.maxStudents !== null && !d.force) {
        const activeCount = await Student.countDocuments({
          tenantId: tenant._id,
          isActive: true,
        })
        if (activeCount > nextEffective.maxStudents) {
          return NextResponse.json(
            {
              message: `الباقة الجديدة تسمح بـ ${nextEffective.maxStudents} طالب فقط، والمؤسسة تضم حالياً ${activeCount}. مرّر force:true للمتابعة رغم ذلك.`,
              activeCount,
              newCap: nextEffective.maxStudents,
            },
            { status: 409 }
          )
        }
      }
      tenant.plan = d.plan
      // Keep the denormalized maxStudents/aiQuotaMonthly in sync with the
      // *plan* default when there's no explicit override. Effective reads
      // go through getEffectiveLimits which prefers the override, so this
      // is purely so any legacy consumer that reads those fields sees
      // sensible values.
      const planDefaults = PLAN_LIMITS[d.plan]
      if (tenant.limits?.maxStudents === undefined) {
        tenant.maxStudents =
          planDefaults.maxStudents >= Number.MAX_SAFE_INTEGER / 2
            ? Number.MAX_SAFE_INTEGER
            : planDefaults.maxStudents
      }
      if (tenant.limits?.aiQuotaMonthly === undefined) {
        tenant.aiQuotaMonthly = planDefaults.aiQuotaMonthly
      }
      planChanged = { from, to: d.plan }
    }

    // ── Status change ──────────────────────────────────────────────────
    let statusChanged: { from: string; to: string } | null = null
    if (d.status && d.status !== tenant.status) {
      statusChanged = { from: tenant.status, to: d.status }
      tenant.status = d.status
      const now = new Date()
      if (d.status === TENANT_STATUS.SUSPENDED) {
        tenant.suspendedAt = now
        tenant.suspendedBy = new mongoose.Types.ObjectId(actor.id)
        tenant.suspensionReason = d.suspensionReason || undefined
      } else if (d.status === TENANT_STATUS.CANCELLED) {
        tenant.cancelledAt = now
        tenant.suspensionReason = d.suspensionReason || tenant.suspensionReason
      } else {
        // Any transition back into a non-terminal state (TRIAL / ACTIVE /
        // PAST_DUE — this else branch is TS-narrowed to those three)
        // clears the suspension audit; the reason is no longer accurate
        // to the current lifecycle position.
        tenant.suspendedAt = undefined
        tenant.suspendedBy = undefined
        tenant.suspensionReason = undefined
        tenant.cancelledAt = undefined
      }
    }

    await tenant.save()

    // ── Audit trail ────────────────────────────────────────────────────
    if (Object.keys(profileDiff).length) {
      await logPlatformAudit({
        ...auditBase,
        action: 'TENANT_UPDATED',
        metadata: { diff: profileDiff },
      })
    }
    if (limitsDiff && Object.keys(limitsDiff).length) {
      await logPlatformAudit({
        ...auditBase,
        action: 'TENANT_LIMITS_CHANGED',
        metadata: { diff: limitsDiff },
      })
    }
    if (planChanged) {
      await logPlatformAudit({
        ...auditBase,
        action: 'TENANT_PLAN_CHANGED',
        metadata: planChanged,
      })
    }
    if (statusChanged) {
      await logPlatformAudit({
        ...auditBase,
        action: 'TENANT_STATUS_CHANGED',
        metadata: { ...statusChanged, reason: d.suspensionReason || undefined },
      })
    }

    // Reflect any status change immediately in the per-instance cache.
    if (statusChanged) clearTenantStatusCache(id)

    return NextResponse.json({
      _id: tenant._id,
      plan: tenant.plan,
      status: tenant.status,
      limits: tenant.limits,
      contact: tenant.contact,
      branding: tenant.branding,
      billing: tenant.billing,
      suspensionReason: tenant.suspensionReason,
      suspendedAt: tenant.suspendedAt,
    })
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('Update tenant error:', e)
    return NextResponse.json({ message: 'حدث خطأ أثناء تحديث المؤسسة' }, { status: 500 })
  }
}

// DELETE /api/super-admin/tenants/[id] — permanently remove a tenant and every
// record scoped to it. Irreversible, so the caller must echo back the exact
// slug in the body ({ confirmSlug }) the way GitHub makes you type a repo name.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireSuperAdmin()
    const { id } = await params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'معرّف غير صالح' }, { status: 400 })
    }

    await dbConnect()
    const tenant = await Tenant.findById(id)
    if (!tenant) {
      return NextResponse.json({ message: 'المؤسسة غير موجودة' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    if (body?.confirmSlug !== tenant.slug) {
      return NextResponse.json(
        { message: `للتأكيد، أرسل confirmSlug مطابقاً للمعرّف: "${tenant.slug}"` },
        { status: 400 }
      )
    }

    // Snapshot identity for the audit row before the document disappears.
    const snapshot = { slug: tenant.slug, name: tenant.name, plan: tenant.plan, status: tenant.status }

    await deleteTenantCascade(tenant._id)
    clearTenantStatusCache(id)

    await logPlatformAudit({
      actorUserId: actor.id,
      actorEmail: actor.email || 'unknown',
      targetType: 'Tenant',
      targetId: new mongoose.Types.ObjectId(id),
      action: 'TENANT_DELETED',
      metadata: snapshot,
      ip: getClientIp(request),
      userAgent: request.headers.get('user-agent') || undefined,
    })

    return NextResponse.json({ ok: true, deleted: snapshot })
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ message: e.message }, { status: e.status })
    }
    console.error('Delete tenant error:', e)
    return NextResponse.json({ message: 'حدث خطأ أثناء حذف المؤسسة' }, { status: 500 })
  }
}
