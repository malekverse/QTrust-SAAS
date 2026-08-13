import { redirect } from "next/navigation"

// Pretty path-slug entry point for a tenant: /t/<slug> forwards to the branded
// login page. Real subdomains can be layered on later without changing this.
export default async function TenantLoginEntry({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}) {
  const { tenantSlug } = await params
  redirect(`/auth/login?tenant=${encodeURIComponent(tenantSlug)}`)
}
