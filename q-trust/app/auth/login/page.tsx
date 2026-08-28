import { redirect } from "next/navigation"
import { resolveTenantBySlug } from "@/lib/tenant"
import { TENANT_STATUS } from "@/lib/constants"
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
  // A slug that resolves to nothing used to fall through to the unbranded
  // form with no explanation, which reads as "wrong password" territory when
  // the real problem is a bad link. Flag it so the form can say so.
  let tenantNotFound = false
  if (tenantSlug) {
    const tenant = await resolveTenantBySlug(tenantSlug)
    tenantName = tenant?.branding?.displayName || tenant?.name
    tenantNotFound = !tenant

    // Send a suspended/cancelled association to the page that explains it,
    // instead of letting them submit credentials only to hit a generic
    // "Configuration" auth error. lib/auth.ts still refuses the sign-in
    // itself — this is the friendly front door, not the security control.
    if (
      tenant &&
      (tenant.status === TENANT_STATUS.SUSPENDED || tenant.status === TENANT_STATUS.CANCELLED)
    ) {
      redirect("/suspended")
    }
  }

  return (
    <LoginForm
      tenantSlug={tenantSlug}
      tenantName={tenantName}
      tenantNotFound={tenantNotFound}
    />
  )
}
