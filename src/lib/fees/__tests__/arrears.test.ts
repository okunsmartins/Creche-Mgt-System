import { describe, it, expect } from 'vitest'
import { summariseArrears, type ArrearsInvoice } from '../arrears'

const inv = (o: Partial<ArrearsInvoice>): ArrearsInvoice => ({
  studentId: 'a',
  studentName: 'Child A',
  netParentCents: 10000,
  amountPaidCents: 0,
  dueDate: '2026-09-01',
  status: 'issued',
  ...o,
})

describe('summariseArrears', () => {
  const today = '2026-09-29'

  it('sums outstanding and flags overdue by due date', () => {
    const s = summariseArrears(
      [
        inv({ studentId: 'a', dueDate: '2026-09-01' }), // overdue, 10000
        inv({ studentId: 'a', dueDate: '2026-10-15' }), // future, 10000 outstanding not overdue
      ],
      today,
    )
    expect(s.totalOutstandingCents).toBe(20000)
    expect(s.overdueCents).toBe(10000)
    expect(s.childrenInArrears).toBe(1)
    expect(s.byChild[0]!.oldestDueDate).toBe('2026-09-01')
    expect(s.byChild[0]!.invoiceCount).toBe(2)
  })

  it('subtracts payments; a fully paid invoice is excluded', () => {
    const s = summariseArrears(
      [
        inv({ netParentCents: 10000, amountPaidCents: 4000, status: 'part_paid' }), // owes 6000
        inv({ netParentCents: 10000, amountPaidCents: 10000, status: 'paid' }), // paid → excluded
      ],
      today,
    )
    expect(s.totalOutstandingCents).toBe(6000)
  })

  it('ignores draft and void invoices', () => {
    const s = summariseArrears([inv({ status: 'draft' }), inv({ status: 'void' })], today)
    expect(s.totalOutstandingCents).toBe(0)
    expect(s.childrenInArrears).toBe(0)
  })

  it('sorts children by outstanding, largest first', () => {
    const s = summariseArrears(
      [
        inv({ studentId: 'a', studentName: 'A', netParentCents: 5000 }),
        inv({ studentId: 'b', studentName: 'B', netParentCents: 9000 }),
      ],
      today,
    )
    expect(s.byChild.map((c) => c.studentId)).toEqual(['b', 'a'])
  })

  it('empty input → zeroes', () => {
    const s = summariseArrears([], today)
    expect(s).toEqual({
      totalOutstandingCents: 0,
      overdueCents: 0,
      childrenInArrears: 0,
      byChild: [],
    })
  })
})
