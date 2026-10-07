/**
 * Normalise a parent's phone number to E.164 for an Irish mobile (`+3538…`),
 * or return null if it isn't a valid Irish mobile. Numbers that don't normalise
 * are skipped at send time (and reflected in the "couldn't text N parents" gap),
 * exactly like parents without an email are skipped by the email feature.
 *
 * Accepts common inputs: `087 123 4567`, `0871234567`, `+353 87 123 4567`,
 * `00353871234567`, `353871234567`. Irish mobiles are `08[3-9]` + 6 digits
 * nationally → `+3538…` (9 digits after the country code, leading `8`).
 */
export function normalizeIrishMobile(raw: string | null | undefined): string | null {
  if (!raw) return null
  // Keep only digits and a leading '+'.
  let s = raw.trim().replace(/[^\d+]/g, '')
  if (s === '') return null

  if (s.startsWith('+')) s = s.slice(1)
  if (s.startsWith('00')) s = s.slice(2) // international prefix → drop
  // Country code followed by the national trunk 0, e.g. "+353 (0)87…" → 353 87…
  if (s.startsWith('3530')) s = `353${s.slice(4)}`
  // National form 08XXXXXXXX → 353 8XXXXXXXX
  if (s.startsWith('0')) s = `353${s.slice(1)}`
  // Bare national without the 0 (e.g. "871234567") → assume Irish.
  if (/^8[0-9]{8}$/.test(s)) s = `353${s}`

  const e164 = `+${s}`
  return /^\+3538[0-9]{8}$/.test(e164) ? e164 : null
}

export type SmsPhonePick = { phone: string } | { skip: 'opted_out' | 'no_phone' }

/**
 * Choose which number to text a parent, or why they're skipped. Precedence: the parent's
 * own profile mobile, then the child-level `parent_mobile` captured on their linked child
 * (passed already-normalised). Opted-out parents are skipped regardless of any number.
 */
export function pickSmsPhone(
  profilePhone: string | null | undefined,
  fallbackMobile: string | null | undefined,
  optedOut: boolean,
): SmsPhonePick {
  if (optedOut) return { skip: 'opted_out' }
  const own = normalizeIrishMobile(profilePhone)
  if (own) return { phone: own }
  if (fallbackMobile) return { phone: fallbackMobile }
  return { skip: 'no_phone' }
}
