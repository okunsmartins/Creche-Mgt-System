const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Trim + lowercase an email for consistent storage/uniqueness. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

/** Basic email shape check (not delivery-verifying — that's what the link is for). */
export function isValidEmail(raw: string): boolean {
  const e = normalizeEmail(raw)
  return e.length <= 254 && EMAIL_RE.test(e)
}
