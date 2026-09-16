/**
 * Pure SMS billing math for the hybrid model: each school gets a monthly
 * `includedLimit` allowance (resets on the 1st, no rollover); sends beyond it
 * draw from purchased `credits`. 1 credit = 1 SMS segment. A blast costs
 * `recipientCount * segments` credits total, taken from the allowance first,
 * then credits. No DB or I/O here — the send action reads/writes the balance.
 */

export interface SmsBalanceState {
  includedLimit: number
  includedUsed: number
  credits: number
}

export interface ChargeQuote {
  /** Total credits the blast needs (recipientCount * segments). */
  needed: number
  /** How many come from the monthly allowance. */
  fromAllowance: number
  /** How many come from purchased credits. */
  fromCredits: number
  /** Whether the balance can fully cover the blast. */
  affordable: boolean
  /** Credits short when not affordable (0 when affordable). */
  shortfall: number
}

/** Quote a blast against the current balance (allowance first, then credits). */
export function quoteCharge(
  balance: SmsBalanceState,
  recipientCount: number,
  segmentsPerMessage: number,
): ChargeQuote {
  const needed = Math.max(0, recipientCount) * Math.max(0, segmentsPerMessage)
  const allowanceAvailable = Math.max(0, balance.includedLimit - balance.includedUsed)
  const fromAllowance = Math.min(allowanceAvailable, needed)
  const remaining = needed - fromAllowance
  const fromCredits = Math.min(Math.max(0, balance.credits), remaining)
  const shortfall = remaining - fromCredits
  return { needed, fromAllowance, fromCredits, affordable: shortfall === 0, shortfall }
}

/** Apply a quote to a balance, returning the new balance (does not mutate). */
export function applyCharge(balance: SmsBalanceState, quote: ChargeQuote): SmsBalanceState {
  return {
    includedLimit: balance.includedLimit,
    includedUsed: balance.includedUsed + quote.fromAllowance,
    credits: balance.credits - quote.fromCredits,
  }
}

/** First day of the month containing `date`, as a YYYY-MM-DD string. */
export function periodStartOf(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

/**
 * The monthly allowance resets when the stored `periodStart` is in an earlier
 * month than `now`. Returns the reset (used→0, periodStart→this month) or null
 * if still the same period.
 */
export function periodReset(
  periodStart: string,
  now: Date,
): { includedUsed: 0; periodStart: string } | null {
  const current = periodStartOf(now)
  return periodStart < current ? { includedUsed: 0, periodStart: current } : null
}
