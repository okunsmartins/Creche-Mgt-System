import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'
import type { CookieOptions } from '@supabase/ssr'
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies'

/**
 * Supabase client for use in Next.js middleware.
 * Refreshes the auth session cookie on every request.
 */
export async function updateSession(request: NextRequest) {
  // Forward request headers to the app WITHOUT the middleware-internal tenant
  // header, so a client can't forge `x-tenant-subdomain` on a non-/s path (the /s
  // branch in middleware.ts sets it itself, overwriting any client value). Rebuilt
  // each time so it still carries the refreshed session cookie set below.
  const forwardHeaders = () => {
    const h = new Headers(request.headers)
    h.delete('x-tenant-subdomain')
    return h
  }
  let supabaseResponse = NextResponse.next({ request: { headers: forwardHeaders() } })

  const supabase = createServerClient<Database>(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request: { headers: forwardHeaders() } })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Partial<ResponseCookie>),
          )
        },
      },
    },
  )

  // Refresh session — do not remove this line
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { supabaseResponse, user }
}
