import mongoose from 'mongoose'
import { randomBytes } from 'crypto'
import dbConnect from '@/lib/db'
import Tenant from '@/models/Tenant'
import User from '@/models/User'
import Student from '@/models/Student'
import Settings, { DEFAULT_ENROLLMENT_SETTINGS } from '@/models/Settings'
import Invoice from '@/models/Invoice'
import Lead, { LEAD_STATUS } from '@/models/Lead'
import ActivationToken, {
  DEFAULT_ACTIVATION_TTL_MS,
  generateActivationToken,
} from '@/models/ActivationToken'
import { hashPassword } from '@/lib/auth'
import { generateInvoiceNumber } from '@/lib/invoice-numbering'
import {
  ROLES,
  PLANS,
  PLAN_LIMITS,
  TENANT_STATUS,
  PAYMENT_METHODS,
  INVOICE_TYPES,
  INVOICE_STATUS,
  type Plan,
} from '@/lib/constants'

// Force model registration for serverless cold starts.
void Tenant
void User
void Student
void Settings
void Invoice
void Lead
void ActivationToken

export interface ProvisionInput {
  name: string
  slug: string
  plan: Plan
  adminFullName: string
  adminEmail: string
  adminPhone?: string
  setupFeeAmountTND?: number
  annualFeeAmountTND?: number
  // If set, the lead is atomically claimed and joined to the new tenant.
  leadId?: string
  // Trial length in days from creation. Set explicitly here — the field on
  // Tenant existed but was never written prior to this, so trials never
  // expired.
  trialDays?: number
}

export interface ProvisionActor {
  id: string
  email: string
}

export interface ProvisionResult {
  tenant: {
    _id: mongoose.Types.ObjectId
    name: string
    slug: string
    plan: Plan
    trialEndsAt: Date
  }
  admin: {
    _id: mongoose.Types.ObjectId
    email: string
  }
  // One-time activation link — this is the "credential" the operator hands
  // to the new admin. The plaintext token is only ever returned here (once,
  // to the operator), never persisted, and never emailed back to the caller
  // of this function.
  activation: {
    token: string
    expiresAt: Date
  }
  invoiceIds: mongoose.Types.ObjectId[]
  leadClaimed: boolean
}

export class ProvisionError extends Error {
  status: number
  constructor(message: string, status = 500) {
    super(message)
    this.status = status
  }
}

// Detect once per Mongo connection whether transactions are supported.
// Set-by-single-node standalone Mongo (typical local dev) has no replica set,
// so session.withTransaction throws with a specific server error; Atlas and
// mongodb-memory-server (which runs as an ephemeral RS) both support it. We
// cache the result on the connection object.
type ConnWithFlag = mongoose.Connection & { __supportsTransactions?: boolean }
async function supportsTransactions(): Promise<boolean> {
  const conn = mongoose.connection as ConnWithFlag
  if (typeof conn.__supportsTransactions === 'boolean') return conn.__supportsTransactions
  try {
    const admin = conn.db?.admin()
    if (!admin) {
      conn.__supportsTransactions = false
      return false
    }
    const info = await admin.command({ hello: 1 })
    // Replica set OR mongos both expose setName / msg respectively.
    conn.__supportsTransactions = Boolean(info.setName || info.msg === 'isdbgrid')
  } catch {
    conn.__supportsTransactions = false
  }
  return conn.__supportsTransactions
}

// Delete every document belonging to `tenantId`. Idempotent — safe to call
// on a partially-created tenant. Reused for provisioning rollback and (later)
// for tenant offboarding. Callers must be authorized.
export async function deleteTenantCascade(tenantId: mongoose.Types.ObjectId | string): Promise<void> {
  const tid = new mongoose.Types.ObjectId(tenantId)
  await dbConnect()
  // Order chosen so a re-run after a mid-cascade failure keeps converging.
  const users = await User.find({ tenantId: tid }).select('_id').lean<{ _id: mongoose.Types.ObjectId }[]>()
  const userIds = users.map((u) => u._id)
  await Promise.all([
    Invoice.deleteMany({ tenantId: tid }),
    Settings.deleteMany({ tenantId: tid }),
    userIds.length ? ActivationToken.deleteMany({ userId: { $in: userIds } }) : Promise.resolve(),
    User.deleteMany({ tenantId: tid }),
  ])
  await Tenant.deleteOne({ _id: tid })
}

// Provision a new tenant and its first admin.
//
// Two atomicity strategies:
//   - On a replica-set / Atlas connection: run every write inside a single
//     Mongo transaction; abort on any failure. This is the production path.
//   - On standalone Mongo (typical dev): create the Tenant with
//     provisioningState='PROVISIONING' first, do the dependent writes, flip to
//     'READY'. On failure, compensating deletes run via deleteTenantCascade.
//
// Never call auth() from here — accept an explicit `actor` so the same
// function can be reused from cron / seeds / repair jobs.
export async function provisionTenant(
  input: ProvisionInput,
  actor: ProvisionActor
): Promise<ProvisionResult> {
  await dbConnect()

  // Slug uniqueness pre-check. The unique index is still the source of truth
  // (defense against a concurrent create); this is just a clean 409.
  const slug = input.slug.toLowerCase().trim()
  if (await Tenant.findOne({ slug }).select('_id').lean()) {
    throw new ProvisionError('المعرّف مستخدم بالفعل', 409)
  }

  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setFullYear(periodEnd.getFullYear() + 1)
  const trialDays = input.trialDays ?? 14
  const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000)

  const limits = PLAN_LIMITS[input.plan]
  const setupFee = input.setupFeeAmountTND ?? 0
  const annualFee = input.annualFeeAmountTND ?? 0
  const emailLower = input.adminEmail.toLowerCase()

  // Unknowable password: the admin can only sign in via the activation
  // token below, then set their own password via /api/auth/onboarding.
  // Nothing recoverable is ever at rest.
  const unknowablePassword = randomBytes(48).toString('base64')
  const passwordHash = await hashPassword(unknowablePassword)
  const { token: activationToken, tokenHash: activationHash } = generateActivationToken()
  const activationExpires = new Date(Date.now() + DEFAULT_ACTIVATION_TTL_MS)

  const useTx = await supportsTransactions()

  if (useTx) {
    const session = await mongoose.startSession()
    try {
      let result!: ProvisionResult
      await session.withTransaction(async () => {
        const [tenantDoc] = await Tenant.create(
          [
            {
              name: input.name,
              slug,
              plan: input.plan,
              status: TENANT_STATUS.TRIAL,
              trialEndsAt,
              maxStudents: limits.maxStudents,
              aiQuotaMonthly: limits.aiQuotaMonthly,
              isDemo: false,
              branding: { displayName: input.name, locale: 'ar' },
              contact: { email: emailLower, phone: input.adminPhone || undefined },
              billing: {
                setupFeeAmountTND: setupFee,
                annualFeeAmountTND: annualFee,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                paymentMethod: PAYMENT_METHODS.BANK_TRANSFER,
              },
              provisioningState: 'READY',
            },
          ],
          { session }
        )

        const [adminDoc] = await User.create(
          [
            {
              tenantId: tenantDoc._id,
              fullName: input.adminFullName,
              email: emailLower,
              phone: input.adminPhone || undefined,
              role: ROLES.ADMIN,
              passwordHash,
              isEmailVerified: false,
              isActive: true,
              mustChangePassword: true,
            },
          ],
          { session }
        )

        await Settings.create(
          [
            {
              tenantId: tenantDoc._id,
              key: 'enrollment',
              value: DEFAULT_ENROLLMENT_SETTINGS as unknown as Record<string, unknown>,
              description: 'إعدادات ترقيم الانخراط',
              updatedBy: adminDoc._id,
            },
          ],
          { session }
        )

        const invoiceDocs: Record<string, unknown>[] = []
        if (setupFee > 0) {
          invoiceDocs.push({
            tenantId: tenantDoc._id,
            type: INVOICE_TYPES.SETUP,
            amountTND: setupFee,
            status: INVOICE_STATUS.PENDING,
            dueDate: now,
            invoiceNumber: await generateInvoiceNumber(now),
            createdBy: actor.id,
          })
        }
        if (annualFee > 0) {
          invoiceDocs.push({
            tenantId: tenantDoc._id,
            type: INVOICE_TYPES.ANNUAL_RENEWAL,
            amountTND: annualFee,
            status: INVOICE_STATUS.PENDING,
            dueDate: periodEnd,
            invoiceNumber: await generateInvoiceNumber(now),
            // The first-period renewal is scoped to the initial billing
            // year — the cron uses this key to avoid double-generating.
            periodKey: `${periodEnd.getUTCFullYear()}-${String(periodEnd.getUTCMonth() + 1).padStart(2, '0')}`,
            createdBy: actor.id,
          })
        }
        const invoices = invoiceDocs.length
          ? await Invoice.insertMany(invoiceDocs, { session, ordered: true })
          : []

        await ActivationToken.create(
          [
            {
              userId: adminDoc._id,
              tenantId: tenantDoc._id,
              tokenHash: activationHash,
              expiresAt: activationExpires,
              issuedBy: new mongoose.Types.ObjectId(actor.id),
              issuedAt: now,
              purpose: 'activation',
            },
          ],
          { session }
        )

        // Claim the lead in the same transaction so a concurrent double-
        // submit gets a clean rollback rather than two tenants + a
        // half-updated lead.
        let leadClaimed = false
        if (input.leadId && mongoose.Types.ObjectId.isValid(input.leadId)) {
          const claim = await Lead.findOneAndUpdate(
            { _id: input.leadId, status: { $ne: LEAD_STATUS.CONVERTED } },
            {
              $set: {
                status: LEAD_STATUS.CONVERTED,
                convertedTenantId: tenantDoc._id,
                convertedAt: now,
              },
            },
            { session, returnDocument: 'after' }
          )
          if (!claim) {
            throw new ProvisionError('سبق تحويل هذا الطلب', 409)
          }
          leadClaimed = true
        }

        result = {
          tenant: {
            _id: tenantDoc._id,
            name: tenantDoc.name,
            slug: tenantDoc.slug,
            plan: tenantDoc.plan,
            trialEndsAt,
          },
          admin: {
            _id: adminDoc._id,
            email: adminDoc.email,
          },
          activation: {
            token: activationToken,
            expiresAt: activationExpires,
          },
          invoiceIds: invoices.map((i) => i._id as mongoose.Types.ObjectId),
          leadClaimed,
        }
      })
      return result
    } finally {
      await session.endSession()
    }
  }

  // Non-transactional fallback — compensating rollback on failure. Every
  // dependent write happens after the Tenant, so deleteTenantCascade is
  // sufficient. `provisioningState: 'PROVISIONING'` guards against races
  // that manage to briefly expose the half-provisioned tenant.
  let tenantId: mongoose.Types.ObjectId | null = null
  try {
    const tenantDoc = await Tenant.create({
      name: input.name,
      slug,
      plan: input.plan,
      status: TENANT_STATUS.TRIAL,
      trialEndsAt,
      maxStudents: limits.maxStudents,
      aiQuotaMonthly: limits.aiQuotaMonthly,
      isDemo: false,
      branding: { displayName: input.name, locale: 'ar' },
      contact: { email: emailLower, phone: input.adminPhone || undefined },
      billing: {
        setupFeeAmountTND: setupFee,
        annualFeeAmountTND: annualFee,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        paymentMethod: PAYMENT_METHODS.BANK_TRANSFER,
      },
      provisioningState: 'PROVISIONING',
    })
    tenantId = tenantDoc._id

    const adminDoc = await User.create({
      tenantId: tenantDoc._id,
      fullName: input.adminFullName,
      email: emailLower,
      phone: input.adminPhone || undefined,
      role: ROLES.ADMIN,
      passwordHash,
      isEmailVerified: false,
      isActive: true,
      mustChangePassword: true,
    })

    await Settings.create({
      tenantId: tenantDoc._id,
      key: 'enrollment',
      value: DEFAULT_ENROLLMENT_SETTINGS as unknown as Record<string, unknown>,
      description: 'إعدادات ترقيم الانخراط',
      updatedBy: adminDoc._id,
    })

    const invoiceDocs: Record<string, unknown>[] = []
    if (setupFee > 0) {
      invoiceDocs.push({
        tenantId: tenantDoc._id,
        type: INVOICE_TYPES.SETUP,
        amountTND: setupFee,
        status: INVOICE_STATUS.PENDING,
        dueDate: now,
        invoiceNumber: await generateInvoiceNumber(now),
        createdBy: actor.id,
      })
    }
    if (annualFee > 0) {
      invoiceDocs.push({
        tenantId: tenantDoc._id,
        type: INVOICE_TYPES.ANNUAL_RENEWAL,
        amountTND: annualFee,
        status: INVOICE_STATUS.PENDING,
        dueDate: periodEnd,
        invoiceNumber: await generateInvoiceNumber(now),
        periodKey: `${periodEnd.getUTCFullYear()}-${String(periodEnd.getUTCMonth() + 1).padStart(2, '0')}`,
        createdBy: actor.id,
      })
    }
    const invoices = invoiceDocs.length ? await Invoice.insertMany(invoiceDocs, { ordered: true }) : []

    await ActivationToken.create({
      userId: adminDoc._id,
      tenantId: tenantDoc._id,
      tokenHash: activationHash,
      expiresAt: activationExpires,
      issuedBy: new mongoose.Types.ObjectId(actor.id),
      issuedAt: now,
      purpose: 'activation',
    })

    let leadClaimed = false
    if (input.leadId && mongoose.Types.ObjectId.isValid(input.leadId)) {
      const claim = await Lead.findOneAndUpdate(
        { _id: input.leadId, status: { $ne: LEAD_STATUS.CONVERTED } },
        {
          $set: {
            status: LEAD_STATUS.CONVERTED,
            convertedTenantId: tenantDoc._id,
            convertedAt: now,
          },
        },
        { returnDocument: 'after' }
      )
      if (!claim) {
        throw new ProvisionError('سبق تحويل هذا الطلب', 409)
      }
      leadClaimed = true
    }

    // Flip provisioning state last — this is the "commit" point.
    tenantDoc.provisioningState = 'READY'
    await tenantDoc.save()

    return {
      tenant: {
        _id: tenantDoc._id,
        name: tenantDoc.name,
        slug: tenantDoc.slug,
        plan: tenantDoc.plan,
        trialEndsAt,
      },
      admin: {
        _id: adminDoc._id,
        email: adminDoc.email,
      },
      activation: {
        token: activationToken,
        expiresAt: activationExpires,
      },
      invoiceIds: invoices.map((i) => i._id as mongoose.Types.ObjectId),
      leadClaimed,
    }
  } catch (err) {
    if (tenantId) {
      try {
        await deleteTenantCascade(tenantId)
      } catch (cleanupErr) {
        // Compensation failed — log so it can be picked up by a repair pass.
        // The tenant remains in PROVISIONING state and is therefore hidden
        // from every non-super-admin surface.
        console.error(
          `provisionTenant: rollback failed for tenant ${tenantId.toString()}:`,
          cleanupErr
        )
      }
    }
    if (err instanceof ProvisionError) throw err
    const anyErr = err as { code?: number; message?: string }
    if (anyErr?.code === 11000) {
      throw new ProvisionError('المعرّف أو البريد مستخدم بالفعل', 409)
    }
    throw err
  }
}

// Slugify a free-text association name into a URL-safe candidate. Does NOT
// dedupe — the caller checks availability separately.
export function suggestSlug(source: string): string {
  return source
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining marks
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    || 'tenant'
}

// Normalize an operator-typed Tunisian phone into +216XXXXXXXX. Returns
// undefined for empty input, throws ProvisionError(400) for anything that
// can't be coerced into that shape.
export function normalizeTunisiaPhone(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  const digits = trimmed.replace(/[^\d+]/g, '')
  if (/^\+216\d{8}$/.test(digits)) return digits
  const bareEight = digits.replace(/^\+?216/, '')
  if (/^\d{8}$/.test(bareEight)) return `+216${bareEight}`
  throw new ProvisionError('رقم الهاتف يجب أن يكون بصيغة +216XXXXXXXX', 400)
}
