import Link from "next/link"
import { Suspense } from "react"
import { getTranslations } from "next-intl/server"
import { requireSuperAdmin } from "@/lib/tenant"
import dbConnect from "@/lib/db"
import Tenant from "@/models/Tenant"
import Student from "@/models/Student"
import Invoice from "@/models/Invoice"
import Lead from "@/models/Lead"
import User from "@/models/User"
import AiUsageLog from "@/models/AiUsageLog"
import PlatformAuditLog from "@/models/PlatformAuditLog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard } from "@/components/layout/stat-card"
import { PageHeader } from "@/components/layout/page-header"
import {
  Building2,
  Users,
  DollarSign,
  Wallet,
  Inbox,
  TrendingUp,
  AlertCircle,
  Clock,
  Sparkles,
  UserX,
  Activity,
} from "lucide-react"
import { ROLES, TENANT_STATUS } from "@/lib/constants"

void Tenant
void Student
void Invoice
void Lead
void User
void AiUsageLog
void PlatformAuditLog

export const dynamic = "force-dynamic"

// Groq pricing at time of writing for llama-3.3-70b-versatile (per 1M tokens).
// Cheap enough to inline; if it changes the number is directional anyway and
// the operator's real cost surface is the Groq console.
const GROQ_INPUT_USD_PER_M = 0.59
const GROQ_OUTPUT_USD_PER_M = 0.79

// One TND ≈ 0.32 USD (rough); the dashboard shows tokens + a spend range in
// TND so the operator can eyeball what the tenant plan needs to cover.
const TND_PER_USD = 3.15

function fmtTND(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n))
}

function fmtDate(d?: Date | string | null): string {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function timeAgo(d: Date | string): string {
  const ms = Date.now() - new Date(d).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return "الآن"
  if (min < 60) return `منذ ${min} د`
  const h = Math.floor(min / 60)
  if (h < 24) return `منذ ${h} س`
  const days = Math.floor(h / 24)
  return `منذ ${days} يوم`
}

export default async function SuperAdminDashboard() {
  await requireSuperAdmin()
  const t = await getTranslations("superAdmin.dashboard")

  return (
    <div className="space-y-8">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <Suspense fallback={<KpisSkeleton />}>
        <Kpis t={t} />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<ListCardSkeleton />}>
          <NeedsAttentionLeads t={t} />
        </Suspense>
        <Suspense fallback={<ListCardSkeleton />}>
          <NeedsAttentionOverdue t={t} />
        </Suspense>
        <Suspense fallback={<ListCardSkeleton />}>
          <NeedsAttentionRenewals t={t} />
        </Suspense>
        <Suspense fallback={<ListCardSkeleton />}>
          <NeedsAttentionInactive t={t} />
        </Suspense>
      </div>

      <Suspense fallback={<ListCardSkeleton />}>
        <RecentActivity t={t} />
      </Suspense>
    </div>
  )
}

// ─── KPIs ─────────────────────────────────────────────────────────────

async function Kpis({ t }: { t: Awaited<ReturnType<typeof getTranslations>> }) {
  await dbConnect()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [tenantsAgg, studentCount, invoicesAgg, aiAgg, leadsAgg] = await Promise.all([
    // Tenants: count + MRR sum (annualFee / 12) grouped by status.
    Tenant.aggregate([
      { $match: { provisioningState: { $ne: "PROVISIONING" } } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          mrr: {
            $sum: {
              $divide: [{ $ifNull: ["$billing.annualFeeAmountTND", 0] }, 12],
            },
          },
          arr: { $sum: { $ifNull: ["$billing.annualFeeAmountTND", 0] } },
        },
      },
    ]),
    Student.countDocuments({ isActive: true }),
    Invoice.aggregate([
      {
        $facet: {
          outstanding: [
            { $match: { status: { $in: ["PENDING", "OVERDUE"] } } },
            { $group: { _id: null, total: { $sum: "$amountTND" }, count: { $sum: 1 } } },
          ],
          collectedMonth: [
            { $match: { status: "PAID", paidAt: { $gte: monthStart } } },
            { $group: { _id: null, total: { $sum: "$amountTND" } } },
          ],
        },
      },
    ]),
    // AI usage this month — separate prompt/completion for a token-weighted spend.
    AiUsageLog.aggregate([
      { $match: { createdAt: { $gte: monthStart } } },
      {
        $group: {
          _id: null,
          totalTokens: { $sum: "$totalTokens" },
          promptTokens: { $sum: "$promptTokens" },
          completionTokens: { $sum: "$completionTokens" },
          calls: { $sum: 1 },
        },
      },
    ]),
    Lead.aggregate([
      {
        $facet: {
          byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
        },
      },
    ]),
  ])

  // Roll up the aggregations.
  const revenueTiers = [TENANT_STATUS.ACTIVE, TENANT_STATUS.PAST_DUE]
  let totalTenants = 0
  let payingTenants = 0
  let trialTenants = 0
  let suspendedTenants = 0
  let mrr = 0
  let arr = 0
  for (const row of tenantsAgg as { _id: string; count: number; mrr: number; arr: number }[]) {
    totalTenants += row.count
    if (revenueTiers.includes(row._id as (typeof revenueTiers)[number])) {
      payingTenants += row.count
      mrr += row.mrr
      arr += row.arr
    }
    if (row._id === TENANT_STATUS.TRIAL) trialTenants = row.count
    if (row._id === TENANT_STATUS.SUSPENDED || row._id === TENANT_STATUS.CANCELLED) {
      suspendedTenants += row.count
    }
  }

  const outstanding = invoicesAgg[0]?.outstanding?.[0]
  const collected = invoicesAgg[0]?.collectedMonth?.[0]
  const outstandingAmount: number = outstanding?.total ?? 0
  const outstandingCount: number = outstanding?.count ?? 0
  const collectedThisMonth: number = collected?.total ?? 0

  const ai = (aiAgg as { totalTokens: number; promptTokens: number; completionTokens: number; calls: number }[])[0]
  const totalTokens = ai?.totalTokens ?? 0
  const spendUsd =
    ((ai?.promptTokens ?? 0) * GROQ_INPUT_USD_PER_M +
      (ai?.completionTokens ?? 0) * GROQ_OUTPUT_USD_PER_M) /
    1_000_000
  const spendTnd = spendUsd * TND_PER_USD

  const leadsByStatus = new Map<string, number>()
  for (const row of (leadsAgg[0]?.byStatus ?? []) as { _id: string; count: number }[]) {
    leadsByStatus.set(row._id, row.count)
  }
  const newLeads = leadsByStatus.get("NEW") ?? 0

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      <StatCard
        title={t("kpiTenants")}
        value={totalTenants}
        subtitle={t("kpiTenantsSub", {
          paying: payingTenants,
          trial: trialTenants,
          suspended: suspendedTenants,
        })}
        icon={Building2}
        index={0}
      />
      <StatCard
        title={t("kpiStudents")}
        value={studentCount}
        subtitle={t("kpiStudentsSub")}
        icon={Users}
        index={1}
      />
      <StatCard
        title={t("kpiMrr")}
        value={`${fmtTND(mrr)} د.ت`}
        subtitle={t("kpiMrrSub", { arr: fmtTND(arr) })}
        icon={TrendingUp}
        index={2}
      />
      <StatCard
        title={t("kpiOutstanding")}
        value={`${fmtTND(outstandingAmount)} د.ت`}
        subtitle={t("kpiOutstandingSub", { count: outstandingCount })}
        icon={Wallet}
        index={3}
      />
      <StatCard
        title={t("kpiCollected")}
        value={`${fmtTND(collectedThisMonth)} د.ت`}
        subtitle={t("kpiCollectedSub")}
        icon={DollarSign}
        index={4}
      />
      <StatCard
        title={t("kpiLeads")}
        value={newLeads}
        subtitle={t("kpiLeadsSub", { total: [...leadsByStatus.values()].reduce((s, n) => s + n, 0) })}
        icon={Inbox}
        index={5}
      />
      <StatCard
        title={t("kpiAiTokens")}
        value={fmtTND(totalTokens)}
        subtitle={t("kpiAiTokensSub", { calls: ai?.calls ?? 0, tnd: fmtTND(spendTnd) })}
        icon={Sparkles}
        index={6}
      />
      <StatCard
        title={t("kpiAiCalls")}
        value={ai?.calls ?? 0}
        subtitle={t("kpiAiCallsSub")}
        icon={Activity}
        index={7}
      />
    </div>
  )
}

function KpisSkeleton() {
  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-32 rounded-xl" />
      ))}
    </div>
  )
}

// ─── Needs attention ──────────────────────────────────────────────────

async function NeedsAttentionLeads({ t }: { t: Awaited<ReturnType<typeof getTranslations>> }) {
  await dbConnect()
  const now = new Date()
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
  const leads = await Lead.find({
    status: "NEW",
    createdAt: { $lte: twoDaysAgo },
  })
    .sort({ createdAt: 1 })
    .limit(5)
    .select("name associationName phone createdAt")
    .lean<{
      _id: unknown
      name: string
      associationName: string
      phone: string
      createdAt: Date
    }[]>()

  return (
    <NeedsAttentionCard
      title={t("leadsAwaitingTitle")}
      subtitle={t("leadsAwaitingSubtitle")}
      icon={<Inbox className="h-4 w-4 text-blue-600" />}
      emptyLabel={t("leadsAwaitingEmpty")}
      viewAllHref="/super-admin/leads?status=NEW"
      viewAllLabel={t("leadsAwaitingViewAll")}
      rows={leads.map((l) => ({
        key: String(l._id),
        href: `/super-admin/leads/${String(l._id)}`,
        primary: l.associationName,
        secondary: l.name,
        meta: timeAgo(l.createdAt),
      }))}
    />
  )
}

async function NeedsAttentionOverdue({ t }: { t: Awaited<ReturnType<typeof getTranslations>> }) {
  await dbConnect()
  const now = new Date()
  const overdueInvoices = await Invoice.aggregate([
    {
      $match: {
        status: { $in: ["PENDING", "OVERDUE"] },
        dueDate: { $lt: now },
      },
    },
    { $sort: { dueDate: 1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: "tenants",
        localField: "tenantId",
        foreignField: "_id",
        as: "tenant",
      },
    },
    { $unwind: { path: "$tenant", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        amountTND: 1,
        dueDate: 1,
        tenantId: 1,
        tenantName: "$tenant.name",
      },
    },
  ])

  return (
    <NeedsAttentionCard
      title={t("overdueTitle")}
      subtitle={t("overdueSubtitle")}
      icon={<AlertCircle className="h-4 w-4 text-red-600" />}
      emptyLabel={t("overdueEmpty")}
      viewAllHref="/super-admin/billing"
      viewAllLabel={t("overdueViewAll")}
      rows={overdueInvoices.map((inv) => ({
        key: String(inv._id),
        href: `/super-admin/tenants/${String(inv.tenantId)}`,
        primary: inv.tenantName ?? "—",
        secondary: t("overdueDue", { date: fmtDate(inv.dueDate) }),
        meta: `${fmtTND(inv.amountTND)} د.ت`,
      }))}
    />
  )
}

async function NeedsAttentionRenewals({ t }: { t: Awaited<ReturnType<typeof getTranslations>> }) {
  await dbConnect()
  const tStatus = await getTranslations("superAdmin.enums.tenantStatus")
  const now = new Date()
  const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const renewals = await Tenant.find({
    provisioningState: { $ne: "PROVISIONING" },
    status: { $in: [TENANT_STATUS.ACTIVE, TENANT_STATUS.TRIAL, TENANT_STATUS.PAST_DUE] },
    "billing.currentPeriodEnd": { $gte: now, $lte: in30d },
  })
    .sort({ "billing.currentPeriodEnd": 1 })
    .limit(5)
    .select("name status billing.currentPeriodEnd")
    .lean<{
      _id: unknown
      name: string
      status: string
      billing?: { currentPeriodEnd?: Date }
    }[]>()

  return (
    <NeedsAttentionCard
      title={t("renewalsTitle")}
      subtitle={t("renewalsSubtitle")}
      icon={<Clock className="h-4 w-4 text-amber-600" />}
      emptyLabel={t("renewalsEmpty")}
      viewAllHref="/super-admin/tenants"
      viewAllLabel={t("renewalsViewAll")}
      rows={renewals.map((r) => ({
        key: String(r._id),
        href: `/super-admin/tenants/${String(r._id)}`,
        primary: r.name,
        secondary: tStatus(r.status),
        meta: fmtDate(r.billing?.currentPeriodEnd),
      }))}
    />
  )
}

async function NeedsAttentionInactive({ t }: { t: Awaited<ReturnType<typeof getTranslations>> }) {
  await dbConnect()
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const rows = await User.aggregate([
    { $match: { role: ROLES.ADMIN, isActive: true } },
    {
      $group: {
        _id: "$tenantId",
        lastLoginAt: { $max: "$lastLoginAt" },
      },
    },
    { $match: { $or: [{ lastLoginAt: { $lte: cutoff } }, { lastLoginAt: null }] } },
    {
      $lookup: {
        from: "tenants",
        localField: "_id",
        foreignField: "_id",
        as: "tenant",
      },
    },
    { $unwind: { path: "$tenant", preserveNullAndEmptyArrays: false } },
    // Skip tenants that never made it out of provisioning; they're
    // "inactive" for a boring reason, not a churn reason.
    { $match: { "tenant.provisioningState": { $ne: "PROVISIONING" } } },
    // Skip cancelled — nothing to do there.
    { $match: { "tenant.status": { $ne: TENANT_STATUS.CANCELLED } } },
    { $sort: { lastLoginAt: 1 } },
    { $limit: 5 },
    {
      $project: {
        _id: 1,
        lastLoginAt: 1,
        tenantName: "$tenant.name",
      },
    },
  ])

  return (
    <NeedsAttentionCard
      title={t("inactiveTitle")}
      subtitle={t("inactiveSubtitle")}
      icon={<UserX className="h-4 w-4 text-purple-600" />}
      emptyLabel={t("inactiveEmpty")}
      viewAllHref="/super-admin/tenants"
      viewAllLabel={t("inactiveViewAll")}
      rows={rows.map((r) => ({
        key: String(r._id),
        href: `/super-admin/tenants/${String(r._id)}`,
        primary: r.tenantName,
        secondary: r.lastLoginAt
          ? t("inactiveLastLogin", { date: fmtDate(r.lastLoginAt) })
          : t("inactiveNeverLoggedIn"),
        meta: r.lastLoginAt ? timeAgo(r.lastLoginAt) : "—",
      }))}
    />
  )
}

// ─── Shared list card ─────────────────────────────────────────────────

interface NeedsAttentionRow {
  key: string
  href: string
  primary: string
  secondary: string
  meta: string
}
function NeedsAttentionCard({
  title,
  subtitle,
  icon,
  emptyLabel,
  viewAllHref,
  viewAllLabel,
  rows,
}: {
  title: string
  subtitle: string
  icon: React.ReactNode
  emptyLabel: string
  viewAllHref: string
  viewAllLabel: string
  rows: NeedsAttentionRow[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">{emptyLabel}</p>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.key}>
                <Link
                  href={r.href}
                  className="flex items-start justify-between gap-3 py-2.5 hover:bg-muted/40 -mx-2 px-2 rounded-md transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{r.primary}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.secondary}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                    {r.meta}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 pt-3 border-t">
          <Link href={viewAllHref} className="text-xs text-primary hover:underline">
            {viewAllLabel} ←
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

function ListCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6 space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
        <div className="space-y-2 mt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Recent platform activity ─────────────────────────────────────────

const ACTION_LABELS_AR: Record<string, string> = {
  TENANT_PROVISIONED: "تم إنشاء مؤسسة",
  TENANT_UPDATED: "تعديل مؤسسة",
  TENANT_PLAN_CHANGED: "تغيير باقة",
  TENANT_STATUS_CHANGED: "تغيير حالة",
  TENANT_DELETED: "حذف مؤسسة",
  ADMIN_ACCESS_REISSUED: "إعادة إصدار رابط تفعيل",
  ADMIN_ACCESS_EMAILED: "إرسال رابط بالبريد",
  ADMIN_PASSWORD_RESET: "إعادة تعيين كلمة مرور",
  IMPERSONATION_STARTED: "بدء انتحال هوية",
  IMPERSONATION_ENDED: "إنهاء انتحال هوية",
  LEAD_CONVERTED: "تحويل طلب",
  LEAD_DELETED: "حذف طلب",
  INVOICE_CREATED: "إنشاء فاتورة",
  INVOICE_PAID: "تسديد فاتورة",
  INVOICE_CANCELLED: "إلغاء فاتورة",
  BILLING_SWEEP_RUN: "تشغيل الفوترة الآلية",
  SUPER_ADMIN_CREATED: "إنشاء مدير منصة",
}

async function RecentActivity({ t }: { t: Awaited<ReturnType<typeof getTranslations>> }) {
  await dbConnect()
  const rows = await PlatformAuditLog.find({})
    .sort({ createdAt: -1 })
    .limit(10)
    .select("action actorEmail tenantId metadata createdAt")
    .lean<{
      _id: unknown
      action: string
      actorEmail: string
      tenantId?: unknown
      metadata?: Record<string, unknown>
      createdAt: Date
    }[]>()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          {t("activityTitle")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t("activitySubtitle")}</p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">{t("activityEmpty")}</p>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => {
              const label = ACTION_LABELS_AR[r.action] ?? r.action
              const target =
                (r.metadata?.name as string) ||
                (r.metadata?.tenantSlug as string) ||
                (r.metadata?.adminEmail as string) ||
                ""
              return (
                <li key={String(r._id)} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{label}</span>
                      {target && (
                        <span className="text-muted-foreground"> · {target}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate" dir="ltr">
                      {r.actorEmail}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                    {timeAgo(r.createdAt)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
