"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/toast"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  KeyRound, Copy, Mail, RefreshCw, Loader2, CheckCircle2, Clock, AlertTriangle,
  Send, ChevronDown, ChevronUp, UserCog,
} from "lucide-react"

type AccessResponse = {
  admin: {
    _id: string
    fullName: string
    email: string
    phone?: string
    mustChangePassword: boolean
    isActive: boolean
    lastLoginAt?: string
  } | null
  activation: {
    expiresAt: string
    usedAt: string | null
    sendCount: number
    lastSentAt: string | null
    issuedAt: string
    purpose: string
    expired: boolean
  } | null
}

// Card on /super-admin/tenants/[id] that owns the first-admin access
// lifecycle: shows current activation state, lets the operator re-issue a
// link (copies it in one click), sends the link by email (SMTP or SKIPPED
// with a clear banner), and — in Phase 2.5 — "sign in as this admin".
export function AccessCard({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient()
  const t = useTranslations("superAdmin.tenants")
  const tc = useTranslations("common")
  const { success, error: showError } = useToast()
  const [reveal, setReveal] = useState<{ url: string; expiresAt: string } | null>(null)
  const [showSendForm, setShowSendForm] = useState(false)
  const [emailTo, setEmailTo] = useState<string>("")

  const { data, isLoading, isError } = useQuery<AccessResponse>({
    queryKey: ["tenant-access", tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}/access`)
      if (!res.ok) throw new Error("failed")
      return res.json()
    },
  })

  const reissue = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}/access/reissue`, {
        method: "POST",
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message || "failed")
      return body as { activation: { url: string; expiresAt: string } }
    },
    onSuccess: (data) => {
      setReveal(data.activation)
      qc.invalidateQueries({ queryKey: ["tenant-access", tenantId] })
      success(t("accessReissued"), t("accessReissuedBody"))
    },
    onError: (e: Error) => showError(tc("error"), e.message),
  })

  const impersonate = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}/impersonate`, {
        method: "POST",
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message || "failed")
      return body as { grant: string; callbackUrl: string; admin: { fullName: string }; tenant: { name: string } }
    },
    onSuccess: async (data) => {
      // Delegate the actual session swap to NextAuth's `impersonate`
      // credentials provider. It's the same provider used for the exit
      // flow, so start + exit stay symmetric.
      await signIn("impersonate", {
        grant: data.grant,
        callbackUrl: data.callbackUrl,
      })
    },
    onError: (e: Error) => showError(tc("error"), e.message),
  })

  const send = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}/access/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: emailTo || undefined, reissue: true }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message || "failed")
      return body as {
        deliveryStatus: "SENT" | "FAILED" | "SKIPPED"
        deliveryError?: string
        to: string
        activation: { url: string; expiresAt: string }
      }
    },
    onSuccess: (data) => {
      setReveal(data.activation)
      qc.invalidateQueries({ queryKey: ["tenant-access", tenantId] })
      if (data.deliveryStatus === "SENT") {
        success(t("accessEmailed"), t("accessEmailedTo", { to: data.to }))
      } else if (data.deliveryStatus === "SKIPPED") {
        showError(t("accessEmailSkipped"), t("accessEmailSkippedBody"))
      } else {
        showError(t("accessEmailFailed"), data.deliveryError || "")
      }
      setShowSendForm(false)
    },
    onError: (e: Error) => showError(tc("error"), e.message),
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("accessCardTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    )
  }
  if (isError || !data?.admin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("accessCardTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("accessNoAdmin")}</p>
        </CardContent>
      </Card>
    )
  }

  const { admin, activation } = data
  const fmt = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"

  const state: "activated" | "issued" | "expired" | "none" = !activation
    ? admin.mustChangePassword
      ? "none"
      : "activated"
    : activation.usedAt
      ? "activated"
      : activation.expired
        ? "expired"
        : "issued"

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-3">
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          {t("accessCardTitle")}
        </CardTitle>
        <StateBadge state={state} t={t} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">{t("accessAdmin")}</p>
            <p className="font-medium">{admin.fullName}</p>
            <p className="text-xs text-muted-foreground" dir="ltr">{admin.email}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("accessLastLogin")}</p>
            <p className="font-medium">{admin.lastLoginAt ? fmt(admin.lastLoginAt) : t("accessNeverLoggedIn")}</p>
          </div>
        </div>

        {activation && !activation.usedAt && !activation.expired && (
          <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{t("accessExpiresAt", { date: fmt(activation.expiresAt) })}</span>
            </div>
            {activation.sendCount > 0 && activation.lastSentAt && (
              <div className="flex items-center gap-2">
                <Send className="h-3.5 w-3.5 text-muted-foreground" />
                <span>
                  {t("accessLastSent", { date: fmt(activation.lastSentAt), count: activation.sendCount })}
                </span>
              </div>
            )}
          </div>
        )}

        {reveal && (
          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-2">
            <p className="text-xs font-medium">{t("accessRevealTitle")}</p>
            <div className="flex items-start gap-2">
              <code className="font-mono text-xs bg-background px-2 py-1 rounded border break-all flex-1" dir="ltr">
                {reveal.url}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => {
                  navigator.clipboard?.writeText(reveal.url)
                  success(t("accessCopied"), "")
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("accessExpiresAt", { date: fmt(reveal.expiresAt) })}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 ml-2" />
                {state === "none" ? t("accessIssue") : t("accessReissue")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("accessReissueTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("accessReissueBody")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={() => reissue.mutate()}>
                  {reissue.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : tc("confirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEmailTo(admin.email)
              setShowSendForm((v) => !v)
            }}
          >
            <Mail className="h-4 w-4 ml-2" />
            {t("accessSendByEmail")}
            {showSendForm ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="secondary" size="sm">
                <UserCog className="h-4 w-4 ml-2" />
                {t("accessImpersonate")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("accessImpersonateTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("accessImpersonateBody", { name: admin.fullName, email: admin.email })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={() => impersonate.mutate()}>
                  {impersonate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("accessImpersonateStart")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {showSendForm && (
          <div className="rounded-md border p-3 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("accessSendTo")}</label>
              <Input
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                dir="ltr"
                className="text-left"
              />
              <p className="text-xs text-muted-foreground mt-1">{t("accessSendHint")}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowSendForm(false)}>
                {tc("cancel")}
              </Button>
              <Button size="sm" onClick={() => send.mutate()} disabled={send.isPending || !emailTo}>
                {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 ml-2" />}
                {t("accessSendNow")}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StateBadge({ state, t }: { state: "activated" | "issued" | "expired" | "none"; t: (k: string) => string }) {
  const map = {
    activated: { icon: <CheckCircle2 className="h-3 w-3" />, cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20", label: t("accessStateActivated") },
    issued: { icon: <Clock className="h-3 w-3" />, cls: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20", label: t("accessStateIssued") },
    expired: { icon: <AlertTriangle className="h-3 w-3" />, cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20", label: t("accessStateExpired") },
    none: { icon: <AlertTriangle className="h-3 w-3" />, cls: "bg-muted text-muted-foreground border-border", label: t("accessStateNone") },
  }[state]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${map.cls}`}>
      {map.icon}
      {map.label}
    </span>
  )
}
