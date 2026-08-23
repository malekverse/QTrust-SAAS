"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/toast"
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  ShieldCheck, UserPlus, KeyRound, Power, PowerOff, Copy, Loader2, CheckCircle2,
} from "lucide-react"

type Operator = {
  _id: string
  fullName: string
  email: string
  isActive: boolean
  mustChangePassword: boolean
  lastLoginAt?: string
  createdAt: string
}

export default function OperatorsPage() {
  const qc = useQueryClient()
  const t = useTranslations("superAdmin.operators")
  const tc = useTranslations("common")
  const { success, error: showError } = useToast()

  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({ fullName: "", email: "" })
  const [addResult, setAddResult] = useState<{ url: string; expiresAt: string } | null>(null)
  const [resetReveal, setResetReveal] = useState<{ url: string; email: string } | null>(null)

  const { data: operators, isLoading } = useQuery<Operator[]>({
    queryKey: ["operators"],
    queryFn: async () => {
      const res = await fetch("/api/super-admin/operators")
      if (!res.ok) throw new Error("failed")
      return res.json()
    },
  })

  const addOp = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/super-admin/operators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message || "failed")
      return body as { user: { email: string }; activation: { url: string; expiresAt: string } }
    },
    onSuccess: (body) => {
      setAddResult(body.activation)
      qc.invalidateQueries({ queryKey: ["operators"] })
      success(t("operatorAdded"), t("operatorAddedBody", { email: body.user.email }))
    },
    onError: (e: Error) => showError(tc("error"), e.message),
  })

  const toggle = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/super-admin/operators/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message || "failed")
      return body
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operators"] })
      success(tc("save"), t("statusUpdated"))
    },
    onError: (e: Error) => showError(tc("error"), e.message),
  })

  const reset = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/super-admin/operators/${id}/reset-password`, {
        method: "POST",
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.message || "failed")
      return body as { activation: { url: string }; user: { email: string } }
    },
    onSuccess: (body) => {
      setResetReveal({ url: body.activation.url, email: body.user.email })
      success(t("passwordReset"), t("passwordResetBody"))
    },
    onError: (e: Error) => showError(tc("error"), e.message),
  })

  const fmt = (d?: string) =>
    d
      ? new Date(d).toLocaleString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—"

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {t("pageTitle")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("pageSubtitle")}</p>
        </div>
        <Dialog
          open={addOpen}
          onOpenChange={(o) => {
            setAddOpen(o)
            if (!o) {
              setAddResult(null)
              setAddForm({ fullName: "", email: "" })
            }
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <UserPlus className="h-4 w-4 ml-2" />
              {t("addOperator")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("addOperatorTitle")}</DialogTitle>
              <DialogDescription>{t("addOperatorDescription")}</DialogDescription>
            </DialogHeader>

            {addResult ? (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="font-medium">{t("addOperatorSuccess")}</span>
                </div>
                <div className="flex items-start gap-2">
                  <code
                    className="font-mono text-xs bg-background px-2 py-1 rounded border break-all flex-1"
                    dir="ltr"
                  >
                    {addResult.url}
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => {
                      navigator.clipboard?.writeText(addResult.url)
                      success(t("linkCopied"), "")
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="op-name">{t("fullName")}</Label>
                  <Input
                    id="op-name"
                    value={addForm.fullName}
                    onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="op-email">{t("email")}</Label>
                  <Input
                    id="op-email"
                    type="email"
                    dir="ltr"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              {addResult ? (
                <Button onClick={() => setAddOpen(false)}>{tc("close")}</Button>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => setAddOpen(false)} disabled={addOp.isPending}>
                    {tc("cancel")}
                  </Button>
                  <Button
                    onClick={() => addOp.mutate()}
                    disabled={addOp.isPending || !addForm.fullName.trim() || !addForm.email.trim()}
                  >
                    {addOp.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                    {t("addOperator")}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("listTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !operators || operators.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">{t("noOperators")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="p-2 text-right font-medium">{t("nameCol")}</th>
                    <th className="p-2 text-right font-medium">{t("statusCol")}</th>
                    <th className="p-2 text-right font-medium">{t("lastLoginCol")}</th>
                    <th className="p-2 text-right font-medium">{t("actionsCol")}</th>
                  </tr>
                </thead>
                <tbody>
                  {operators.map((op) => (
                    <tr key={op._id} className="border-b last:border-0">
                      <td className="p-2">
                        <p className="font-medium">{op.fullName}</p>
                        <p className="text-xs text-muted-foreground" dir="ltr">
                          {op.email}
                        </p>
                      </td>
                      <td className="p-2">
                        {op.isActive ? (
                          <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-xs">
                            {t("active")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            {t("inactive")}
                          </Badge>
                        )}
                        {op.mustChangePassword && (
                          <Badge variant="outline" className="text-xs mr-1">
                            {t("pendingActivation")}
                          </Badge>
                        )}
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {op.lastLoginAt ? fmt(op.lastLoginAt) : t("neverLoggedIn")}
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-7">
                                <KeyRound className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t("resetPasswordTitle")}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t("resetPasswordBody", { email: op.email })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => reset.mutate(op._id)}>
                                  {tc("confirm")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-7">
                                {op.isActive ? (
                                  <PowerOff className="h-3.5 w-3.5 text-destructive" />
                                ) : (
                                  <Power className="h-3.5 w-3.5 text-emerald-600" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {op.isActive ? t("deactivateTitle") : t("reactivateTitle")}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {op.isActive
                                    ? t("deactivateBody", { email: op.email })
                                    : t("reactivateBody", { email: op.email })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    toggle.mutate({ id: op._id, isActive: !op.isActive })
                                  }
                                >
                                  {tc("confirm")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {resetReveal && (
            <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-3 space-y-2">
              <p className="text-xs font-medium">
                {t("resetRevealPrefix")} <span dir="ltr">{resetReveal.email}</span>
              </p>
              <div className="flex items-start gap-2">
                <code
                  className="font-mono text-xs bg-background px-2 py-1 rounded border break-all flex-1"
                  dir="ltr"
                >
                  {resetReveal.url}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => {
                    navigator.clipboard?.writeText(resetReveal.url)
                    success(t("linkCopied"), "")
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
