import { requireSuperAdmin } from "@/lib/tenant"
import dbConnect from "@/lib/db"
import Invoice from "@/models/Invoice"
import Tenant from "@/models/Tenant"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Receipt, AlertTriangle, Clock, CheckCircle2 } from "lucide-react"
import {
  INVOICE_STATUS,
  INVOICE_TYPE_LABELS,
  INVOICE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/constants"

const fmtDate = (d?: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("ar-TN", { year: "numeric", month: "short", day: "numeric" }) : "—"

function statusVariant(s: string) {
  if (s === INVOICE_STATUS.PAID) return "default" as const
  if (s === INVOICE_STATUS.OVERDUE) return "destructive" as const
  return "outline" as const
}

export default async function BillingPage() {
  await requireSuperAdmin()
  await dbConnect()

  const [invoices, tenants] = await Promise.all([
    Invoice.find({}).sort({ status: 1, dueDate: 1 }).lean(),
    Tenant.find({}).select("_id name slug").lean(),
  ])

  const tenantMap = new Map(tenants.map((t: any) => [t._id.toString(), t]))

  const pending = invoices.filter((i: any) => i.status === INVOICE_STATUS.PENDING)
  const overdue = invoices.filter((i: any) => i.status === INVOICE_STATUS.OVERDUE)
  const paid = invoices.filter((i: any) => i.status === INVOICE_STATUS.PAID)

  const totalPending = pending.reduce((s: number, i: any) => s + i.amountTND, 0)
  const totalOverdue = overdue.reduce((s: number, i: any) => s + i.amountTND, 0)
  const totalPaid = paid.reduce((s: number, i: any) => s + i.amountTND, 0)

  const actionable = [...overdue, ...pending]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">الفوترة والتحصيل</h1>
        <p className="text-muted-foreground text-sm">{invoices.length} فاتورة — لجميع المؤسسات</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">قيد الانتظار</p>
              <p className="text-lg font-bold">{totalPending} <span className="text-sm font-normal">د.ت</span></p>
              <p className="text-xs text-muted-foreground">{pending.length} فاتورة</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">متأخر</p>
              <p className="text-lg font-bold">{totalOverdue} <span className="text-sm font-normal">د.ت</span></p>
              <p className="text-xs text-muted-foreground">{overdue.length} فاتورة</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">محصّل</p>
              <p className="text-lg font-bold">{totalPaid} <span className="text-sm font-normal">د.ت</span></p>
              <p className="text-xs text-muted-foreground">{paid.length} فاتورة</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            الفواتير المعلّقة والمتأخرة ({actionable.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {actionable.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              لا توجد فواتير معلّقة — جميع المدفوعات محصّلة
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-3 font-medium">المؤسسة</th>
                    <th className="p-3 font-medium">النوع</th>
                    <th className="p-3 font-medium">المبلغ</th>
                    <th className="p-3 font-medium">الاستحقاق</th>
                    <th className="p-3 font-medium">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {actionable.map((inv: any) => {
                    const t = tenantMap.get(inv.tenantId.toString())
                    return (
                      <tr key={inv._id.toString()} className="border-t hover:bg-muted/30">
                        <td className="p-3">
                          <Link
                            href={`/super-admin/tenants/${inv.tenantId}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {(t as any)?.name ?? "—"}
                          </Link>
                        </td>
                        <td className="p-3">{INVOICE_TYPE_LABELS[inv.type] ?? inv.type}</td>
                        <td className="p-3 font-semibold">{inv.amountTND} د.ت</td>
                        <td className="p-3 text-muted-foreground">{fmtDate(inv.dueDate)}</td>
                        <td className="p-3">
                          <Badge variant={statusVariant(inv.status)}>
                            {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {paid.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">المدفوعات المحصّلة ({paid.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-3 font-medium">المؤسسة</th>
                    <th className="p-3 font-medium">النوع</th>
                    <th className="p-3 font-medium">المبلغ</th>
                    <th className="p-3 font-medium">تاريخ الدفع</th>
                    <th className="p-3 font-medium">الطريقة</th>
                  </tr>
                </thead>
                <tbody>
                  {paid.map((inv: any) => {
                    const t = tenantMap.get(inv.tenantId.toString())
                    return (
                      <tr key={inv._id.toString()} className="border-t hover:bg-muted/30">
                        <td className="p-3">
                          <Link
                            href={`/super-admin/tenants/${inv.tenantId}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {(t as any)?.name ?? "—"}
                          </Link>
                        </td>
                        <td className="p-3">{INVOICE_TYPE_LABELS[inv.type] ?? inv.type}</td>
                        <td className="p-3 font-semibold">{inv.amountTND} د.ت</td>
                        <td className="p-3 text-muted-foreground">{fmtDate(inv.paidAt)}</td>
                        <td className="p-3">{PAYMENT_METHOD_LABELS[inv.paymentMethod] ?? "—"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
