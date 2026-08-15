import { requireSuperAdmin } from "@/lib/tenant"
import dbConnect from "@/lib/db"
import Lead from "@/models/Lead"
import { Card } from "@/components/ui/card"
import { Inbox } from "lucide-react"
import { LeadStatusSelect } from "./lead-status"

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("ar-TN", { year: "numeric", month: "short", day: "numeric" })

export default async function LeadsPage() {
  await requireSuperAdmin()
  await dbConnect()

  const leads = await Lead.find({}).sort({ createdAt: -1 }).limit(200).lean()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">طلبات العروض التجريبية</h1>
        <p className="text-muted-foreground text-sm">{leads.length} طلب من صفحة التسويق</p>
      </div>

      {leads.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Inbox className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">لا توجد طلبات بعد</p>
          <p className="text-sm mt-1">عندما يملأ زائر نموذج «احجز عرضًا تجريبيًا» سيظهر هنا.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 font-medium">التاريخ</th>
                <th className="p-3 font-medium">الاسم</th>
                <th className="p-3 font-medium">الجمعية</th>
                <th className="p-3 font-medium">المدينة</th>
                <th className="p-3 font-medium">الهاتف</th>
                <th className="p-3 font-medium">عدد الطلاب</th>
                <th className="p-3 font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l: any) => (
                <tr key={l._id.toString()} className="border-t hover:bg-muted/30 align-top">
                  <td className="p-3 whitespace-nowrap text-muted-foreground">{fmtDate(l.createdAt)}</td>
                  <td className="p-3 font-medium">{l.name}</td>
                  <td className="p-3">
                    {l.associationName}
                    {l.message && (
                      <p className="text-xs text-muted-foreground mt-1 max-w-[36ch]">{l.message}</p>
                    )}
                  </td>
                  <td className="p-3">{l.city ?? "—"}</td>
                  <td className="p-3">
                    <a href={`tel:${l.phone}`} className="text-primary hover:underline" dir="ltr">
                      {l.phone}
                    </a>
                    {l.email && (
                      <p className="text-xs text-muted-foreground" dir="ltr">{l.email}</p>
                    )}
                  </td>
                  <td className="p-3">{l.studentCount ?? "—"}</td>
                  <td className="p-3">
                    <LeadStatusSelect leadId={l._id.toString()} status={l.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
