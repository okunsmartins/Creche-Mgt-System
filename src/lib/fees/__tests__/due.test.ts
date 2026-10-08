import { describe, it, expect } from 'vitest'
import { summariseDue, endOfWeekISO, endOfMonthISO, endOfYearISO, type DueInvoice } from '../due'

const base: Omit<DueInvoice, 'invoiceId' | 'dueDate' | 'netParentCents' | 'amountPaidCents'> = {
  studentId: 's1',
  studentName: 'Ava Byrne',
  invoiceNumber: 'INV-1',
  status: 'issued',
}

function inv(
  id: string,
  dueDate: string,
  net: number,
  paid = 0,
  over?: Partial<DueInvoice>,
): DueInvoice {
  return { ...base, invoiceId: id, dueDate, netParentCents: net, amountPaidCents: paid, ...over }
}

describe('period end helpers', () => {
  it('endOfWeek is the coming Sunday (Monday-first week)', () => {
    expect(endOfWeekISO('2026-10-08')).toBe('2026-10-11') // Thu → Sun 11th
    expect(endOfWeekISO('2026-10-11')).toBe('2026-10-11') // Sunday → itself
    expect(endOfWeekISO('2026-10-12')).toBe('2026-10-18') // Mon → next Sun
  })
  it('endOfMonth and endOfYear', () => {
    expect(endOfMonthISO('2026-10-08')).toBe('2026-10-31')
    expect(endOfMonthISO('2026-02-10')).toBe('2026-02-28')
    expect(endOfYearISO('2026-10-08')).toBe('2026-12-31')
  })
})

describe('summariseDue', () => {
  const today = '2026-10-08' // Thursday

  it('classifies each invoice into its tightest bucket', () => {
    const { items } = summariseDue(
      [
        inv('a', '2026-10-01', 5000), // overdue
        inv('b', '2026-10-08', 6000), // today
        inv('c', '2026-10-10', 7000), // this week (<= Sun 11th)
        inv('d', '2026-10-20', 8000), // this month
        inv('e', '2026-12-01', 9000), // this year
        inv('f', '2027-03-01', 1000), // later
      ],
      today,
    )
    const byId = Object.fromEntries(items.map((i) => [i.invoiceId, i.bucket]))
    expect(byId).toEqual({ a: 'overdue', b: 'today', c: 'week', d: 'month', e: 'year', f: 'later' })
  })

  it('totals are cumulative horizons from today; overdue separate', () => {
    const { totals } = summariseDue(
      [
        inv('a', '2026-10-01', 5000), // overdue
        inv('b', '2026-10-08', 6000), // today
        inv('c', '2026-10-10', 7000), // week
        inv('d', '2026-10-20', 8000), // month
        inv('e', '2026-12-01', 9000), // year
        inv('f', '2027-03-01', 1000), // later (excluded from year horizon)
      ],
      today,
    )
    expect(totals.overdueCents).toBe(5000)
    expect(totals.todayCents).toBe(6000)
    expect(totals.weekCents).toBe(6000 + 7000)
    expect(totals.monthCents).toBe(6000 + 7000 + 8000)
    expect(totals.yearCents).toBe(6000 + 7000 + 8000 + 9000)
    expect(totals.childrenCount).toBe(1)
  })

  it('nets paid amounts and skips fully paid / non-owing statuses', () => {
    const { items, totals } = summariseDue(
      [
        inv('a', '2026-10-08', 10000, 4000), // 6000 outstanding, today
        inv('b', '2026-10-08', 5000, 5000), // fully paid → skipped
        inv('c', '2026-10-08', 5000, 0, { status: 'draft' }), // draft → skipped
        inv('d', '2026-10-08', 5000, 0, { status: 'paid' }), // paid → skipped
      ],
      today,
    )
    expect(items).toHaveLength(1)
    expect(items[0]?.outstandingCents).toBe(6000)
    expect(totals.todayCents).toBe(6000)
  })

  it('counts distinct children in arrears', () => {
    const { totals } = summariseDue(
      [
        inv('a', '2026-10-08', 1000, 0, { studentId: 's1' }),
        inv('b', '2026-10-09', 1000, 0, { studentId: 's2' }),
        inv('c', '2026-10-10', 1000, 0, { studentId: 's1' }),
      ],
      today,
    )
    expect(totals.childrenCount).toBe(2)
  })
})
