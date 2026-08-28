"use client"

import "@/app/app-dashboard.css"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { loginSchema, type LoginInput } from "@/lib/validations"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Eye, EyeOff } from "lucide-react"
import { useTranslations } from "next-intl"
import { BrandLogo } from "@/components/brand-logo"

export function LoginForm({
  tenantSlug,
  tenantName,
  tenantNotFound,
}: {
  tenantSlug?: string
  tenantName?: string
  tenantNotFound?: boolean
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const t = useTranslations("auth.login")
  const tc = useTranslations("common")

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  // Map NextAuth error codes to user-friendly messages
  const getErrorMessage = (errorCode: string): string => {
    const errorMessages: Record<string, string> = {
      "CredentialsSignin": t("errorInvalid"),
      "Configuration": t("errorInvalid"),
      "AccessDenied": t("errorAccessDenied"),
      "Verification": t("errorVerification"),
      "Default": t("errorGeneric"),
    }
    return errorMessages[errorCode] || errorMessages["Default"]
  }

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        tenantSlug: tenantSlug ?? "",
        redirect: false,
      })

      if (result?.error) {
        setError(getErrorMessage(result.error))
      } else {
        // Redirect will be handled by the root page based on role
        router.push("/")
        router.refresh()
      }
    } catch {
      setError(t("errorGeneric"))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background islamic-pattern-bg p-4">
      {/* Background decorative elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo and Title */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center rounded-2xl bg-card/80 border border-border shadow-lg shadow-primary/10 px-5 py-3 mb-5">
            <BrandLogo
              variant="symbol"
              className="h-14 sm:h-16 w-auto max-w-[min(100%,280px)]"
              priority
            />
          </div>
          {tenantName ? (
            <p className="text-foreground font-semibold text-base">{tenantName}</p>
          ) : (
            <p className="text-muted-foreground text-sm">{t("tagline")}</p>
          )}
        </div>

        {/* Login Card */}
        <Card className="border-0 shadow-xl animate-fade-in stagger-1">
          <CardHeader className="space-y-1 text-center pb-4">
            <CardTitle className="text-xl">{t("title")}</CardTitle>
            <CardDescription>
              {tenantName ? t("welcomeTenant", { tenantName }) : t("subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tenantNotFound && (
              <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-sm text-center">
                {t("unknownTenant")}
              </div>
            )}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">{t("emailOrPhone")}</Label>
                <Input
                  id="email"
                  type="text"
                  placeholder={t("emailPlaceholder")}
                  className="text-left"
                  dir="ltr"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t("password")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="text-left pl-10"
                    dir="ltr"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    {t("loggingIn")}
                  </>
                ) : (
                  t("loginButton")
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-muted-foreground animate-fade-in stagger-2">
          <p className="font-arabic">
            بسم الله الرحمن الرحيم
          </p>
          <p className="mt-2">
            {t("copyright", { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>
    </div>
  )
}
