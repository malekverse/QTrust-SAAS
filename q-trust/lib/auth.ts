import NextAuth, { type NextAuthConfig, type User as NextAuthUser } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import dbConnect from './db'
import User from '@/models/User'
import Tenant from '@/models/Tenant'
import { loginSchema } from './validations'
import { ROLES, type Role } from './constants'

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
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        try {
          // Validate input
          const { email, password } = loginSchema.parse(credentials)

          // Connect to database
          await dbConnect()

          // Check if input is phone number format (+216XXXXXXXX)
          const isPhone = /^\+216\d{8}$/.test(email)
          
          let user
          if (isPhone) {
            // Search by phone number
            user = await User.findOne({ phone: email })
          } else {
            // Search by email
            user = await User.findOne({ email: email.toLowerCase() })
          }
          
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
          if (user.tenantId) {
            tenantId = user.tenantId.toString()
            const tenant = await Tenant.findById(user.tenantId)
              .select('slug plan')
              .lean<{ slug: string; plan: string }>()
            tenantSlug = tenant?.slug
            tenantPlan = tenant?.plan
          }

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
          }
        } catch (error) {
          if (error instanceof Error) {
            throw error
          }
          throw new Error('حدث خطأ أثناء تسجيل الدخول')
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
  secret: authSecret || 'dev-only-insecure-secret-set-NEXTAUTH_SECRET',
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

// Generate temporary password
export function generateTempPassword(): string {
  const year = new Date().getFullYear()
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let suffix = ''
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `Hifdh-${year}-${suffix}`
}
