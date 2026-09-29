import { describe, it, expect } from 'vitest'
import { selectFeeReminders, type ReminderInvoice } from '../reminders'

const inv = (o: Partial<ReminderInvoice>): ReminderInvoice => ({
  invoiceId: 'i1',
  studentId: 's1',
  studentName: 'Child',
  netParentCents: 10000,
  amountPaidCents: 0,
  dueDate: '2026-09-29',
  status: 'issued',
  ...o,
})

const today = '2026-09-29'

describe('selectFeeReminders', () => {
  it('classifies due_today, due_soon (within window), and overdue', () => {
    const r = selectFeeReminders(
      [
        inv({ invoiceId: 'today', dueDate: '2026-09-29' }),
        inv({ invoiceId: 'soon', dueDate: '2026-10-01' }), // +2 days, within 3
        inv({ invoiceId: 'overdue', dueDate: '2026-09-20' }),
      ],
      today,
    )
    const byId = Object.fromEntries(r.map((x) => [x.invoiceId, x.kind]))
    expect(byId).toEqual({ today: 'due_today', soon: 'due_soon', overdue: 'overdue' })
  })

  it('ignores invoices due beyond the due-soon window', () => {
    const r = selectFeeReminders([inv({ dueDate: '2026-10-15' })], today) // +16 days
    expect(r).toEqual([])
  })

  it('skips fully paid, draft and void invoices', () => {
    const r = selectFeeReminders(
      [
        inv({ netParentCents: 10000, amountPaidCents: 10000 }), // paid
        inv({ status: 'draft' }),
        inv({ status: 'void' }),
      ],
      today,
    )
    expect(r).toEqual([])
  })

  it('respects remindOverdue=false', () => {
    const r = selectFeeReminders([inv({ dueDate: '2026-09-01' })], today, {
      dueSoonDays: 3,
      remindOverdue: false,
    })
    expect(r).toEqual([])
  })

  it('reports outstanding balance and days-until-due', () => {
    const r = selectFeeReminders(
      [
        inv({
          netParentCents: 10000,
          amountPaidCents: 4000,
          status: 'part_paid',
          dueDate: '2026-10-01',
        }),
      ],
      today,
    )
    expect(r[0]!.outstandingCents).toBe(6000)
    expect(r[0]!.daysUntilDue).toBe(2)
  })
})
