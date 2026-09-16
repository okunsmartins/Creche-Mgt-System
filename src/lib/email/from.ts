import { serverEnv } from '@/lib/env'

/**
 * Formats an RFC 5322 `From` header value from a (tenant-controlled) display
 * name. Hardening, in order:
 *  1. Control chars (incl. CR/LF/tab) are collapsed to spaces — a school name
 *     is admin-controlled, so a stray newline must never be able to split the
 *     header or inject additional ones.
 *  2. The name is quoted and its internal `"` / `\` escaped, so commas, quotes
 *     or other "specials" (e.g. `St. Mary's, Blackrock N.S.`) stay part of the
 *     single display name rather than breaking the sender.
 */
export function formatEmailFrom(displayName: string, address: string): string {
  const sanitized = displayName
    // Strip C0 control chars + DEL (incl. CR/LF/tab) so a name can't split the header.
    .replace(/[\x00-\x1f\x7f]+/g, ' ')
    // Collapse the resulting whitespace runs; hyphens/commas/apostrophes are kept.
    .replace(/\s+/g, ' ')
    .trim()
  const escaped = sanitized.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `"${escaped}" <${address}>`
}

/**
 * Builds the `from` value for outgoing tenant email.
 *
 * When a school name is supplied, that school becomes the sender's display name
 * (per-tenant) — so a parent sees mail as coming from their OWN school, not from
 * whatever single value the global `EMAIL_FROM_NAME` env var happens to hold.
 * Falls back to `EMAIL_FROM_NAME` for platform-level mail (or when no tenant is
 * in scope). The sending address is always the verified `EMAIL_FROM_ADDRESS`.
 */
export function buildEmailFrom(schoolName?: string | null): string {
  const name = schoolName?.trim() || serverEnv.emailFromName
  return formatEmailFrom(name, serverEnv.emailFromAddress)
}
