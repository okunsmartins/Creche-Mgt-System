// Admin home dashboard — pure helpers (unit-tested). No DB.

const DAY_MS = 86_400_000

function parseISO(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`)
}

/** Whole days from `fromISO` to `toISO` (YYYY-MM-DD); negative if `toISO` is earlier. */
export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((parseISO(toISO) - parseISO(fromISO)) / DAY_MS)
}

/** The same weekday one week earlier, as YYYY-MM-DD. */
export function sameDayLastWeek(todayISO: string): string {
  return new Date(parseISO(todayISO) - 7 * DAY_MS).toISOString().slice(0, 10)
}

export interface FeeInvoice {
  netParentCents: number
  amountPaidCents: number
  dueDate: string // YYYY-MM-DD
  status: string
}

export interface MonthFeeSplit {
  /** Paid towards invoices due this calendar month. */
  paidCents: number
  /** Still owed on this month's invoices whose due date hasn't passed. */
  upcomingCents: number
  /** Still owed on this month's invoices already past their due date. */
  overdueCents: number
  totalCents: number
}

const BILLED = new Set(['issued', 'part_paid', 'paid'])

/** Split this calendar month's invoices (by due date) into paid / not yet due / overdue. */
export function monthFeeSplit(
  invoices: ReadonlyArray<FeeInvoice>,
  todayISO: string,
): MonthFeeSplit {
  const month = todayISO.slice(0, 7)
  let paidCents = 0
  let upcomingCents = 0
  let overdueCents = 0
  for (const inv of invoices) {
    if (!BILLED.has(inv.status) || inv.dueDate.slice(0, 7) !== month) continue
    const net = Math.max(0, inv.netParentCents)
    const paid = Math.min(Math.max(0, inv.amountPaidCents), net)
    paidCents += paid
    const owed = net - paid
    if (owed <= 0) continue
    if (inv.dueDate < todayISO) overdueCents += owed
    else upcomingCents += owed
  }
  return {
    paidCents,
    upcomingCents,
    overdueCents,
    totalCents: paidCents + upcomingCents + overdueCents,
  }
}

export interface TipInput {
  roomsUnderRatio: number
  /** Invoices more than 14 days past due with money still owed. */
  longOverdueCount: number
  longOverdueCents: number
  newEnquiries: number
  placesFree: number
  paymentsConnected: boolean
}

export interface SmartTip {
  title: string
  body: string
  href: string
  cta: string
  /** True when nothing needs doing — shown in a calmer style. */
  allClear: boolean
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

function euro(cents: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}

/** The single most useful next action, in priority order (safety → money → growth → setup). */
export function pickSmartTip(i: TipInput): SmartTip {
  if (i.roomsUnderRatio > 0) {
    return {
      title: `${plural(i.roomsUnderRatio, 'room')} need${i.roomsUnderRatio === 1 ? 's' : ''} more staff right now`,
      body: 'Move a team member across or update who is on duty so every room stays in ratio.',
      href: '/admin/ratios',
      cta: 'Review ratios',
      allClear: false,
    }
  }
  if (i.longOverdueCount > 0) {
    return {
      title: `${plural(i.longOverdueCount, 'invoice')} more than 14 days overdue`,
      body: `${euro(i.longOverdueCents)} is still owed. A friendly reminder usually gets it paid within the week.`,
      href: '/admin/arrears',
      cta: 'Send reminders',
      allClear: false,
    }
  }
  if (i.newEnquiries > 0 && i.placesFree > 0) {
    return {
      title: `${plural(i.placesFree, 'free place')} and ${plural(i.newEnquiries, 'new enquiry', 'new enquiries')}`,
      body: 'A quick reply to waiting families could fill your vacancies.',
      href: '/admin/enquiries',
      cta: 'Reply to enquiries',
      allClear: false,
    }
  }
  if (i.newEnquiries > 0) {
    return {
      title: `${plural(i.newEnquiries, 'new enquiry', 'new enquiries')} waiting`,
      body: 'Families are waiting to hear back — reply while they are still choosing.',
      href: '/admin/enquiries',
      cta: 'Reply to enquiries',
      allClear: false,
    }
  }
  if (!i.paymentsConnected) {
    return {
      title: 'Let parents pay online',
      body: 'Connect your own Stripe or Revolut account and parents can pay invoices by card from the parent app.',
      href: '/admin/payments/connect',
      cta: 'Set up payments',
      allClear: false,
    }
  }
  return {
    title: "You're all caught up 🎉",
    body: 'Nothing needs your attention right now.',
    href: '/admin/daily-records',
    cta: 'Record daily notes',
    allClear: true,
  }
}
