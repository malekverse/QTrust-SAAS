"use client"

import { useSession, signIn } from "next-auth/react"
import { useState } from "react"
import { UserCog, LogOut, Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"

// Sticky global banner shown while the current session was minted through
// the impersonation provider. Reads the flag straight from the session so
// there's no chance of showing it for a normal login. The exit button
// calls /api/super-admin/exit-impersonation to mint a `restore` grant,
// then signs the super-admin back in via signIn('impersonate').
export function ImpersonationBanner() {
  const { data: session } = useSession()
  const [exiting, setExiting] = useState(false)
  const t = useTranslations("superAdmin.impersonation")

  if (!session?.user?.impersonatedBy) return null

  const onExit = async () => {
    setExiting(true)
    try {
      const res = await fetch("/api/super-admin/exit-impersonation", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "failed")
      // Uses the shared `impersonate` credentials provider, which is what
      // both the start and restore flows go through — see lib/auth.ts.
      await signIn("impersonate", {
        grant: data.grant,
        callbackUrl: data.callbackUrl || "/super-admin/tenants",
      })
    } catch (e) {
      console.error("exit impersonation:", e)
      setExiting(false)
    }
  }

  return (
    <div
      className="sticky top-0 z-[100] w-full bg-amber-500 text-amber-950 shadow-sm border-b border-amber-600/40"
      role="alert"
    >
      <div className="mx-auto max-w-7xl px-4 py-2 flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <UserCog className="h-4 w-4 shrink-0" />
          <span className="truncate">
            {t("bannerBody", { name: session.user.fullName, email: session.user.email })}
          </span>
        </div>
        <button
          onClick={onExit}
          disabled={exiting}
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-950/10 hover:bg-amber-950/20 px-3 py-1 text-xs font-medium disabled:opacity-60"
        >
          {exiting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
          {t("exitButton")}
        </button>
      </div>
    </div>
  )
}
