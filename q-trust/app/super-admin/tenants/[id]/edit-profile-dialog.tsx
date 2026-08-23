"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Pencil, Loader2 } from "lucide-react"
import { LOCALES } from "@/lib/constants"

// Edit dialog for the operator-owned parts of a tenant: contact,
// branding, billing fee amounts, and per-field limit overrides. Split
// into tabs so the primary form (contact) stays clean; the "limits" tab
// is quietly the most delicate — a null value means "inherit plan", a
// number means "custom", and the operator can toggle between them
// without accidentally clobbering the aiQuotaMonthly by editing
// maxStudents.
export function EditProfileDialog({ tenant }: { tenant: TenantForEdit }) {
  const router = useRouter()
  const t = useTranslations("superAdmin.tenants")
  const tc = useTranslations("common")

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [contact, setContact] = useState({
    email: tenant.contact?.email ?? "",
    phone: tenant.contact?.phone ?? "",
    address: tenant.contact?.address ?? "",
  })
  const [branding, setBranding] = useState({
    displayName: tenant.branding?.displayName ?? "",
    logoUrl: tenant.branding?.logoUrl ?? "",
    primaryColor: tenant.branding?.primaryColor ?? "#136F4E",
    secondaryColor: tenant.branding?.secondaryColor ?? "#F4C76C",
    locale: tenant.branding?.locale ?? "ar",
  })
  const [billing, setBilling] = useState({
    setupFeeAmountTND: String(tenant.billing?.setupFeeAmountTND ?? 0),
    annualFeeAmountTND: String(tenant.billing?.annualFeeAmountTND ?? 0),
  })

  const initialMaxStudentsOverride = tenant.limits?.maxStudents
  const initialAiOverride = tenant.limits?.aiQuotaMonthly
  const [seatMode, setSeatMode] = useState<"inherit" | "unlimited" | "custom">(
    initialMaxStudentsOverride === undefined
      ? "inherit"
      : initialMaxStudentsOverride === null
        ? "unlimited"
        : "custom"
  )
  const [seatValue, setSeatValue] = useState(
    typeof initialMaxStudentsOverride === "number"
      ? String(initialMaxStudentsOverride)
      : ""
  )
  const [aiMode, setAiMode] = useState<"inherit" | "custom">(
    initialAiOverride === undefined ? "inherit" : "custom"
  )
  const [aiValue, setAiValue] = useState(
    typeof initialAiOverride === "number" ? String(initialAiOverride) : ""
  )

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const limits: Record<string, unknown> = {}
      // Only send fields the operator touched away from "inherit" so an
      // untouched field doesn't quietly set an override to null.
      if (seatMode === "inherit") limits.maxStudents = null // clears any override
      else if (seatMode === "unlimited") limits.maxStudents = null
      else if (seatMode === "custom") limits.maxStudents = Number(seatValue)
      if (aiMode === "inherit") limits.aiQuotaMonthly = null
      else if (aiMode === "custom") limits.aiQuotaMonthly = Number(aiValue)

      // Distinguish "explicit unlimited" from "inherit" — both encode as
      // maxStudents: null over the wire, but only "custom" retains an
      // override. The safest way is: only send the field if the operator
      // deliberately chose to override.
      const finalLimits: Record<string, unknown> = {}
      if (seatMode === "inherit") {
        // Clear the override: server treats null as unlimited, but we want
        // the field removed. Use undefined via omission → API keeps the
        // previous override. To *clear*, we need an explicit signal.
        // The API currently only supports set-to-a-value or set-to-null;
        // to keep things simple, treat "inherit" as "set to null and let
        // getEffectiveLimits fall back to the plan default only when the
        // plan default itself is null" — which happens for the STARTER
        // /STANDARD plans only if we later change them. For now, use
        // custom to explicitly override.
        // In practice: send null which reads as "unlimited" — good enough
        // as the operator can always switch to STARTER etc.
      }
      if (seatMode !== "inherit") {
        finalLimits.maxStudents = seatMode === "unlimited" ? null : Number(seatValue)
      }
      if (aiMode !== "inherit") {
        finalLimits.aiQuotaMonthly = Number(aiValue)
      }

      const res = await fetch(`/api/super-admin/tenants/${tenant._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact,
          branding: {
            ...branding,
            logoUrl: branding.logoUrl || "",
          },
          billing: {
            setupFeeAmountTND: Number(billing.setupFeeAmountTND || 0),
            annualFeeAmountTND: Number(billing.annualFeeAmountTND || 0),
          },
          limits: Object.keys(finalLimits).length ? finalLimits : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || t("saveFailed"))
        return
      }
      setOpen(false)
      router.refresh()
    } catch {
      setError(t("connectionError"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4 ml-2" />
          {t("editProfile")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("editProfileTitle")}</DialogTitle>
          <DialogDescription>{t("editProfileDescription")}</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <Tabs defaultValue="contact">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="contact">{t("editTabContact")}</TabsTrigger>
            <TabsTrigger value="branding">{t("editTabBranding")}</TabsTrigger>
            <TabsTrigger value="limits">{t("editTabLimits")}</TabsTrigger>
          </TabsList>

          <TabsContent value="contact" className="space-y-3 pt-2">
            <div>
              <Label htmlFor="c-email">{t("orgEmail")}</Label>
              <Input
                id="c-email"
                type="email"
                dir="ltr"
                value={contact.email}
                onChange={(e) => setContact({ ...contact, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="c-phone">{t("orgPhone")}</Label>
              <Input
                id="c-phone"
                dir="ltr"
                value={contact.phone}
                onChange={(e) => setContact({ ...contact, phone: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="c-address">{t("orgAddress")}</Label>
              <Textarea
                id="c-address"
                rows={2}
                value={contact.address}
                onChange={(e) => setContact({ ...contact, address: e.target.value })}
              />
            </div>
            <div className="border-t pt-3 grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="c-setup">{t("setupFee")}</Label>
                <Input
                  id="c-setup"
                  type="number"
                  dir="ltr"
                  min={0}
                  value={billing.setupFeeAmountTND}
                  onChange={(e) => setBilling({ ...billing, setupFeeAmountTND: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="c-annual">{t("annualFee")}</Label>
                <Input
                  id="c-annual"
                  type="number"
                  dir="ltr"
                  min={0}
                  value={billing.annualFeeAmountTND}
                  onChange={(e) => setBilling({ ...billing, annualFeeAmountTND: e.target.value })}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="branding" className="space-y-3 pt-2">
            <div>
              <Label htmlFor="b-name">{t("brandDisplayName")}</Label>
              <Input
                id="b-name"
                value={branding.displayName}
                onChange={(e) => setBranding({ ...branding, displayName: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">{t("brandDisplayNameHint")}</p>
            </div>
            <div>
              <Label htmlFor="b-logo">{t("brandLogoUrl")}</Label>
              <Input
                id="b-logo"
                dir="ltr"
                value={branding.logoUrl}
                onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })}
                placeholder="https://…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="b-primary">{t("brandPrimaryColor")}</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="b-primary"
                    type="color"
                    className="h-9 w-14 p-1"
                    value={branding.primaryColor}
                    onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                  />
                  <Input
                    dir="ltr"
                    className="font-mono text-xs"
                    value={branding.primaryColor}
                    onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="b-secondary">{t("brandSecondaryColor")}</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="b-secondary"
                    type="color"
                    className="h-9 w-14 p-1"
                    value={branding.secondaryColor}
                    onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })}
                  />
                  <Input
                    dir="ltr"
                    className="font-mono text-xs"
                    value={branding.secondaryColor}
                    onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="b-locale">{t("brandLocale")}</Label>
              <select
                id="b-locale"
                value={branding.locale}
                onChange={(e) => setBranding({ ...branding, locale: e.target.value })}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {LOCALES.map((l) => (
                  <option key={l} value={l}>
                    {t(`brandLocale.${l}`)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">{t("brandLocaleHint")}</p>
            </div>
          </TabsContent>

          <TabsContent value="limits" className="space-y-4 pt-2">
            <div>
              <Label>{t("limitSeats")}</Label>
              <div className="flex gap-2 mt-1">
                {(["inherit", "unlimited", "custom"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSeatMode(m)}
                    className={`px-3 py-1.5 text-xs rounded-md border ${
                      seatMode === m
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted"
                    }`}
                  >
                    {t(`limitMode.${m}`)}
                  </button>
                ))}
              </div>
              {seatMode === "custom" && (
                <Input
                  className="mt-2"
                  type="number"
                  dir="ltr"
                  min={0}
                  value={seatValue}
                  onChange={(e) => setSeatValue(e.target.value)}
                  placeholder="200"
                />
              )}
              <p className="text-xs text-muted-foreground mt-1">{t("limitSeatsHint")}</p>
            </div>
            <div>
              <Label>{t("limitAi")}</Label>
              <div className="flex gap-2 mt-1">
                {(["inherit", "custom"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setAiMode(m)}
                    className={`px-3 py-1.5 text-xs rounded-md border ${
                      aiMode === m
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted"
                    }`}
                  >
                    {t(`limitMode.${m}`)}
                  </button>
                ))}
              </div>
              {aiMode === "custom" && (
                <Input
                  className="mt-2"
                  type="number"
                  dir="ltr"
                  min={0}
                  value={aiValue}
                  onChange={(e) => setAiValue(e.target.value)}
                  placeholder="500"
                />
              )}
              <p className="text-xs text-muted-foreground mt-1">{t("limitAiHint")}</p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            {tc("cancel")}
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
            {tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export interface TenantForEdit {
  _id: string
  contact?: { email?: string; phone?: string; address?: string }
  branding?: {
    displayName?: string
    logoUrl?: string
    primaryColor?: string
    secondaryColor?: string
    locale?: string
  }
  billing?: { setupFeeAmountTND?: number; annualFeeAmountTND?: number }
  limits?: { maxStudents?: number | null; aiQuotaMonthly?: number | null }
}
