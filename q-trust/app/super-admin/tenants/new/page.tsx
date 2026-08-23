"use client"

import { useState, useEffect, useMemo, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ArrowRight, CheckCircle2, Copy, Info, Check, X, Building2 } from "lucide-react"
import { PLANS, STUDENT_RANGES, STUDENT_RANGE_SUGGESTED_PLAN } from "@/lib/constants"
import { useTranslations } from "next-intl"

type ProvisionResult = {
  tenant: { _id: string; name: string; slug: string; plan: string }
  admin: { email: string }
  activation: { url: string; expiresAt: string }
  loginUrl: string
}

type LeadPrefill = {
  _id: string
  name: string
  associationName: string
  city?: string
  phone: string
  email?: string
  studentCount?: string
  locale: string
  status: string
}

const slugify = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60)

// Client-side Tunisia-phone normalizer that matches lib/provisioning.ts's
// normalizeTunisiaPhone(). Kept in sync deliberately — this one runs on the
// prefill/keystroke path so the operator sees a valid value immediately.
function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "")
  if (/^\+216\d{8}$/.test(digits)) return digits
  const bare = digits.replace(/^\+?216/, "")
  if (/^\d{8}$/.test(bare)) return `+216${bare}`
  return raw
}

type SlugCheck =
  | { state: "idle" | "checking" }
  | { state: "ok"; slug: string }
  | { state: "invalid"; reason: string }
  | { state: "taken"; conflictTenant: { _id: string; name: string; provisioningState: string } }

export default function NewTenantPageWrapper() {
  return (
    <Suspense fallback={null}>
      <NewTenantPage />
    </Suspense>
  )
}

function NewTenantPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const leadId = searchParams.get("leadId") ?? undefined

  const t = useTranslations("superAdmin")
  const tPlan = useTranslations("superAdmin.enums.plan")
  const tc = useTranslations("common")

  // Fetch the lead server-side (via API) when leadId is present; the query
  // params never contain personal data.
  const { data: lead } = useQuery<LeadPrefill | null>({
    queryKey: ["lead-prefill", leadId],
    queryFn: async () => {
      if (!leadId) return null
      const res = await fetch(`/api/leads/${leadId}`)
      if (!res.ok) return null
      return res.json()
    },
    enabled: Boolean(leadId),
  })

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
  const [prefilled, setPrefilled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ProvisionResult | null>(null)

  // Apply lead prefill exactly once — subsequent user edits win.
  useEffect(() => {
    if (!lead || prefilled) return
    const suggestedPlan = lead.studentCount &&
      (STUDENT_RANGE_SUGGESTED_PLAN as Record<string, string>)[lead.studentCount]
    setForm((f) => ({
      ...f,
      name: lead.associationName,
      slug: slugify(lead.associationName),
      adminFullName: lead.name,
      adminEmail: lead.email ?? "",
      adminPhone: lead.phone ? normalizePhone(lead.phone) : "",
      plan: (suggestedPlan as string) ?? f.plan,
    }))
    setPrefilled(true)
  }, [lead, prefilled])

  // Debounced slug availability check.
  const [slugCheck, setSlugCheck] = useState<SlugCheck>({ state: "idle" })
  useEffect(() => {
    const slug = form.slug.trim()
    if (slug.length < 2) {
      setSlugCheck({ state: "idle" })
      return
    }
    setSlugCheck({ state: "checking" })
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/super-admin/tenants/slug-available?slug=${encodeURIComponent(slug)}`)
        if (!res.ok) {
          setSlugCheck({ state: "idle" })
          return
        }
        const data = await res.json()
        if (data.available) setSlugCheck({ state: "ok", slug })
        else if (data.reason === "taken") setSlugCheck({ state: "taken", conflictTenant: data.conflictTenant })
        else setSlugCheck({ state: "invalid", reason: data.reason ?? "invalid" })
      } catch {
        setSlugCheck({ state: "idle" })
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [form.slug])

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const onNameChange = (v: string) => {
    setForm((f) => ({ ...f, name: v, slug: slugEdited ? f.slug : slugify(v) }))
  }

  const canSubmit = useMemo(() => {
    if (loading) return false
    if (!form.name || !form.adminFullName || !form.adminEmail) return false
    if (!form.slug || slugCheck.state === "taken" || slugCheck.state === "invalid") return false
    return true
  }, [form, slugCheck, loading])

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
          adminPhone: form.adminPhone ? normalizePhone(form.adminPhone) : undefined,
          setupFeeAmountTND: Number(form.setupFeeAmountTND || 0),
          annualFeeAmountTND: Number(form.annualFeeAmountTND || 0),
          leadId,
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
              <p className="text-sm font-medium">{t("tenants.adminAccess")}</p>
              <div>
                <p className="text-xs text-muted-foreground">{tc("email")}</p>
                <p className="font-mono text-sm" dir="ltr">{result.admin.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("tenants.activationLink")}</p>
                <div className="flex items-start gap-2">
                  <code className="font-mono text-xs bg-background px-2 py-1 rounded border break-all flex-1" dir="ltr">
                    {result.activation.url}
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => navigator.clipboard?.writeText(result.activation.url)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("tenants.activationExpires", {
                    date: new Date(result.activation.expiresAt).toLocaleString(),
                  })}
                </p>
              </div>
              <p className="text-xs text-amber-600">
                {t("tenants.activationLinkNotice")}
              </p>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" className="flex-1">
                <Link href="/super-admin/tenants">{t("tenants.backToList")}</Link>
              </Button>
              <Button asChild className="flex-1">
                <Link href={`/super-admin/tenants/${result.tenant._id}`}>
                  <Building2 className="h-4 w-4 ml-2" />
                  {t("tenants.openTenant")}
                </Link>
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
          <Link href={leadId ? `/super-admin/leads/${leadId}` : "/super-admin/tenants"}>
            <ArrowRight className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">
          {lead ? t("tenants.convertingLead") : t("tenants.newTenant")}
        </h1>
      </div>

      {lead && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm flex items-start gap-2">
          <Info className="h-4 w-4 text-primary mt-0.5" />
          <div>
            <p className="font-medium">{t("tenants.prefilledFromLead", { name: lead.associationName })}</p>
            <p className="text-muted-foreground text-xs">{t("tenants.prefillHint")}</p>
          </div>
        </div>
      )}

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
              <div className="relative">
                <Input
                  id="slug"
                  value={form.slug}
                  dir="ltr"
                  className="text-left font-mono pr-9"
                  onChange={(e) => {
                    setSlugEdited(true)
                    set("slug", slugify(e.target.value))
                  }}
                  required
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {slugCheck.state === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {slugCheck.state === "ok" && <Check className="h-4 w-4 text-emerald-600" />}
                  {(slugCheck.state === "taken" || slugCheck.state === "invalid") && (
                    <X className="h-4 w-4 text-destructive" />
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground" dir="ltr">
                /t/{form.slug || "…"}
              </p>
              {slugCheck.state === "taken" && (
                <p className="text-xs text-destructive">
                  {t("tenants.slugTakenBy", { name: slugCheck.conflictTenant.name })}{" "}
                  <Link
                    href={`/super-admin/tenants/${slugCheck.conflictTenant._id}`}
                    className="underline"
                  >
                    {t("tenants.viewExisting")}
                  </Link>
                </p>
              )}
              {slugCheck.state === "invalid" && (
                <p className="text-xs text-destructive">{t("tenants.slugInvalid")}</p>
              )}
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
                    {tPlan(p)}
                  </option>
                ))}
              </select>
              {lead?.studentCount && (STUDENT_RANGES as Record<string, string>)[lead.studentCount] && (
                <p className="text-xs text-muted-foreground">
                  {t("tenants.planSuggestedFromRange")}
                </p>
              )}
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
                  onBlur={(e) => set("adminPhone", normalizePhone(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">{t("tenants.phoneHint")}</p>
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

            <Button type="submit" className="w-full" size="lg" disabled={!canSubmit}>
              {loading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  {t("tenants.creating")}
                </>
              ) : (
                lead ? t("tenants.convertAndCreate") : t("tenants.createTenant")
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
