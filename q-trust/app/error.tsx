"use client"

import "@/app/app-dashboard.css"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle, RefreshCw, Home, BookOpen } from "lucide-react"
import Link from "next/link"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-background islamic-pattern-bg flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          {/* Logo */}
          <div className="w-16 h-16 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>

          {/* Error Message */}
          <h1 className="text-2xl font-bold mb-2">حدث خطأ غير متوقع</h1>
          <p className="text-muted-foreground mb-6">
            نعتذر، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.
          </p>

          {/* Error Details (only in development) */}
          {process.env.NODE_ENV === "development" && error.message && (
            <div className="p-3 mb-6 rounded-lg bg-muted text-left text-sm font-mono overflow-auto max-h-32" dir="ltr">
              {error.message}
            </div>
          )}

          {/* Divider */}
          <div className="w-full h-px bg-gradient-to-r from-transparent via-secondary to-transparent mb-6" />

          {/* Quran Quote */}
          <p className="text-sm font-arabic text-primary mb-6">
            ﴿ إِنَّ مَعَ الْعُسْرِ يُسْرًا ﴾
          </p>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={reset}>
              <RefreshCw className="ml-2 h-4 w-4" />
              حاول مرة أخرى
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">
                <Home className="ml-2 h-4 w-4" />
                العودة للرئيسية
              </Link>
            </Button>
          </div>

          {/* Error ID */}
          {error.digest && (
            <p className="mt-6 text-xs text-muted-foreground" dir="ltr">
              Error ID: {error.digest}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

