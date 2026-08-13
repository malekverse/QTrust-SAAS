import Link from "next/link"
import { requireSuperAdmin } from "@/lib/tenant"
import dbConnect from "@/lib/db"
import Tenant from "@/models/Tenant"
import Student from "@/models/Student"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Building2 } from "lucide-react"
import { PLAN_LABELS, TENANT_STATUS_LABELS } from "@/lib/constants"

export default async function TenantsPage() {
  await requireSuperAdmin()
  await dbConnect()

  const tenants = await Tenant.find({}).sort({ createdAt: -1 }).lean()
  const rows = await Promise.all(
    tenants.map(async (t: any) => ({
      ...t,
      studentCount: await Student.countDocuments({ tenantId: t._id, isActive: true }),
    }))
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">المؤسسات</h1>
          <p className="text-muted-foreground text-sm">{rows.length} مؤسسة مسجلة</p>
        </div>
        <Button asChild>
          <Link href="/super-admin/tenants/new">
            <Plus className="h-4 w-4 ml-2" />
            مؤسسة جديدة
          </Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">لا توجد مؤسسات بعد</p>
          <Button asChild className="mt-4">
            <Link href="/super-admin/tenants/new">إنشاء أول مؤسسة</Link>
          </Button>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 font-medium">المؤسسة</th>
                <th className="p-3 font-medium">المعرّف</th>
                <th className="p-3 font-medium">الباقة</th>
                <th className="p-3 font-medium">الحالة</th>
                <th className="p-3 font-medium">الطلاب</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t._id.toString()} className="border-t hover:bg-muted/30">
                  <td className="p-3">
                    <Link
                      href={`/super-admin/tenants/${t._id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {t.name}
                    </Link>
                    {t.isDemo && (
                      <Badge variant="secondary" className="mr-2 text-xs">تجريبي</Badge>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground" dir="ltr">{t.slug}</td>
                  <td className="p-3">{PLAN_LABELS[t.plan] ?? t.plan}</td>
                  <td className="p-3">
                    <Badge variant="outline">{TENANT_STATUS_LABELS[t.status] ?? t.status}</Badge>
                  </td>
                  <td className="p-3">
                    {t.studentCount}
                    {t.maxStudents <= 100000 ? ` / ${t.maxStudents}` : ""}
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
