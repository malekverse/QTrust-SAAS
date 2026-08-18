import "@/app/app-dashboard.css"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Home } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"

export default async function NotFound() {
  const tc = await getTranslations("common")
  return (
    <div className="min-h-screen bg-background islamic-pattern-bg flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          {/* Logo */}
          <div className="rounded-xl bg-card border border-border px-4 py-3 flex items-center justify-center mx-auto mb-6 max-w-xs w-fit">
            <BrandLogo variant="symbol" className="h-20 w-auto" />
          </div>

          {/* 404 Number */}
          <h1 className="text-7xl font-bold text-primary mb-2">404</h1>
          
          {/* Arabic Message */}
          <h2 className="text-2xl font-bold mb-2">{tc("pageNotFound")}</h2>
          <p className="text-muted-foreground mb-6">
            {tc("pageNotFoundDesc")}
          </p>

          {/* Divider */}
          <div className="w-full h-px bg-gradient-to-r from-transparent via-secondary to-transparent mb-6" />

          {/* Quran Quote */}
          <p className="text-sm font-arabic text-primary mb-6">
            ﴿ وَمَا كَانَ رَبُّكَ نَسِيًّا ﴾
          </p>

          {/* Actions */}
          <div className="flex justify-center">
            <Button asChild>
              <Link href="/">
                <Home className="ml-2 h-4 w-4" />
                {tc("backHome")}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

