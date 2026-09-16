// Instalment payments: an order of at least €20 may be paid in 4 EQUAL instalments.
// Pure + server-authoritative — the amount charged is always computed from the
// order's total/paid, never supplied by the client.

export const INSTALMENT_MIN_CENTS = 2000 // €20 minimum order total to qualify
export const INSTALMENT_COUNT = 4

/** Whether an order total qualifies for instalments (≥ €20). */
export function isInstalmentEligible(totalCents: number): boolean {
  return totalCents >= INSTALMENT_MIN_CENTS
}

/**
 * The 4 instalment amounts that sum EXACTLY to the total. The base is
 * floor(total/4); the remainder (total mod 4 cents) is spread one cent at a time
 * across the first instalments, so every part is within a cent of total/4.
 * e.g. 2001 → [501, 500, 500, 500]; 2000 → [500, 500, 500, 500].
 */
export function instalmentAmountsCents(totalCents: number): number[] {
  const base = Math.floor(totalCents / INSTALMENT_COUNT)
  const remainder = totalCents - base * INSTALMENT_COUNT
  return Array.from({ length: INSTALMENT_COUNT }, (_, i) => base + (i < remainder ? 1 : 0))
}

/**
 * Amount to charge for the next instalment, given how much has already been paid.
 * Walks the schedule and returns the outstanding portion of the first
 * not-fully-covered instalment, capped to the remaining balance. Returns 0 when
 * the order is fully paid.
 */
export function nextInstalmentCents(totalCents: number, paidCents: number): number {
  const remaining = totalCents - paidCents
  if (remaining <= 0) return 0
  let cumulative = 0
  for (const amount of instalmentAmountsCents(totalCents)) {
    cumulative += amount
    if (cumulative > paidCents) {
      return Math.min(cumulative - paidCents, remaining)
    }
  }
  return remaining
}

/** How many instalments are not yet (fully) paid — for display ("3 of 4 left"). */
export function instalmentsRemaining(totalCents: number, paidCents: number): number {
  let cumulative = 0
  let remaining = 0
  for (const amount of instalmentAmountsCents(totalCents)) {
    cumulative += amount
    if (cumulative > paidCents) remaining += 1
  }
  return remaining
}
