/**
 * Turns a Supabase `updateUser({ password })` error into a message that says
 * what actually went wrong. Previously every failure said "the reset link may
 * have expired", even when the real problem was reusing the current password.
 */

type UpdatePasswordError = { code?: string | undefined; name?: string | undefined }

const EXPIRED = 'Your reset link has expired or has already been used. Please request a new one.'

export function updatePasswordErrorMessage(error: UpdatePasswordError): string {
  if (error.name === 'AuthSessionMissingError') return EXPIRED

  switch (error.code) {
    case 'same_password':
      return 'Your new password must be different from your current password.'
    case 'weak_password':
      return 'That password is too weak or too common. Please choose a stronger one.'
    case 'session_not_found':
    case 'session_expired':
    case 'refresh_token_not_found':
    case 'refresh_token_already_used':
      return EXPIRED
    case 'over_request_rate_limit':
      return 'Too many attempts. Please wait a few minutes and try again.'
    default:
      return "We couldn't update your password. Please try again, or request a new reset link if it keeps failing."
  }
}
