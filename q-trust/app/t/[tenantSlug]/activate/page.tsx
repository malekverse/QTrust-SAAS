"use client"

import "@/app/app-dashboard.css"
import { use, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Eye, EyeOff, KeyRound, CheckCircle2, AlertTriangle } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"

type VerifyResponse =
  | { valid: true; user: { fullName: string; email: string }; tenant: { name: string; slug: string } }
  | { valid: false; reason: string }

// Public first-login page. The token in the URL is single-use, hashed at
// rest, and expires within 72h — but assume the URL leaks (browser history,
// referrer) and behave defensively: the API atomically claims the token
// before setting the password, so a double-submit or replay after the
// first success just fails with 410.
export default function ActivatePage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}) {
  const { tenantSlug } = use(params)
  const router = useRouter()
  const search = useSearchParams()
  const token = search.get("token") ?? ""

  const [verify, setVerify] = useState<VerifyResponse | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!token) {
        setVerify({ valid: false, reason: "invalid" })
        return
      }
      try {
        const res = await fetch(
          `/api/auth/activate?token=${encodeURIComponent(token)}&slug=${encodeURIComponent(tenantSlug)}`
        )
        const data = await res.json()
        if (!cancelled) setVerify(data)
      } catch {
        if (!cancelled) setVerify({ valid: false, reason: "error" })
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [token, tenantSlug])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (newPassword.length < 8) {
      setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل")
      return
    }
    if (newPassword !== confirm) {
      setError("كلمتا المرور غير متطابقتين")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/auth/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, slug: tenantSlug, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || "حدث خطأ")
        return
      }
      setDone(true)
      // Small delay so the success frame is visible; then off to login.
      setTimeout(() => router.push(data.loginUrl || `/t/${tenantSlug}`), 1500)
    } catch {
      setError("حدث خطأ في الاتصال. حاول مرة أخرى.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background islamic-pattern-bg p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center rounded-2xl bg-card/80 border border-border shadow-lg shadow-primary/10 px-5 py-3 mb-4">
            <BrandLogo variant="symbol" className="h-12 sm:h-14 w-auto max-w-[min(100%,260px)]" priority />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">تفعيل الحساب</h1>
          <p className="text-muted-foreground">
            {verify?.valid ? `أهلاً ${verify.user.fullName}` : "أهلاً بك في Q-Trust"}
          </p>
        </div>

        {verify === null ? (
          <Card className="border-0 shadow-xl">
            <CardContent className="p-10 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground mt-3">جاري التحقق من الرابط…</p>
            </CardContent>
          </Card>
        ) : !verify.valid ? (
          <Card className="border-0 shadow-xl">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <CardTitle className="text-lg">تعذّر تفعيل الحساب</CardTitle>
              <CardDescription className="text-sm">{reasonLabel(verify.reason)}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center">
                تواصل مع إدارة المنصة للحصول على رابط جديد.
              </p>
            </CardContent>
          </Card>
        ) : done ? (
          <Card className="border-0 shadow-xl">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <CardTitle className="text-lg">تم التفعيل بنجاح</CardTitle>
              <CardDescription className="text-sm">جاري تحويلك إلى صفحة الدخول…</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card className="border-0 shadow-xl animate-fade-in stagger-1">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <KeyRound className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-lg">حدّد كلمة المرور</CardTitle>
              <CardDescription className="text-sm">
                {verify.tenant.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center">
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="pw">كلمة المرور الجديدة</Label>
                  <div className="relative">
                    <Input
                      id="pw"
                      type={showPw ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="text-left pl-10"
                      dir="ltr"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((s) => !s)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">8 أحرف على الأقل</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pw2">تأكيد كلمة المرور</Label>
                  <div className="relative">
                    <Input
                      id="pw2"
                      type={showConfirm ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="text-left pl-10"
                      dir="ltr"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((s) => !s)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري التفعيل…
                    </>
                  ) : (
                    "تفعيل وحفظ كلمة المرور"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function reasonLabel(reason: string): string {
  switch (reason) {
    case "expired":
      return "انتهت صلاحية الرابط."
    case "used":
      return "تم استخدام هذا الرابط. سجّل الدخول باستخدام كلمة المرور."
    case "tenant_mismatch":
      return "الرابط لا يطابق هذه المؤسسة."
    case "blocked":
      return "المؤسسة معلّقة أو قيد الإعداد."
    default:
      return "الرابط غير صالح."
  }
}
