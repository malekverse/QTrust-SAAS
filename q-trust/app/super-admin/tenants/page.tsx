import Link from "next/link"
import { requireSuperAdmin } from "@/lib/tenant"
import dbConnect from "@/lib/db"
import Tenant from "@/models/Tenant"
import Student from "@/models/Student"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Building2 } from "lucide-react"
import { getEffectiveLimits } from "@/lib/entitlements"
import { getTranslations } from "next-intl/server"

export default async function TenantsPage() {
  await requireSuperAdmin()
  await dbConnect()
  const t = await getTranslations("superAdmin")
  const tPlan = await getTranslations("superAdmin.enums.plan")
  const tStatus = await getTranslations("superAdmin.enums.tenantStatus")

  const tenants = await Tenant.find({}).sort({ createdAt: -1 }).lean()
  const rows = await Promise.all(
    tenants.map(async (tn: any) => ({
      ...tn,
      studentCount: await Student.countDocuments({ tenantId: tn._id, isActive: true }),
    }))
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("tenants.pageTitle")}</h1>
          <p className="text-muted-foreground text-sm">{t("tenants.registeredCount", { count: rows.length })}</p>
        </div>
        <Button asChild>
          <Link href="/super-admin/tenants/new">
            <Plus className="h-4 w-4 ml-2" />
            {t("tenants.newTenant")}
          </Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">{t("tenants.noTenantsYet")}</p>
          <Button asChild className="mt-4">
            <Link href="/super-admin/tenants/new">{t("tenants.createFirst")}</Link>
          </Button>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 font-medium">{t("tenants.organization")}</th>
                <th className="p-3 font-medium">{t("tenants.identifier")}</th>
                <th className="p-3 font-medium">{t("tenants.planLabel")}</th>
                <th className="p-3 font-medium">{t("tenants.status")}</th>
                <th className="p-3 font-medium">{t("tenants.students")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((tn) => (
                <tr key={tn._id.toString()} className="border-t hover:bg-muted/30">
                  <td className="p-3">
                    <Link
                      href={`/super-admin/tenants/${tn._id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {tn.name}
                    </Link>
                    {tn.isDemo && (
                      <Badge variant="secondary" className="mr-2 text-xs">{t("tenants.trial")}</Badge>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground" dir="ltr">{tn.slug}</td>
                  <td className="p-3">{tPlan(tn.plan)}</td>
                  <td className="p-3">
                    <Badge variant="outline">{tStatus(tn.status)}</Badge>
                  </td>
                  <td className="p-3">
                    {tn.studentCount}
                    {(() => {
                      const { maxStudents } = getEffectiveLimits(tn)
                      return maxStudents === null ? " / ∞" : ` / ${maxStudents}`
                    })()}
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
