import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'

/**
 * Supabase Auth PKCE callback.
 * Handles email confirmation, password reset, and magic-link flows.
 *
 * Supabase sends users here with ?code=... after clicking an email link.
 * We exchange the code for a session and redirect to `next` (default: /parent/dashboard).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/parent/dashboard'

  // Only allow relative next paths (prevent open redirect)
  const safePath = next.startsWith('/') ? next : '/parent/dashboard'

  if (code) {
    try {
      const supabase = await createSupabaseServerClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (!error) {
        return NextResponse.redirect(new URL(safePath, origin))
      }

      logger.warn('auth_callback_exchange_failed', { reason: error.code })
    } catch (err) {
      logger.error('auth_callback_error', { error: String(err) })
    }
  }

  // Redirect to login with an error reason on any failure
  return NextResponse.redirect(new URL('/login?reason=auth_error', origin))
}
