"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Bell, ClipboardList, MessageSquareWarning, CircleDollarSign, Info, CheckCheck } from "lucide-react"
import { NOTIFICATION_TYPE } from "@/lib/constants"
import { useTranslations } from "next-intl"

interface NotificationItem {
  _id: string
  type: string
  title: string
  body?: string
  link?: string
  read: boolean
  createdAt: string
}

interface NotificationsResponse {
  notifications: NotificationItem[]
  unreadCount: number
}

const typeIcon = (type: string) => {
  switch (type) {
    case NOTIFICATION_TYPE.CLAIM_SUBMITTED:
      return <MessageSquareWarning className="h-4 w-4 text-amber-600 dark:text-amber-400" />
    case NOTIFICATION_TYPE.ADMISSION_RECEIVED:
      return <ClipboardList className="h-4 w-4 text-blue-600 dark:text-blue-400" />
    case NOTIFICATION_TYPE.PAYMENT_OVERDUE:
      return <CircleDollarSign className="h-4 w-4 text-red-600 dark:text-red-400" />
    default:
      return <Info className="h-4 w-4 text-muted-foreground" />
  }
}

function timeAgo(iso: string, t: (key: string, values?: Record<string, number>) => string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return t("timeNow")
  if (min < 60) return t("timeMinutes", { count: min })
  const hr = Math.floor(min / 60)
  if (hr < 24) return t("timeHours", { count: hr })
  const day = Math.floor(hr / 24)
  return t("timeDays", { count: day })
}

async function fetchNotifications(): Promise<NotificationsResponse> {
  const res = await fetch("/api/notifications", { cache: "no-store" })
  if (!res.ok) throw new Error("failed")
  return res.json()
}

export function NotificationBell() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const t = useTranslations("notifications")

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })

  const unread = data?.unreadCount || 0
  const items = data?.notifications || []

  const markRead = async (payload: { id?: string; all?: boolean }) => {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    queryClient.invalidateQueries({ queryKey: ["notifications"] })
  }

  const onItemClick = async (n: NotificationItem) => {
    if (!n.read) await markRead({ id: n._id })
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8 sm:h-9 sm:w-9" aria-label={t("title")}>
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">{t("title")}</span>
          {unread > 0 && (
            <button
              onClick={() => markRead({ all: true })}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {t("markAllRead")}
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            <Bell className="mx-auto mb-2 h-8 w-8 opacity-30" />
            {t("noNotifications")}
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <div className="divide-y">
              {items.map((n) => (
                <button
                  key={n._id}
                  onClick={() => onItemClick(n)}
                  className={`flex w-full items-start gap-3 px-3 py-3 text-right transition-colors hover:bg-muted ${
                    n.read ? "" : "bg-primary/5"
                  }`}
                >
                  <div className="mt-0.5 shrink-0">{typeIcon(n.type)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                      <p className="truncate text-sm font-medium">{n.title}</p>
                    </div>
                    {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
                    <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(n.createdAt, t)}</p>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
