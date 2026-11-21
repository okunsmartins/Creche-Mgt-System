// Two-step sign-in (TOTP MFA) policy for privileged accounts: crèche admins and the
// platform owner. Pure (no I/O) so it's unit-tested; the session supplies the inputs.
//
// Rule: privileged accounts must use an authenticator app. Each one gets a grace
// period of ADMIN_MFA_GRACE_DAYS from the later of (a) the day this rule went live and
// (b) the day they became an admin. During grace they can work normally and see a
// reminder; after it they're sent to set-up before any admin page. Once set up, every
// new sign-in asks for the 6-digit code (Supabase assurance level aal2).

export const ADMIN_MFA_GRACE_DAYS = 7

/** When the requirement went live. Override with ADMIN_MFA_REQUIRED_FROM (ISO date). */
export const DEFAULT_ADMIN_MFA_REQUIRED_FROM = '2026-11-22T00:00:00Z'

export function adminMfaRequiredFrom(): Date {
  const raw = process.env['ADMIN_MFA_REQUIRED_FROM']
  const d = raw ? new Date(raw) : new Date(DEFAULT_ADMIN_MFA_REQUIRED_FROM)
  return Number.isNaN(d.getTime()) ? new Date(DEFAULT_ADMIN_MFA_REQUIRED_FROM) : d
}

/** What the session knows about a privileged user's two-step sign-in. */
export interface AdminMfaState {
  /** Supabase assurance level of THIS session ('aal1' = password only, 'aal2' = code entered). */
  currentLevel: string | null
  /** 'aal2' when the user has a verified authenticator factor, else 'aal1'. */
  nextLevel: string | null
  /** When they became an admin (earliest admin role), or account creation for the owner. */
  privilegedSince: string | null
}

export type MfaDecision =
  /** Set up and code entered this session (or not privileged). */
  | { kind: 'ok' }
  /** Not set up yet, still inside the grace period: allow, show a reminder. */
  | { kind: 'grace'; daysLeft: number; deadline: string }
  /** Set up, but this session hasn't entered the code yet. */
  | { kind: 'verify' }
  /** Not set up and the grace period is over. */
  | { kind: 'setup' }

const DAY_MS = 86_400_000

export function mfaGraceDeadline(privilegedSince: string | null, requiredFrom: Date): Date {
  const since = privilegedSince ? new Date(privilegedSince) : requiredFrom
  const start = Number.isNaN(since.getTime())
    ? requiredFrom
    : new Date(Math.max(since.getTime(), requiredFrom.getTime()))
  return new Date(start.getTime() + ADMIN_MFA_GRACE_DAYS * DAY_MS)
}

export function adminMfaDecision(
  state: AdminMfaState | null | undefined,
  now: Date = new Date(),
  requiredFrom: Date = adminMfaRequiredFrom(),
): MfaDecision {
  if (!state) return { kind: 'ok' } // not a privileged account
  const hasFactor = state.nextLevel === 'aal2'
  if (hasFactor) return state.currentLevel === 'aal2' ? { kind: 'ok' } : { kind: 'verify' }

  const deadline = mfaGraceDeadline(state.privilegedSince, requiredFrom)
  const msLeft = deadline.getTime() - now.getTime()
  if (msLeft > 0)
    return {
      kind: 'grace',
      daysLeft: Math.max(1, Math.ceil(msLeft / DAY_MS)),
      deadline: deadline.toISOString(),
    }
  return { kind: 'setup' }
}

/** Where to send someone for a decision that blocks (null = let them through). */
export function mfaRedirectFor(decision: MfaDecision): string | null {
  if (decision.kind === 'verify') return '/mfa/verify'
  if (decision.kind === 'setup') return '/mfa/setup'
  return null
}

/** Accept only a 6-digit authenticator code (spaces allowed, e.g. "123 456"). */
export function normaliseTotpCode(raw: unknown): string | null {
  const code = String(raw ?? '').replace(/\s+/g, '')
  return /^\d{6}$/.test(code) ? code : null
}
