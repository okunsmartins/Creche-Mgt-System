import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Route protection matrix.
 * Each entry maps a path prefix to the minimum required role.
 * Actual permission checks happen server-side in each route/action.
 */
const PROTECTED_ROUTES: Array<{ prefix: string; redirectTo: string }> = [
  { prefix: '/parent', redirectTo: '/login?reason=auth_required' },
  { prefix: '/admin', redirectTo: '/login?reason=auth_required' },
  { prefix: '/teacher', redirectTo: '/login?reason=auth_required' },
]

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development'
  return [
    "default-src 'self'",
    // nonce replaces unsafe-inline; strict-dynamic trusts dynamically loaded scripts
    // unsafe-eval retained only in dev for Next.js HMR/webpack hot reload
    ["script-src 'self'", `'nonce-${nonce}'`, "'strict-dynamic'", isDev ? "'unsafe-eval'" : '']
      .filter(Boolean)
      .join(' '),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co",
    'frame-src https://js.stripe.com https://hooks.stripe.com',
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

export async function middleware(request: NextRequest) {
  // Generate a per-request nonce for CSP (replaces unsafe-inline for scripts)
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = buildCsp(nonce)

  // Path-based tenant entry (single-domain, Aladdin-style): /s/<school>/<rest>
  // carries the tenant in a PER-REQUEST header and renders <rest>, keeping the
  // school in the URL (/s/<school>/...). No persistent cookie — so nothing
  // "sticks": the bare apex is always the platform, and a school only appears
  // when it's explicitly in the path. (getTenantSubdomain reads this header.)
  const incomingPath = request.nextUrl.pathname
  if (incomingPath === '/s' || incomingPath.startsWith('/s/')) {
    const segments = incomingPath.split('/').filter(Boolean) // ['s', sub, ...rest]
    const sub = segments[1]?.toLowerCase()
    const RESET = new Set(['reset', 'default', 'main'])

    // Bare /s or a reset keyword → the platform home; also clear any legacy cookie.
    if (!sub || RESET.has(sub)) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      const res = NextResponse.redirect(url)
      res.cookies.set('tenant', '', { path: '/', maxAge: 0 })
      res.headers.set('Content-Security-Policy', csp)
      return res
    }

    const rest = '/' + segments.slice(2).join('/')
    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = rest === '/' ? '/' : rest
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-tenant-subdomain', sub)
    const res = NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } })
    // Clear any legacy `tenant` cookie left over from the old sticky behaviour.
    res.cookies.set('tenant', '', { path: '/', maxAge: 0 })
    res.headers.set('Content-Security-Policy', csp)
    return res
  }

  const { supabaseResponse, user } = await updateSession(request)
  const pathname = request.nextUrl.pathname

  // Check protected routes
  for (const route of PROTECTED_ROUTES) {
    if (pathname.startsWith(route.prefix)) {
      if (!user) {
        const redirectUrl = new URL(route.redirectTo, request.url)
        redirectUrl.searchParams.set('next', pathname)
        const redirectResponse = NextResponse.redirect(redirectUrl)
        redirectResponse.headers.set('Content-Security-Policy', csp)
        return redirectResponse
      }
      break
    }
  }

  // Redirect authenticated users away from auth pages
  if (user && (pathname === '/login' || pathname === '/register')) {
    const redirectResponse = NextResponse.redirect(new URL('/parent/dashboard', request.url))
    redirectResponse.headers.set('Content-Security-Policy', csp)
    return redirectResponse
  }

  // Attach CSP to all non-redirect responses
  supabaseResponse.headers.set('Content-Security-Policy', csp)
  return supabaseResponse
}

export const config = {
  matcher: [
    // Run on all routes except static assets, API webhooks, and cron endpoints
    // (cron routes authenticate themselves with CRON_SECRET).
    '/((?!_next/static|_next/image|favicon.ico|branding/|icons/|api/webhooks/|api/cron/).*)',
  ],
}
