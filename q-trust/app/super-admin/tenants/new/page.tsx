"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ArrowRight, CheckCircle2, Copy } from "lucide-react"
import { PLANS, PLAN_LABELS } from "@/lib/constants"
import { useTranslations } from "next-intl"

type ProvisionResult = {
  tenant: { name: string; slug: string; plan: string }
  admin: { email: string; tempPassword: string }
  loginUrl: string
}

const slugify = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60)

export default function NewTenantPage() {
  const t = useTranslations("superAdmin")
  const tc = useTranslations("common")

  const [form, setForm] = useState({
    name: "",
    slug: "",
    plan: PLANS.STARTER as string,
    adminFullName: "",
    adminEmail: "",
    adminPhone: "",
    setupFeeAmountTND: "",
    annualFeeAmountTND: "",
  })
  const [slugEdited, setSlugEdited] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ProvisionResult | null>(null)

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const onNameChange = (v: string) => {
    setForm((f) => ({ ...f, name: v, slug: slugEdited ? f.slug : slugify(v) }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/super-admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          setupFeeAmountTND: Number(form.setupFeeAmountTND || 0),
          annualFeeAmountTND: Number(form.annualFeeAmountTND || 0),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || tc("error"))
        return
      }
      setResult(data)
    } catch {
      setError(t("tenants.connectionError"))
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <Card className="border-emerald-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
              {t("tenants.createdSuccess")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">{t("tenants.organization")}</p>
              <p className="font-semibold">{result.tenant.name}</p>
            </div>
            <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
              <p className="text-sm font-medium">{t("tenants.adminCredentials")}</p>
              <div>
                <p className="text-xs text-muted-foreground">{tc("email")}</p>
                <p className="font-mono text-sm" dir="ltr">{result.admin.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("tenants.tempPassword")}</p>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-sm bg-background px-2 py-1 rounded border" dir="ltr">
                    {result.admin.tempPassword}
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => navigator.clipboard?.writeText(result.admin.tempPassword)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("tenants.loginUrlLabel")}</p>
                <p className="font-mono text-sm text-primary" dir="ltr">{result.loginUrl}</p>
              </div>
              <p className="text-xs text-amber-600">
                {t("tenants.passwordChangeNotice")}
              </p>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" className="flex-1">
                <Link href="/super-admin/tenants">{t("tenants.backToList")}</Link>
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  setResult(null)
                  setForm({
                    name: "",
                    slug: "",
                    plan: PLANS.STARTER,
                    adminFullName: "",
                    adminEmail: "",
                    adminPhone: "",
                    setupFeeAmountTND: "",
                    annualFeeAmountTND: "",
                  })
                  setSlugEdited(false)
                }}
              >
                {t("tenants.createAnother")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon">
          <Link href="/super-admin/tenants">
            <ArrowRight className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">{t("tenants.newTenant")}</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">{t("tenants.tenantName")}</Label>
              <Input id="name" value={form.name} onChange={(e) => onNameChange(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">{t("tenants.slugLabel")}</Label>
              <Input
                id="slug"
                value={form.slug}
                dir="ltr"
                className="text-left font-mono"
                onChange={(e) => {
                  setSlugEdited(true)
                  set("slug", slugify(e.target.value))
                }}
                required
              />
              <p className="text-xs text-muted-foreground" dir="ltr">
                /t/{form.slug || "…"}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan">{t("tenants.planLabel")}</Label>
              <select
                id="plan"
                value={form.plan}
                onChange={(e) => set("plan", e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {Object.values(PLANS).map((p) => (
                  <option key={p} value={p}>
                    {PLAN_LABELS[p] ?? p}
                  </option>
                ))}
              </select>
            </div>

            <div className="border-t pt-4 space-y-4">
              <p className="text-sm font-medium text-muted-foreground">{t("tenants.firstAdminSection")}</p>
              <div className="space-y-2">
                <Label htmlFor="adminFullName">{t("tenants.adminName")}</Label>
                <Input
                  id="adminFullName"
                  value={form.adminFullName}
                  onChange={(e) => set("adminFullName", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminEmail">{t("tenants.adminEmailFull")}</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  value={form.adminEmail}
                  dir="ltr"
                  className="text-left"
                  onChange={(e) => set("adminEmail", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminPhone">{t("tenants.adminPhoneOptional")}</Label>
                <Input
                  id="adminPhone"
                  value={form.adminPhone}
                  dir="ltr"
                  className="text-left"
                  placeholder="+216XXXXXXXX"
                  onChange={(e) => set("adminPhone", e.target.value)}
                />
              </div>
            </div>

            <div className="border-t pt-4 grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="setupFee">{t("tenants.setupFee")}</Label>
                <Input
                  id="setupFee"
                  type="number"
                  min={0}
                  value={form.setupFeeAmountTND}
                  dir="ltr"
                  className="text-left"
                  onChange={(e) => set("setupFeeAmountTND", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="annualFee">{t("tenants.annualFee")}</Label>
                <Input
                  id="annualFee"
                  type="number"
                  min={0}
                  value={form.annualFeeAmountTND}
                  dir="ltr"
                  className="text-left"
                  onChange={(e) => set("annualFeeAmountTND", e.target.value)}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  {t("tenants.creating")}
                </>
              ) : (
                t("tenants.createTenant")
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
