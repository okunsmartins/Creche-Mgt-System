// Late-collection fee — pure helpers (how late, and what to charge). Unit-tested.
//
// A crèche sets a collection cutoff time, an optional grace period, a flat fee and
// an optional per-block fee (e.g. €2 per 15 minutes). When a child is collected
// after the cutoff (beyond grace), the fee is: flat + ceil(chargeable/block)*perBlock.

export interface LateFeePolicy {
  /** Collection cutoff, 'HH:MM' (24h). Collection after this is late. */
  cutoffTime: string
  /** Minutes of grace after the cutoff before any charge applies. */
  graceMinutes: number
  /** Flat fee once a collection is late (beyond grace), in cents. */
  flatFeeCents: number
  /** Additional fee per block of lateness, in cents. */
  perBlockFeeCents: number
  /** Block size in minutes for the per-block fee (>= 1). */
  blockMinutes: number
}

/** Default policy for a crèche that hasn't configured late fees yet. */
export const DEFAULT_LATE_FEE_POLICY: LateFeePolicy = {
  cutoffTime: '18:00',
  graceMinutes: 0,
  flatFeeCents: 0,
  perBlockFeeCents: 0,
  blockMinutes: 15,
}

/** Parse 'HH:MM' into minutes-since-midnight, or NaN if malformed. */
export function parseTimeToMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm?.trim() ?? '')
  if (!m) return Number.NaN
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return Number.NaN
  return h * 60 + min
}

/**
 * Minutes a collection is past the cutoff (negative if before, 0 if exactly on).
 * Both times are wall-clock 'HH:MM' on the same day. NaN on malformed input.
 */
export function minutesLate(cutoffTime: string, collectedTime: string): number {
  const cutoff = parseTimeToMinutes(cutoffTime)
  const collected = parseTimeToMinutes(collectedTime)
  if (Number.isNaN(cutoff) || Number.isNaN(collected)) return Number.NaN
  return collected - cutoff
}

/**
 * Fee in cents for a collection that is `lateBy` minutes past the cutoff.
 * Not late (<= 0) or within grace → 0. Otherwise flat + per-block over grace.
 */
export function computeLateFee(policy: LateFeePolicy, lateBy: number): number {
  if (!Number.isFinite(lateBy) || lateBy <= 0) return 0
  const chargeable = lateBy - Math.max(0, policy.graceMinutes)
  if (chargeable <= 0) return 0
  const block = Math.max(1, policy.blockMinutes)
  const blocks = Math.ceil(chargeable / block)
  const flat = Math.max(0, policy.flatFeeCents)
  const perBlock = Math.max(0, policy.perBlockFeeCents)
  return flat + blocks * perBlock
}
