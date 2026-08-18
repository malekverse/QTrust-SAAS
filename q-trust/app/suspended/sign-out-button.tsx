"use client"

import { signOut } from "next-auth/react"
import { useTranslations } from "next-intl"
import { LogOut } from "lucide-react"

export function SignOutButton() {
  const tc = useTranslations("common")
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/auth/login" })}
      className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
    >
      <LogOut className="h-4 w-4" />
      {tc("signOut")}
    </button>
  )
}
