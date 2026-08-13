import { resolveTenantBySlug } from "@/lib/tenant"
import { LoginForm } from "./login-form"

// Path-slug login: /auth/login?tenant=<slug> (also reachable via /t/<slug>).
// Resolves the tenant server-side so the form can brand the page and scope the
// credential check to that association. No slug = legacy global / super-admin login.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>
}) {
  const { tenant: tenantSlug } = await searchParams

  let tenantName: string | undefined
  if (tenantSlug) {
    const tenant = await resolveTenantBySlug(tenantSlug)
    tenantName = tenant?.branding?.displayName || tenant?.name
  }

  return <LoginForm tenantSlug={tenantSlug} tenantName={tenantName} />
}
