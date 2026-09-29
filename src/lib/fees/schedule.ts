// Fee-schedule generation (spec §8.5 + the manager's "magic wand": log fees due
// for the year so parents aren't messaged every week). Pure + unit-tested.
//
// Produces the dated obligations across a period for a given frequency. The
// per-period amount is supplied by the caller (computed from the fee + the FEE-05
// subvention engine), keeping money maths and date maths cleanly separate. Dates
// are wall-clock 'YYYY-MM-DD' (UTC-based, no timezone drift).

export type FeeFrequency = 'weekly' | 'fortnightly' | 'monthly' | 'annually'

export interface Obligation {
  dueDate: string // YYYY-MM-DD
  amountCents: number
}

export interface FeeSchedule {
  frequency: FeeFrequency
  obligations: Obligation[]
  count: number
  totalCents: number
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/

function toUtc(iso: string): Date {
  const m = iso.match(ISO)
  if (!m) throw new Error(`Invalid date: ${iso}`)
  return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!))
}

function fromUtc(d: Date): string {
  const y = d.getUTCFullYear()
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

function addDays(iso: string, days: number): string {
  const d = toUtc(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return fromUtc(d)
}

/** Add months, clamping the day to the target month's last day (31 Jan +1 → 28/29 Feb). */
function addMonths(iso: string, months: number): string {
  const d = toUtc(iso)
  const day = d.getUTCDate()
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return fromUtc(target)
}

/**
 * The due dates for `frequency` from `startISO` up to and including `endISO`.
 * Weekly/fortnightly step by days from the start; monthly steps by calendar
 * month (day clamped); annually yields one date per year.
 */
export function generateDueDates(frequency: FeeFrequency, startISO: string, endISO: string): string[] {
  if (toUtc(startISO) > toUtc(endISO)) return []
  const dates: string[] = []
  let cur = startISO
  let i = 0
  const step = (from: string, n: number): string => {
    switch (frequency) {
      case 'weekly':
        return addDays(from, 7 * n)
      case 'fortnightly':
        return addDays(from, 14 * n)
      case 'monthly':
        return addMonths(startISO, n)
      case 'annually':
        return addMonths(startISO, 12 * n)
    }
  }
  // Guard against pathological ranges.
  const MAX = 1000
  while (toUtc(cur) <= toUtc(endISO) && i < MAX) {
    dates.push(cur)
    i++
    cur = step(startISO, i)
  }
  return dates
}

/** Build a full fee schedule: equal `amountPerPeriodCents` on each due date. */
export function generateFeeSchedule(params: {
  frequency: FeeFrequency
  startISO: string
  endISO: string
  amountPerPeriodCents: number
}): FeeSchedule {
  const { frequency, startISO, endISO } = params
  const amount = Math.max(0, Math.round(params.amountPerPeriodCents))
  const dueDates = generateDueDates(frequency, startISO, endISO)
  const obligations = dueDates.map((dueDate) => ({ dueDate, amountCents: amount }))
  return {
    frequency,
    obligations,
    count: obligations.length,
    totalCents: obligations.reduce((s, o) => s + o.amountCents, 0),
  }
}
