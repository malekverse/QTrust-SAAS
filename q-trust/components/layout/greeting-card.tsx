"use client"

import { useSession } from "next-auth/react"
import { Card, CardContent } from "@/components/ui/card"
import { useTranslations } from "next-intl"

function useGreeting() {
  const t = useTranslations("greeting")
  const hour = new Date().getHours()
  const greeting = t("salaam")
  const subtitle = hour < 12
    ? t("morningSubtitle")
    : hour < 17
      ? t("afternoonSubtitle")
      : t("eveningSubtitle")
  return { greeting, subtitle }
}

export function GreetingCard() {
  const { data: session } = useSession()
  const { greeting, subtitle } = useGreeting()

  return (
    <Card className="bg-gradient-to-l from-primary/5 to-secondary/5 border-primary/20 overflow-hidden relative">
      {/* Decorative Pattern */}
      <div className="absolute top-0 left-0 w-32 h-32 opacity-5">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <pattern id="islamic-pattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M10 0L20 10L10 20L0 10Z" fill="currentColor" />
          </pattern>
          <rect width="100" height="100" fill="url(#islamic-pattern)" />
        </svg>
      </div>
      
      <CardContent className="p-6 relative">
        <div className="space-y-2">
          <h2 className="text-2xl font-arabic font-bold text-primary">
            {greeting}، {session?.user?.fullName?.split(" ")[0]}
          </h2>
          <p className="text-muted-foreground font-arabic">
            {subtitle}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

