import type { EmailOtpType } from '@supabase/supabase-js'

/**
 * Email links (password reset, email confirmation) land on /auth/confirm with a
 * `token_hash` that is verified server-side when the person clicks a button.
 * Unlike the PKCE `?code=` flow this works in ANY browser or device (no cookie
 * from the requesting browser is needed), and email link-scanners such as
 * Outlook Safe Links can't use the one-time link up, because they don't submit forms.
 */

const ALLOWED_TYPES: readonly EmailOtpType[] = [
  'recovery',
  'signup',
  'email',
  'invite',
  'magiclink',
  'email_change',
]

const TOKEN_HASH_RE = /^[A-Za-z0-9_-]{16,256}$/

/** Where each link type goes after a successful verify, unless `next` says otherwise. */
const DEFAULT_NEXT: Partial<Record<EmailOtpType, string>> = {
  recovery: '/reset-password',
}
const FALLBACK_NEXT = '/parent/dashboard'

/**
 * Only same-site relative paths are allowed as a redirect target. Rejects
 * absolute URLs and protocol-relative / backslash tricks (`//evil.com`,
 * `/\evil.com`) that browsers would treat as another site.
 */
export function safeNextPath(next: unknown, fallback = FALLBACK_NEXT): string {
  if (typeof next !== 'string') return fallback
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback
  if (/[\r\n\t]/.test(next)) return fallback
  return next
}

export type ConfirmLink = { tokenHash: string; type: EmailOtpType; next: string }

function first(v: unknown): unknown {
  return Array.isArray(v) ? v[0] : v
}

/** Validates the link's query params; null when anything is missing or malformed. */
export function parseConfirmLink(params: {
  token_hash?: unknown
  type?: unknown
  next?: unknown
}): ConfirmLink | null {
  const tokenHash = first(params.token_hash)
  const type = first(params.type)
  if (typeof tokenHash !== 'string' || !TOKEN_HASH_RE.test(tokenHash)) return null
  if (typeof type !== 'string' || !(ALLOWED_TYPES as readonly string[]).includes(type)) return null
  const t = type as EmailOtpType
  const next = safeNextPath(first(params.next), DEFAULT_NEXT[t] ?? FALLBACK_NEXT)
  return { tokenHash, type: t, next }
}
