import type { Metadata } from "next"
import Image from "next/image"
import { notFound } from "next/navigation"
import { resolveTenantBySlug } from "@/lib/tenant"
import { getTranslations } from "next-intl/server"
import { EnrollForm } from "./enroll-form"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}): Promise<Metadata> {
  const { tenantSlug } = await params
  const t = await getTranslations("enroll")
  const tenant = await resolveTenantBySlug(tenantSlug)
  const name = tenant?.branding?.displayName || tenant?.name || t("defaultName")
  return {
    title: t("metadataTitle", { name }),
    description: t("metadataDescription", { name }),
    robots: { index: false }, // per-tenant enrollment pages aren't for search indexing
  }
}

export default async function EnrollPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}) {
  const { tenantSlug } = await params
  const tenant = await resolveTenantBySlug(tenantSlug)
  if (!tenant) notFound()

  const t = await getTranslations("enroll")
  const name = tenant.branding?.displayName || tenant.name
  const accent = tenant.branding?.primaryColor || "#136F4E"
  const logoUrl = tenant.branding?.logoUrl

  return (
    <div className="min-h-screen bg-neutral-50 py-10">
      <div className="mx-auto max-w-2xl px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          {logoUrl ? (
            <Image src={logoUrl} alt="" width={64} height={64} className="mx-auto mb-4 rounded-xl object-contain" />
          ) : (
            <div
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl text-2xl font-bold text-white"
              style={{ backgroundColor: accent }}
            >
              {name.charAt(0)}
            </div>
          )}
          <h1 className="text-2xl font-bold text-neutral-900">{name}</h1>
          <p className="mt-1 text-sm text-neutral-600">{t("formSubtitle")}</p>
        </div>

        <EnrollForm tenantSlug={tenantSlug} accent={accent} />
      </div>
    </div>
  )
}
