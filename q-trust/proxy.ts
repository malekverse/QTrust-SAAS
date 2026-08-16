import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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
    '/fr', '/enroll/', '/tv/',
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

  // Get session token from cookie
  const sessionToken = request.cookies.get('authjs.session-token')?.value ||
                       request.cookies.get('__Secure-authjs.session-token')?.value

  const isAuthenticated = !!sessionToken

  // Redirect to login if not authenticated and trying to access protected route
  if (!isAuthenticated && !isPublicRoute && pathname !== '/') {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // For authenticated users, we'll let server components handle role-based access

  // Root `/` is the public marketing landing page. Signed-in users go to their
  // role dashboard via /home (which reads the session server-side).
  if (pathname === '/' && isAuthenticated) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  return NextResponse.next()
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
