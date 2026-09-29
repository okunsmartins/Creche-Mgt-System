// FEE-09: instalment plans for fee INVOICES (crèche rules, spec §8.4 / §12.1).
// Distinct from the order-instalment helper (lib/payments/instalments.ts), which
// keeps the school product's ≥€20 fixed-4 behaviour. Here:
//   * eligibility is STRICTLY > €20 (2000 excluded, 2001 eligible),
//   * the count is configurable (2, 3 or 4),
//   * the schedule is dated by a tenant frequency + first-payment date.
// Pure + server-authoritative; the exact-sum split guarantees no orphan cents.

export const INVOICE_INSTALMENT_MIN_CENTS = 2000 // €20.00 — must be EXCEEDED to qualify
export const ALLOWED_INSTALMENT_COUNTS = [2, 3, 4] as const
export type InstalmentCount = (typeof ALLOWED_INSTALMENT_COUNTS)[number]
export type InstalmentFrequency = 'weekly' | 'fortnightly' | 'monthly'

/** An invoice balance qualifies for instalments only when it EXCEEDS €20.00. */
export function isInvoiceInstalmentEligible(totalCents: number): boolean {
  return Math.round(totalCents) > INVOICE_INSTALMENT_MIN_CENTS
}

/** Clamp/normalise a requested count to an allowed value (2–4), default 4. */
export function normaliseInstalmentCount(n: number): InstalmentCount {
  const i = Math.round(n)
  return (ALLOWED_INSTALMENT_COUNTS as readonly number[]).includes(i) ? (i as InstalmentCount) : 4
}

/**
 * `count` amounts that sum EXACTLY to the total. Base is floor(total/count); the
 * remainder is spread one cent at a time across the first instalments, so each part
 * is within a cent of total/count. e.g. 1000 into 3 → [334, 333, 333].
 */
export function instalmentAmountsCents(totalCents: number, count: number): number[] {
  const n = normaliseInstalmentCount(count)
  const total = Math.max(0, Math.round(totalCents))
  const base = Math.floor(total / n)
  const remainder = total - base * n
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0))
}

// ─── date helpers (wall-clock UTC, no timezone drift) ────────────────────────
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/
function toUtc(iso: string): Date {
  const m = iso.match(ISO)
  if (!m) throw new Error(`Invalid date: ${iso}`)
  return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!))
}
function fromUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`
}
function addDays(iso: string, days: number): string {
  const d = toUtc(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return fromUtc(d)
}
/** Add months, clamping to the target month's last day (31 Jan +1 → 28/29 Feb). */
function addMonths(iso: string, months: number): string {
  const d = toUtc(iso)
  const day = d.getUTCDate()
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1))
  const lastDay = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate()
  t.setUTCDate(Math.min(day, lastDay))
  return fromUtc(t)
}

function stepDate(firstISO: string, frequency: InstalmentFrequency, n: number): string {
  switch (frequency) {
    case 'weekly':
      return addDays(firstISO, 7 * n)
    case 'fortnightly':
      return addDays(firstISO, 14 * n)
    case 'monthly':
      return addMonths(firstISO, n)
  }
}

export interface Instalment {
  dueDate: string // YYYY-MM-DD
  amountCents: number
}

export interface InstalmentPlan {
  eligible: boolean
  count: InstalmentCount
  frequency: InstalmentFrequency
  totalCents: number
  instalments: Instalment[]
}

/**
 * Build a dated instalment plan for an invoice balance. The first instalment falls
 * on `firstDueISO`; the rest step by `frequency`. Amounts sum exactly to the total.
 * When the balance doesn't exceed €20, returns a single pay-in-full "instalment".
 */
export function buildInstalmentPlan(params: {
  totalCents: number
  count: number
  frequency: InstalmentFrequency
  firstDueISO: string
}): InstalmentPlan {
  const total = Math.max(0, Math.round(params.totalCents))
  const eligible = isInvoiceInstalmentEligible(total)

  if (!eligible) {
    return {
      eligible: false,
      count: 2,
      frequency: params.frequency,
      totalCents: total,
      instalments: [{ dueDate: params.firstDueISO, amountCents: total }],
    }
  }

  const count = normaliseInstalmentCount(params.count)
  const amounts = instalmentAmountsCents(total, count)
  const instalments = amounts.map((amountCents, i) => ({
    dueDate: i === 0 ? params.firstDueISO : stepDate(params.firstDueISO, params.frequency, i),
    amountCents,
  }))
  return { eligible: true, count, frequency: params.frequency, totalCents: total, instalments }
}
