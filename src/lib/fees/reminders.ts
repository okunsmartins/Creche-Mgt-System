// FEE-10: fee-reminder SELECTION (the "magic wand" — no weekly manual chasing).
// Pure + unit-tested. Decides which issued/part-paid invoices need a reminder today
// and of what kind. Sending (email/SMS) and once-per-state idempotency are handled
// by the caller (a scheduled job + a reminders log) — this module only decides WHO.

export interface ReminderInvoice {
  invoiceId: string
  studentId: string
  studentName: string
  netParentCents: number
  amountPaidCents: number
  dueDate: string // YYYY-MM-DD
  status: string
}

export type ReminderKind = 'due_soon' | 'due_today' | 'overdue'

export interface FeeReminder {
  invoiceId: string
  studentId: string
  studentName: string
  kind: ReminderKind
  outstandingCents: number
  dueDate: string
  /** Whole days until due (negative = overdue). */
  daysUntilDue: number
}

export interface ReminderConfig {
  /** Remind this many days before the due date (e.g. 3). */
  dueSoonDays: number
  /** Also remind while overdue. When false, only due-soon/due-today fire. */
  remindOverdue: boolean
}

export const DEFAULT_REMINDER_CONFIG: ReminderConfig = { dueSoonDays: 3, remindOverdue: true }

const OWING = new Set(['issued', 'part_paid'])

const MS_PER_DAY = 86_400_000
function daysBetween(fromISO: string, toISO: string): number {
  const a = Date.parse(`${fromISO}T00:00:00Z`)
  const b = Date.parse(`${toISO}T00:00:00Z`)
  return Math.round((b - a) / MS_PER_DAY)
}

/**
 * Which invoices need a reminder as of `todayISO`. An invoice qualifies when it's
 * issued/part-paid with an outstanding balance and either due within `dueSoonDays`
 * (or today), or overdue (when `remindOverdue`). Fully paid, draft and void invoices
 * are ignored.
 */
export function selectFeeReminders(
  invoices: ReadonlyArray<ReminderInvoice>,
  todayISO: string,
  config: ReminderConfig = DEFAULT_REMINDER_CONFIG,
): FeeReminder[] {
  const out: FeeReminder[] = []
  for (const inv of invoices) {
    if (!OWING.has(inv.status)) continue
    const outstanding = Math.max(0, inv.netParentCents - inv.amountPaidCents)
    if (outstanding === 0) continue

    const daysUntilDue = daysBetween(todayISO, inv.dueDate)
    let kind: ReminderKind | null = null
    if (daysUntilDue < 0) {
      if (config.remindOverdue) kind = 'overdue'
    } else if (daysUntilDue === 0) {
      kind = 'due_today'
    } else if (daysUntilDue <= config.dueSoonDays) {
      kind = 'due_soon'
    }
    if (!kind) continue

    out.push({
      invoiceId: inv.invoiceId,
      studentId: inv.studentId,
      studentName: inv.studentName,
      kind,
      outstandingCents: outstanding,
      dueDate: inv.dueDate,
      daysUntilDue,
    })
  }
  return out
}
