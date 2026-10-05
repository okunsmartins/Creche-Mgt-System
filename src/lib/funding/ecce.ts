// Funding & Hive Centre — Phase 3: ECCE registration prep (pure).
// ECCE registration needs parent/child details, child PPSN, address/Eircode, the
// registration period and the AM/PM session. For a child with an AIM Level 7
// dependency the correct AM/PM session must be confirmed, because it affects AIM
// funding — so READY is blocked until it is set.

export const ECCE_SESSIONS = ['AM', 'PM', 'OTHER'] as const
export type EcceSession = (typeof ECCE_SESSIONS)[number]

export const ECCE_SESSION_LABELS: Record<EcceSession, string> = {
  AM: 'Morning (AM)',
  PM: 'Afternoon (PM)',
  OTHER: 'Other',
}

export function isEcceSession(v: string): v is EcceSession {
  return (ECCE_SESSIONS as readonly string[]).includes(v)
}

/**
 * Rough Irish Eircode check: routing key (letter + 2 digits, e.g. D02) + space +
 * 4 alphanumerics. Deliberately permissive (format only, not existence).
 */
export function isValidEircode(value: string): boolean {
  return /^[A-Za-z]\d{2}\s?[A-Za-z0-9]{4}$/.test(value.trim())
}

export interface EcceReadyInput {
  /** Child PPSN is held (ECCE registration requires it). */
  ppsnPresent: boolean
  addressPresent: boolean
  /** Optional Eircode to format-check when provided. */
  eircode?: string | null
  registrationPeriodSet: boolean
  session?: string | null
  /** The child has an AIM Level 7 dependency (session then matters for AIM funding). */
  aimLevel7: boolean
}

type ReadyResult = { ok: true } | { ok: false; missing: string[] }

/**
 * Validate that an ECCE registration can be marked READY. Lists the exact missing
 * items rather than inventing values. The AIM L7 gate: a definite AM or PM session
 * is required (OTHER/none is not sufficient).
 */
export function validateEcceReady(input: EcceReadyInput): ReadyResult {
  const missing: string[] = []
  if (!input.ppsnPresent) missing.push('Child PPSN')
  if (!input.addressPresent) missing.push('Address')
  if (!input.registrationPeriodSet) missing.push('Registration period')
  if (input.eircode && !isValidEircode(input.eircode)) missing.push('Valid Eircode')
  if (input.aimLevel7 && !(input.session === 'AM' || input.session === 'PM'))
    missing.push('Confirmed AM/PM ECCE session (required for AIM Level 7)')
  return missing.length === 0 ? { ok: true } : { ok: false, missing }
}
