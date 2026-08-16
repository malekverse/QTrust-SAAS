"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MessageCircle, Loader2, Save, Info, CheckCircle, XCircle, MinusCircle } from "lucide-react"
import {
  MESSAGING_PROVIDER,
  MESSAGING_PROVIDER_LABELS,
  MESSAGE_STATUS,
  MESSAGE_STATUS_LABELS,
  MESSAGE_TYPE_LABELS,
} from "@/lib/constants"
import { useToast } from "@/components/ui/toast"

interface ConfigResponse {
  provider: string
  whatsapp: { phoneNumberId: string; accessTokenSet: boolean }
  twilio: { accountSid: string; fromNumber: string; authTokenSet: boolean }
}
interface MessageLogItem {
  _id: string
  to: string
  type: string
  status: string
  body: string
  error?: string
  createdAt: string
}

async function fetchConfig(): Promise<ConfigResponse | { locked: true }> {
  const res = await fetch("/api/settings/messaging")
  if (res.status === 402 || res.status === 403) return { locked: true }
  if (!res.ok) throw new Error("فشل تحميل الإعدادات")
  return res.json()
}
async function fetchLogs(): Promise<MessageLogItem[]> {
  const res = await fetch("/api/messaging/logs")
  if (!res.ok) return []
  return res.json()
}

export default function MessagingPage() {
  const queryClient = useQueryClient()
  const { success, error: toastError } = useToast()

  const { data: config, isLoading } = useQuery({ queryKey: ["messaging-config"], queryFn: fetchConfig })
  const { data: logs } = useQuery({ queryKey: ["messaging-logs"], queryFn: fetchLogs })

  const locked = config && "locked" in config

  const [provider, setProvider] = useState<string>(MESSAGING_PROVIDER.DISABLED)
  const [waPhoneId, setWaPhoneId] = useState("")
  const [waToken, setWaToken] = useState("")
  const [twSid, setTwSid] = useState("")
  const [twToken, setTwToken] = useState("")
  const [twFrom, setTwFrom] = useState("")

  useEffect(() => {
    // Sync form fields from the fetched server config once it loads.
    if (config && !("locked" in config)) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setProvider(config.provider)
      setWaPhoneId(config.whatsapp.phoneNumberId)
      setTwSid(config.twilio.accountSid)
      setTwFrom(config.twilio.fromNumber)
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [config])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        provider,
        whatsapp: { phoneNumberId: waPhoneId, accessToken: waToken },
        twilio: { accountSid: twSid, authToken: twToken, fromNumber: twFrom },
      }
      const res = await fetch("/api/settings/messaging", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({ message: "فشل الحفظ" }))
        throw new Error(d.message)
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messaging-config"] })
      setWaToken("")
      setTwToken("")
      success("تم الحفظ", "تم تحديث إعدادات الرسائل")
    },
    onError: (err: Error) => toastError("خطأ", err.message),
  })

  const cfg = config && !("locked" in config) ? config : null

  const statusIcon = (s: string) => {
    if (s === MESSAGE_STATUS.SENT) return <CheckCircle className="h-4 w-4 text-emerald-500" />
    if (s === MESSAGE_STATUS.FAILED) return <XCircle className="h-4 w-4 text-red-500" />
    return <MinusCircle className="h-4 w-4 text-muted-foreground" />
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (locked) {
    return (
      <div className="space-y-6">
        <PageHeader title="الرسائل" description="إشعارات واتساب / SMS للأولياء" />
        <Card>
          <CardContent className="py-12 text-center">
            <MessageCircle className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
            <p className="font-medium">ميزة الرسائل متاحة في الباقة الاحترافية فما فوق</p>
            <p className="mt-1 text-sm text-muted-foreground">قم بترقية اشتراكك لتفعيل إشعارات الأولياء.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="الرسائل" description="إعدادات إشعارات واتساب / SMS للأولياء" />

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 text-sm">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="text-muted-foreground">
          إعدادات مزوّد الرسائل اختيارية. عند تعطيلها، تُسجَّل الرسائل دون إرسال فعلي إلى أن تُدخل بيانات
          الاعتماد. يمكنك تفعيلها لاحقاً بإدخال بيانات واتساب Cloud API أو Twilio.
        </div>
      </div>

      {/* Provider config */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="h-5 w-5" />
            مزوّد الرسائل
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>المزوّد</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="max-w-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MESSAGING_PROVIDER_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {provider === MESSAGING_PROVIDER.WHATSAPP_CLOUD && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Phone Number ID</Label>
                <Input value={waPhoneId} onChange={(e) => setWaPhoneId(e.target.value)} dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label>Access Token {cfg?.whatsapp.accessTokenSet && <span className="text-xs text-emerald-600">(محفوظ)</span>}</Label>
                <Input
                  type="password"
                  value={waToken}
                  onChange={(e) => setWaToken(e.target.value)}
                  placeholder={cfg?.whatsapp.accessTokenSet ? "•••••• (اتركه فارغاً للإبقاء)" : ""}
                  dir="ltr"
                />
              </div>
            </div>
          )}

          {provider === MESSAGING_PROVIDER.TWILIO_SMS && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Account SID</Label>
                <Input value={twSid} onChange={(e) => setTwSid(e.target.value)} dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label>Auth Token {cfg?.twilio.authTokenSet && <span className="text-xs text-emerald-600">(محفوظ)</span>}</Label>
                <Input
                  type="password"
                  value={twToken}
                  onChange={(e) => setTwToken(e.target.value)}
                  placeholder={cfg?.twilio.authTokenSet ? "•••••• (اتركه فارغاً للإبقاء)" : ""}
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label>رقم المُرسِل (From)</Label>
                <Input value={twFrom} onChange={(e) => setTwFrom(e.target.value)} placeholder="+216..." dir="ltr" />
              </div>
            </div>
          )}

          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
            حفظ الإعدادات
          </Button>
        </CardContent>
      </Card>

      {/* Recent messages */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">سجل الرسائل الأخيرة</CardTitle>
        </CardHeader>
        <CardContent>
          {!logs || logs.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">لا توجد رسائل بعد</div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log._id} className="flex items-start gap-3 rounded-lg bg-muted/40 p-3">
                  <div className="mt-0.5">{statusIcon(log.status)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{MESSAGE_TYPE_LABELS[log.type] || log.type}</Badge>
                      <span className="text-xs text-muted-foreground" dir="ltr">{log.to}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          log.status === MESSAGE_STATUS.SENT
                            ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                            : log.status === MESSAGE_STATUS.FAILED
                            ? "border-red-500/40 text-red-700 dark:text-red-400"
                            : "border-muted-foreground/30 text-muted-foreground"
                        }`}
                      >
                        {MESSAGE_STATUS_LABELS[log.status] || log.status}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{log.body}</p>
                    {log.error && <p className="mt-0.5 text-xs text-red-500">{log.error}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
