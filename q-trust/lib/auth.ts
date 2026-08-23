import NextAuth, { type NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { randomInt } from 'crypto'
import dbConnect from './db'
import User from '@/models/User'
import Tenant from '@/models/Tenant'
import { loginSchema } from './validations'
import { ROLES, TENANT_STATUS, type Role } from './constants'

// Extend the built-in types
declare module 'next-auth' {
  interface User {
    id: string
    role: Role
    fullName: string
    mustChangePassword?: boolean
    studentId?: string
    tenantId?: string
    tenantSlug?: string
    tenantPlan?: string
    tenantName?: string
    // Set when the current session was minted via the `impersonate` provider.
    // The value is the super-admin user id that initiated the impersonation
    // — every mutation while this is set should carry it in its audit
    // trail so the actor is unambiguously the platform operator, not the
    // tenant admin whose seat they borrowed.
    impersonatedBy?: string
  }

  interface Session {
    user: {
      id: string
      email: string
      role: Role
      fullName: string
      mustChangePassword?: boolean
      studentId?: string
      tenantId?: string
      tenantSlug?: string
      tenantPlan?: string
      tenantName?: string
      impersonatedBy?: string
    }
  }

  interface JWT {
    id: string
    role: Role
    fullName: string
    mustChangePassword?: boolean
    studentId?: string
    tenantId?: string
    tenantSlug?: string
    tenantPlan?: string
    tenantName?: string
    impersonatedBy?: string
  }
}

// Fail fast in production if the auth secret is missing, rather than silently
// signing JWTs with a guessable default that is visible in source control.
const authSecret = process.env.NEXTAUTH_SECRET
if (!authSecret && process.env.NODE_ENV === 'production') {
  throw new Error(
    'NEXTAUTH_SECRET is not set. Refusing to start in production without a secure secret.'
  )
}

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        tenantSlug: { label: 'Tenant', type: 'text' }
      },
      async authorize(credentials) {
        try {
          // Validate input
          const { email, password } = loginSchema.parse(credentials)
          const loginTenantSlug =
            typeof credentials?.tenantSlug === 'string' && credentials.tenantSlug.trim()
              ? credentials.tenantSlug.toLowerCase().trim()
              : undefined

          // Connect to database
          await dbConnect()

          // Resolve the tenant from the login slug (path-slug login). Absent for
          // the platform super-admin and the legacy single-tenant global login.
          let scopeTenantId: string | undefined
          if (loginTenantSlug) {
            const scopeTenant = await Tenant.findOne({ slug: loginTenantSlug }).select('_id').lean()
            if (!scopeTenant) {
              throw new Error('المؤسسة غير موجودة')
            }
            scopeTenantId = scopeTenant._id.toString()
          }

          // Check if input is phone number format (+216XXXXXXXX)
          const isPhone = /^\+216\d{8}$/.test(email)
          const identityFilter = isPhone
            ? { phone: email }
            : { email: email.toLowerCase() }

          // When a tenant slug is present, scope the lookup to it so the same
          // email can exist in different associations.
          const user = await User.findOne(
            scopeTenantId ? { ...identityFilter, tenantId: scopeTenantId } : identityFilter
          )

          if (!user) {
            throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة')
          }

          // Check if user is active
          if (!user.isActive) {
            throw new Error('الحساب معطل. يرجى التواصل مع الإدارة')
          }

          // Verify password
          const isValid = await bcrypt.compare(password, user.passwordHash)
          
          if (!isValid) {
            throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة')
          }

          // Load tenant context (absent for SUPER_ADMIN, which has no tenantId)
          let tenantId: string | undefined
          let tenantSlug: string | undefined
          let tenantPlan: string | undefined
          let tenantName: string | undefined
          if (user.tenantId) {
            tenantId = user.tenantId.toString()
            const tenant = await Tenant.findById(user.tenantId)
              .select('slug plan name status branding.displayName provisioningState')
              .lean<{ slug: string; plan: string; name: string; status: string; branding?: { displayName?: string }; provisioningState?: string }>()
            // Block sign-in for a half-provisioned tenant: nothing but the
            // Tenant + admin User rows exist yet, so the dashboard would
            // load into a broken state. Once provisionTenant() flips the
            // flag to 'READY' (its "commit" point), login unlocks.
            if (tenant && tenant.provisioningState && tenant.provisioningState !== 'READY') {
              throw new Error('المؤسسة قيد الإعداد. حاول لاحقاً')
            }
            // Block sign-in for suspended/cancelled tenants.
            if (
              tenant &&
              (tenant.status === TENANT_STATUS.SUSPENDED || tenant.status === TENANT_STATUS.CANCELLED)
            ) {
              throw new Error('الحساب معلّق. يرجى التواصل مع إدارة المنصة')
            }
            tenantSlug = tenant?.slug
            tenantPlan = tenant?.plan
            tenantName = tenant?.branding?.displayName || tenant?.name
          }

          // Record the sign-in. Fire-and-forget: a telemetry write must never
          // fail an otherwise-valid login. Run after tenant-blocking checks
          // so a rejected sign-in doesn't stamp lastLoginAt.
          User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } }).catch(
            () => {}
          )

          return {
            id: user._id.toString(),
            email: user.email,
            role: user.role,
            fullName: user.fullName,
            mustChangePassword: user.mustChangePassword,
            studentId: user.studentId?.toString(),
            tenantId,
            tenantSlug,
            tenantPlan,
            tenantName,
          }
        } catch (error) {
          if (error instanceof Error) {
            throw error
          }
          throw new Error('حدث خطأ أثناء تسجيل الدخول')
        }
      }
    }),
    // Impersonation provider — the super-admin console POSTs a signed grant
    // to /api/super-admin/tenants/[id]/impersonate, which returns an opaque
    // string the client hands to signIn('impersonate', { grant }). The
    // provider verifies the HMAC + expiry server-side (see lib/impersonation),
    // then issues a session as the target user with `impersonatedBy` set.
    //
    // The same provider handles "exit impersonation": a `restore` grant
    // targets the original super-admin and does not set `impersonatedBy`.
    Credentials({
      id: 'impersonate',
      name: 'impersonate',
      credentials: { grant: { label: 'Grant', type: 'text' } },
      async authorize(credentials) {
        try {
          const { verifyGrant } = await import('./impersonation')
          const grant = typeof credentials?.grant === 'string' ? credentials.grant : ''
          const payload = verifyGrant(grant)
          if (!payload) {
            throw new Error('انتهت صلاحية إذن انتحال الهوية')
          }
          await dbConnect()
          const target = await User.findById(payload.targetUserId)
          if (!target || !target.isActive) {
            throw new Error('حساب الهدف غير متاح')
          }

          // For an 'impersonate' grant: target must be an ADMIN (never
          // impersonate a super-admin or a student). For 'restore': target
          // must be a SUPER_ADMIN. Both branches close the door on abuse
          // even if a grant somehow leaked.
          if (payload.purpose === 'impersonate' && target.role !== ROLES.ADMIN) {
            throw new Error('يُسمح فقط بانتحال حساب مدير المؤسسة')
          }
          if (payload.purpose === 'restore' && target.role !== ROLES.SUPER_ADMIN) {
            throw new Error('لا يمكن استعادة الجلسة إلى غير مدير المنصة')
          }

          let tenantId: string | undefined
          let tenantSlug: string | undefined
          let tenantPlan: string | undefined
          let tenantName: string | undefined
          if (target.tenantId) {
            tenantId = target.tenantId.toString()
            const tenant = await Tenant.findById(target.tenantId)
              .select('slug plan name status branding.displayName provisioningState')
              .lean<{ slug: string; plan: string; name: string; status: string; branding?: { displayName?: string }; provisioningState?: string }>()
            if (tenant && tenant.provisioningState && tenant.provisioningState !== 'READY') {
              throw new Error('المؤسسة قيد الإعداد')
            }
            if (
              tenant &&
              (tenant.status === TENANT_STATUS.SUSPENDED || tenant.status === TENANT_STATUS.CANCELLED)
            ) {
              throw new Error('الحساب معلّق')
            }
            tenantSlug = tenant?.slug
            tenantPlan = tenant?.plan
            tenantName = tenant?.branding?.displayName || tenant?.name
          }

          return {
            id: target._id.toString(),
            email: target.email,
            role: target.role,
            fullName: target.fullName,
            // Never force the operator through /auth/onboarding when
            // impersonating: they are not the real user of this account.
            mustChangePassword: false,
            studentId: target.studentId?.toString(),
            tenantId,
            tenantSlug,
            tenantPlan,
            tenantName,
            impersonatedBy: payload.purpose === 'impersonate' ? payload.superAdminUserId ?? undefined : undefined,
          }
        } catch (error) {
          if (error instanceof Error) throw error
          throw new Error('تعذّر انتحال الهوية')
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.fullName = user.fullName
        token.mustChangePassword = user.mustChangePassword
        token.studentId = user.studentId
        token.tenantId = user.tenantId
        token.tenantSlug = user.tenantSlug
        token.tenantPlan = user.tenantPlan
        token.tenantName = user.tenantName
        token.impersonatedBy = user.impersonatedBy
      }
      // Handle session update (e.g., after password change)
      if (trigger === 'update' && session) {
        if (session.mustChangePassword !== undefined) {
          token.mustChangePassword = session.mustChangePassword
        }
        if (session.fullName) {
          token.fullName = session.fullName
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as Role
        session.user.fullName = token.fullName as string
        session.user.mustChangePassword = token.mustChangePassword as boolean | undefined
        session.user.studentId = token.studentId as string | undefined
        session.user.tenantId = token.tenantId as string | undefined
        session.user.tenantSlug = token.tenantSlug as string | undefined
        session.user.tenantPlan = token.tenantPlan as string | undefined
        session.user.tenantName = token.tenantName as string | undefined
        session.user.impersonatedBy = token.impersonatedBy as string | undefined
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error'
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60 // 24 hours
  },
  secret: authSecret,
  trustHost: true
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)

// Helper function to get current user (for server components)
export async function getCurrentUser() {
  const session = await auth()
  return session?.user
}

// Helper to check if user is admin
export async function isAdmin() {
  const user = await getCurrentUser()
  return user?.role === ROLES.ADMIN
}

// Helper to check if user is teacher
export async function isTeacher() {
  const user = await getCurrentUser()
  return user?.role === ROLES.TEACHER || user?.role === ROLES.ADMIN
}

// Helper to check if user is student
export async function isStudent() {
  const user = await getCurrentUser()
  return user?.role === ROLES.STUDENT
}

// Hash password helper
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

// Verify password helper
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// Generate a temporary password.
//
// Uses a CSPRNG (crypto.randomInt) over an unambiguous Crockford-style base32
// alphabet (no 0/O/1/I/L to keep it easy to dictate over the phone), grouped
// into 4-char blocks — e.g. "xk4m-9rt2-hb7q". Twelve characters over a 32-symbol
// alphabet is 60 bits of entropy with no fixed/guessable prefix, unlike the old
// `Hifdh-${year}-${4 chars}` (~23 bits, known prefix, non-cryptographic RNG).
export function generateTempPassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789' // 31 symbols, no ambiguous chars
  const groups = 3
  const perGroup = 4
  const parts: string[] = []
  for (let g = 0; g < groups; g++) {
    let block = ''
    for (let i = 0; i < perGroup; i++) {
      block += alphabet.charAt(randomInt(alphabet.length))
    }
    parts.push(block)
  }
  return parts.join('-')
}
