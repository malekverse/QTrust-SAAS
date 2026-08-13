"use client"

import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"

export function SignOutButton() {
  return (
    <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/auth/login" })}>
      <LogOut className="h-4 w-4 ml-2" />
      خروج
    </Button>
  )
}
