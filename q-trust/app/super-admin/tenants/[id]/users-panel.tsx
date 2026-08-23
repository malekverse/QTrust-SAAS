"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/toast"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Users, UserPlus, KeyRound, PowerOff, Power, Copy, Loader2, CheckCircle2, ShieldCheck,
} from "lucide-react"

type TenantUser = {
  _id: string
  fullName: string
  email: string
  phone?: string
  role: "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "STUDENT"
  isActive: boolean
  mustChangePassword: boolean
  lastLoginAt?: string
  createdAt: string
}

const ROLE_KEYS: Record<string, string> = {
  ADMIN: "roleAdmin",
  TEACHER: "roleTeacher",
  STUDENT: "roleStudent",
  SUPER_ADMIN: "roleSuperAdmin",
}

export function UsersPanel({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient()
  const t = useTranslations("superAdmin.tenants")
  const tc = useTranslations("common")
  const { success, error: showError } = useToast()

  const { data: users, isLoading } = useQuery<TenantUser[]>({
    queryKey: ["tenant-users", tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}/users`)
      if (!res.ok) throw new Error("failed")
      return res.json()
    },
  })

  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({ fullName: "", email: "", phone: "" })
  const [addResult, setAddResult] = useState<{ url: string; expiresAt: string } | null>(null)

  const addAdmin = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...addForm, role: "ADMIN" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "failed")
      return data
    },
    onSuccess: (data) => {
      setAddResult(data.activation)
      qc.invalidateQueries({ queryKey: ["tenant-users", tenantId] })
      qc.invalidateQueries({ queryKey: ["tenant-access", tenantId] })
      success(t("userAdded"), t("userAddedBody"))
    },
    onError: (e: Error) => showError(tc("error"), e.message),
  })

  const toggleActive = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "failed")
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-users", tenantId] })
      success(tc("save"), t("userStatusUpdated"))
    },
    onError: (e: Error) => showError(tc("error"), e.message),
  })

  const [resetReveal, setResetReveal] = useState<{ url: string; email: string } | null>(null)
  const resetPassword = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(
        `/api/super-admin/tenants/${tenantId}/users/${userId}/reset-password`,
        { method: "POST" }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "failed")
      return data as { activation: { url: string }; user: { email: string } }
    },
    onSuccess: (data) => {
      setResetReveal({ url: data.activation.url, email: data.user.email })
      qc.invalidateQueries({ queryKey: ["tenant-access", tenantId] })
      success(t("resetPasswordSuccess"), t("resetPasswordBody"))
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          {t("usersPanelTitle")}
        </CardTitle>
        <Dialog
          open={addOpen}
          onOpenChange={(o) => {
            setAddOpen(o)
            if (!o) {
              setAddResult(null)
              setAddForm({ fullName: "", email: "", phone: "" })
            }
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <UserPlus className="h-4 w-4 ml-2" />
              {t("addAdmin")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("addAdminTitle")}</DialogTitle>
              <DialogDescription>{t("addAdminDescription")}</DialogDescription>
            </DialogHeader>

            {addResult ? (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="font-medium">{t("addAdminSuccess")}</span>
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
                  <Label htmlFor="a-name">{t("adminName")}</Label>
                  <Input
                    id="a-name"
                    value={addForm.fullName}
                    onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="a-email">{t("adminEmailFull")}</Label>
                  <Input
                    id="a-email"
                    type="email"
                    dir="ltr"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="a-phone">{t("adminPhoneOptional")}</Label>
                  <Input
                    id="a-phone"
                    dir="ltr"
                    placeholder="+216XXXXXXXX"
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              {addResult ? (
                <Button onClick={() => setAddOpen(false)}>{tc("close")}</Button>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => setAddOpen(false)}
                    disabled={addAdmin.isPending}
                  >
                    {tc("cancel")}
                  </Button>
                  <Button
                    onClick={() => addAdmin.mutate()}
                    disabled={
                      addAdmin.isPending || !addForm.fullName.trim() || !addForm.email.trim()
                    }
                  >
                    {addAdmin.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                    {t("addAdmin")}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !users || users.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">
            {t("usersPanelEmpty")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="p-2 text-right font-medium">{t("adminName")}</th>
                  <th className="p-2 text-right font-medium">{t("roleCol")}</th>
                  <th className="p-2 text-right font-medium">{t("statusCol")}</th>
                  <th className="p-2 text-right font-medium">{t("lastLoginCol")}</th>
                  <th className="p-2 text-right font-medium">{t("actionsCol")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id} className="border-b last:border-0">
                    <td className="p-2">
                      <p className="font-medium">{u.fullName}</p>
                      <p className="text-xs text-muted-foreground" dir="ltr">
                        {u.email}
                      </p>
                    </td>
                    <td className="p-2">
                      <Badge variant={u.role === "ADMIN" ? "default" : "outline"} className="text-xs">
                        {u.role === "ADMIN" && <ShieldCheck className="h-3 w-3 ml-1" />}
                        {t(ROLE_KEYS[u.role] ?? u.role)}
                      </Badge>
                    </td>
                    <td className="p-2">
                      {u.isActive ? (
                        <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-xs">
                          {t("userActive")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          {t("userInactive")}
                        </Badge>
                      )}
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {u.lastLoginAt ? fmt(u.lastLoginAt) : t("userNeverLoggedIn")}
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
                                {t("resetPasswordBody2", { email: u.email })}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => resetPassword.mutate(u._id)}>
                                {tc("confirm")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7">
                              {u.isActive ? (
                                <PowerOff className="h-3.5 w-3.5 text-destructive" />
                              ) : (
                                <Power className="h-3.5 w-3.5 text-emerald-600" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {u.isActive
                                  ? t("deactivateUserTitle")
                                  : t("reactivateUserTitle")}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {u.isActive
                                  ? t("deactivateUserBody", { email: u.email })
                                  : t("reactivateUserBody", { email: u.email })}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  toggleActive.mutate({ userId: u._id, isActive: !u.isActive })
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
              {t("resetPasswordRevealPrefix")} <span dir="ltr">{resetReveal.email}</span>
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
  )
}
