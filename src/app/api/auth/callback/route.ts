import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { safeNextPath } from '@/lib/auth/confirm-link'

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
  // Only allow same-site relative paths (prevents open redirects like //evil.com)
  const safePath = safeNextPath(searchParams.get('next'))

  // Supabase sends people back with ?error_code=… when the link itself was
  // rejected — most often an expired or already-used one-time link.
  const errorCode = searchParams.get('error_code')
  if (errorCode) {
    logger.warn('auth_callback_link_rejected', { reason: errorCode })
    const reason = errorCode === 'otp_expired' ? 'link_expired' : 'auth_error'
    return NextResponse.redirect(new URL(`/login?reason=${reason}`, origin))
  }

  if (code) {
    try {
      const supabase = await createSupabaseServerClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (!error) {
        return NextResponse.redirect(new URL(safePath, origin))
      }

      logger.warn('auth_callback_exchange_failed', { reason: error.code })
      // Usually: the link was opened in a different browser from the one that
      // requested it (PKCE). The /auth/confirm email links avoid this.
      return NextResponse.redirect(new URL('/login?reason=link_other_browser', origin))
    } catch (err) {
      logger.error('auth_callback_error', { error: String(err) })
    }
  }

  // Redirect to login with an error reason on any failure
  return NextResponse.redirect(new URL('/login?reason=auth_error', origin))
}
