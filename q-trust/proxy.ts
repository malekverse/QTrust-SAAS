import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { locales, type Locale } from './i18n/config'
import { detectLocale } from './i18n/geo'

const LOCALE_COOKIE = 'NEXT_LOCALE'
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

// Next.js 16 renamed `middleware.ts` -> `proxy.ts`, which runs on the Node.js
// runtime (the old Edge middleware is deprecated). This also fixes a crash on
// Vercel: `next/server` bundles `ua-parser-js`, which references `__dirname` —
// undefined in the Edge runtime, so Edge middleware threw
// `ReferenceError: __dirname is not defined` (MIDDLEWARE_INVOCATION_FAILED) on
// every request. The Node.js runtime defines `__dirname`, so this is resolved.
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes that don't require auth
  // '/t/' is the public path-slug tenant-login entry (/t/<slug> → branded login)
  // The (marketing) route group pages are the public face of the product.
  const publicRoutes = [
    '/auth/login', '/auth/error', '/scanner', '/auth/onboarding', '/t/',
    '/pricing', '/features', '/about', '/contact', '/terms', '/privacy', '/demo',
    '/fr', '/en', '/enroll/', '/tv/',
  ]
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  // Static files and API routes that don't need auth check in the proxy
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  // First visit (no locale cookie yet): pick the display language from the
  // visitor's geo country (Vercel injects it as a header at the edge — no
  // lookup, no latency), falling back to the browser's Accept-Language, then
  // English. A manual choice via /api/locale sets the cookie and wins forever.
  const rawLocale = request.cookies.get(LOCALE_COOKIE)?.value
  const hasLocale = !!rawLocale && locales.includes(rawLocale as Locale)
  const detectedLocale: Locale | null = hasLocale
    ? null
    : detectLocale({
        country: request.headers.get('x-vercel-ip-country'),
        region: request.headers.get('x-vercel-ip-country-region'),
        acceptLanguage: request.headers.get('accept-language'),
      })

  // Persist the detected locale on whatever response we return.
  const withLocale = (res: NextResponse) => {
    if (detectedLocale) {
      res.cookies.set(LOCALE_COOKIE, detectedLocale, {
        path: '/',
        maxAge: LOCALE_COOKIE_MAX_AGE,
        sameSite: 'lax',
      })
    }
    return res
  }

  // Pass-through that also injects the detected locale into THIS request's
  // cookie header, so the very first server render already uses the right
  // language (no flash of the default locale, no extra round-trip).
  const nextWithLocale = () => {
    if (!detectedLocale) return NextResponse.next()
    const headers = new Headers(request.headers)
    const cookie = headers.get('cookie')
    headers.set(
      'cookie',
      cookie
        ? `${cookie}; ${LOCALE_COOKIE}=${detectedLocale}`
        : `${LOCALE_COOKIE}=${detectedLocale}`
    )
    return withLocale(NextResponse.next({ request: { headers } }))
  }

  // Get session token from cookie
  const sessionToken = request.cookies.get('authjs.session-token')?.value ||
                       request.cookies.get('__Secure-authjs.session-token')?.value

  const isAuthenticated = !!sessionToken

  // Redirect to login if not authenticated and trying to access protected route
  if (!isAuthenticated && !isPublicRoute && pathname !== '/') {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return withLocale(NextResponse.redirect(loginUrl))
  }

  // For authenticated users, we'll let server components handle role-based access

  // Root `/` is the public marketing landing page. Signed-in users go to their
  // role dashboard via /home (which reads the session server-side).
  if (pathname === '/' && isAuthenticated) {
    return withLocale(NextResponse.redirect(new URL('/home', request.url)))
  }

  return nextWithLocale()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     * - api routes (handled separately)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
}
