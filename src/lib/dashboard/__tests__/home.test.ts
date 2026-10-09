import { describe, expect, it } from 'vitest'
import { daysBetween, monthFeeSplit, pickSmartTip, sameDayLastWeek, type TipInput } from '../home'

describe('daysBetween / sameDayLastWeek', () => {
  it('counts whole days across a month boundary', () => {
    expect(daysBetween('2026-09-28', '2026-10-09')).toBe(11)
    expect(daysBetween('2026-10-09', '2026-10-01')).toBe(-8)
  })
  it('returns the same weekday a week earlier', () => {
    expect(sameDayLastWeek('2026-10-09')).toBe('2026-10-02')
    expect(sameDayLastWeek('2026-03-03')).toBe('2026-02-24')
  })
})

describe('monthFeeSplit', () => {
  const today = '2026-10-15'
  it('splits this month into paid, upcoming and overdue; ignores other months, drafts and voids', () => {
    const r = monthFeeSplit(
      [
        { netParentCents: 20000, amountPaidCents: 20000, dueDate: '2026-10-01', status: 'paid' },
        {
          netParentCents: 20000,
          amountPaidCents: 5000,
          dueDate: '2026-10-07',
          status: 'part_paid',
        },
        { netParentCents: 10000, amountPaidCents: 0, dueDate: '2026-10-21', status: 'issued' },
        { netParentCents: 10000, amountPaidCents: 0, dueDate: '2026-10-15', status: 'issued' },
        { netParentCents: 99999, amountPaidCents: 0, dueDate: '2026-09-30', status: 'issued' },
        { netParentCents: 99999, amountPaidCents: 0, dueDate: '2026-10-10', status: 'draft' },
        { netParentCents: 99999, amountPaidCents: 0, dueDate: '2026-10-10', status: 'void' },
      ],
      today,
    )
    expect(r).toEqual({
      paidCents: 25000,
      upcomingCents: 20000, // due today counts as not yet overdue
      overdueCents: 15000,
      totalCents: 60000,
    })
  })
  it('caps overpayments at the invoice amount', () => {
    const r = monthFeeSplit(
      [{ netParentCents: 10000, amountPaidCents: 12000, dueDate: '2026-10-02', status: 'paid' }],
      today,
    )
    expect(r.paidCents).toBe(10000)
    expect(r.totalCents).toBe(10000)
  })
})

describe('pickSmartTip', () => {
  const calm: TipInput = {
    roomsUnderRatio: 0,
    longOverdueCount: 0,
    longOverdueCents: 0,
    newEnquiries: 0,
    placesFree: 0,
    paymentsConnected: true,
  }
  it('puts ratio safety first', () => {
    const t = pickSmartTip({ ...calm, roomsUnderRatio: 1, longOverdueCount: 3 })
    expect(t.href).toBe('/admin/ratios')
    expect(t.title).toBe('1 room needs more staff right now')
  })
  it('then long-overdue invoices', () => {
    const t = pickSmartTip({
      ...calm,
      longOverdueCount: 3,
      longOverdueCents: 62000,
      newEnquiries: 2,
    })
    expect(t.href).toBe('/admin/arrears')
    expect(t.title).toBe('3 invoices more than 14 days overdue')
    expect(t.body).toContain('€620')
  })
  it('then vacancies + enquiries, then enquiries alone', () => {
    expect(pickSmartTip({ ...calm, newEnquiries: 2, placesFree: 4 }).title).toBe(
      '4 free places and 2 new enquiries',
    )
    expect(pickSmartTip({ ...calm, newEnquiries: 1 }).title).toBe('1 new enquiry waiting')
  })
  it('then payment setup, else all clear', () => {
    expect(pickSmartTip({ ...calm, paymentsConnected: false }).href).toBe('/admin/payments/connect')
    const t = pickSmartTip(calm)
    expect(t.allClear).toBe(true)
  })
})
