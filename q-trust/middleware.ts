import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes that don't require auth
  // '/t/' is the public path-slug tenant-login entry (/t/<slug> → branded login)
  const publicRoutes = ['/auth/login', '/auth/error', '/scanner', '/auth/onboarding', '/t/']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
  
  // Static files and API routes that don't need auth check in middleware
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
  // since we can't decode the JWT without crypto in edge runtime
  
  // Redirect root to login if not authenticated
  if (pathname === '/' && !isAuthenticated) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
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
