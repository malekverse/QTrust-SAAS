import Link from "next/link"
import { notFound } from "next/navigation"
import mongoose from "mongoose"
import { requireSuperAdmin } from "@/lib/tenant"
import dbConnect from "@/lib/db"
import Tenant from "@/models/Tenant"
import Student from "@/models/Student"
import Invoice from "@/models/Invoice"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Users } from "lucide-react"
import {
  TENANT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  INVOICE_TYPE_LABELS,
} from "@/lib/constants"
import { PlanStatusForm, InvoicePaymentControl } from "./tenant-actions"
import { AccessCard } from "./access-card"
import { getTranslations } from "next-intl/server"

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value ?? "—"}</p>
    </div>
  )
}

const fmtDate = (d?: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("ar-TN", { year: "numeric", month: "long", day: "numeric" }) : "—"

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireSuperAdmin()
  const { id } = await params
  if (!mongoose.Types.ObjectId.isValid(id)) notFound()

  await dbConnect()
  const t = await getTranslations("superAdmin")

  const tenant: any = await Tenant.findById(id).lean()
  if (!tenant) notFound()

  const [studentCount, invoices] = await Promise.all([
    Student.countDocuments({ tenantId: tenant._id, isActive: true }),
    Invoice.find({ tenantId: tenant._id }).sort({ createdAt: -1 }).lean(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon">
          <Link href="/super-admin/tenants">
            <ArrowRight className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{tenant.name}</h1>
          <p className="text-sm text-muted-foreground" dir="ltr">/t/{tenant.slug}</p>
        </div>
        <Badge variant="outline">{TENANT_STATUS_LABELS[tenant.status] ?? tenant.status}</Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("tenants.subscription")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <PlanStatusForm
              tenantId={tenant._id.toString()}
              plan={tenant.plan}
              status={tenant.status}
            />
            <div className="grid grid-cols-2 gap-4 border-t pt-4">
              <Field
                label={t("tenants.studentCountLabel")}
                value={
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {studentCount}
                    {tenant.maxStudents <= 100000 ? ` / ${tenant.maxStudents}` : ""}
                  </span>
                }
              />
              <Field label={t("tenants.aiQuota")} value={tenant.aiQuotaMonthly} />
              <Field label={t("tenants.periodStart")} value={fmtDate(tenant.billing?.currentPeriodStart)} />
              <Field label={t("tenants.periodEnd")} value={fmtDate(tenant.billing?.currentPeriodEnd)} />
            </div>
          </CardContent>
        </Card>

        <AccessCard tenantId={tenant._id.toString()} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("tenants.contactBilling")}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field label={t("tenants.orgEmail")} value={tenant.contact?.email ? <span dir="ltr">{tenant.contact.email}</span> : "—"} />
            <Field label={t("tenants.orgPhone")} value={tenant.contact?.phone ? <span dir="ltr">{tenant.contact.phone}</span> : "—"} />
            <Field label={t("tenants.setupFeeLabel")} value={`${tenant.billing?.setupFeeAmountTND ?? 0} ${t("billing.currency")}`} />
            <Field label={t("tenants.annualFeeLabel")} value={`${tenant.billing?.annualFeeAmountTND ?? 0} ${t("billing.currency")}`} />
            <Field label={t("tenants.paymentMethod")} value={PAYMENT_METHOD_LABELS[tenant.billing?.paymentMethod] ?? "—"} />
            <Field label={t("tenants.setupPayment")} value={tenant.billing?.setupFeePaid ? t("billing.paid") : t("billing.pending")} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("tenants.invoicesCount", { count: invoices.length })}</CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("billing.noInvoices")}</p>
            ) : (
              <div className="space-y-2">
                {invoices.map((inv: any) => (
                  <div
                    key={inv._id.toString()}
                    className="flex items-start justify-between gap-2 border-b pb-2 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium">{INVOICE_TYPE_LABELS[inv.type] ?? inv.type}</p>
                      <p className="text-xs text-muted-foreground">{t("tenants.dueLabel")} {fmtDate(inv.dueDate)}</p>
                    </div>
                    <InvoicePaymentControl
                      invoiceId={inv._id.toString()}
                      status={inv.status}
                      amountTND={inv.amountTND}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
