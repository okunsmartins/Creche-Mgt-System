import { describe, it, expect } from 'vitest'
import { statusLabel, ordersByStatus, paidByMonth, collectedByDay } from '../aggregate'

describe('statusLabel', () => {
  it('maps known statuses to friendly labels', () => {
    expect(statusLabel('paid')).toBe('Paid')
    expect(statusLabel('partially_refunded')).toBe('Part. refunded')
    expect(statusLabel('pending_payment')).toBe('Pending')
  })

  it('falls back to a de-underscored label for unknown statuses', () => {
    expect(statusLabel('some_new_status')).toBe('some new status')
  })
})

describe('ordersByStatus', () => {
  it('counts orders per status, most common first', () => {
    const result = ordersByStatus([
      { status: 'paid' },
      { status: 'pending_payment' },
      { status: 'paid' },
      { status: 'paid' },
    ])
    expect(result).toEqual([
      { label: 'Paid', value: 3 },
      { label: 'Pending', value: 1 },
    ])
  })

  it('returns an empty array for no orders', () => {
    expect(ordersByStatus([])).toEqual([])
  })
})

describe('collectedByDay', () => {
  it('returns one bucket per day and sums an order created today into the last bucket', () => {
    const today = new Date().toISOString()
    const result = collectedByDay([{ total_cents: 500, created_at: today }], 7)
    expect(result).toHaveLength(7)
    expect(result[result.length - 1]!.value).toBe(500)
    // Days outside today stay zero.
    expect(result.slice(0, -1).every((d) => d.value === 0)).toBe(true)
  })

  it('ignores orders older than the window', () => {
    const old = new Date('2000-01-01').toISOString()
    const result = collectedByDay([{ total_cents: 999, created_at: old }], 7)
    expect(result.every((d) => d.value === 0)).toBe(true)
  })
})

describe('paidByMonth', () => {
  it('returns one bucket per month and sums this month into the last bucket', () => {
    const now = new Date().toISOString()
    const result = paidByMonth([{ amount_paid_cents: 1200, created_at: now }], 6)
    expect(result).toHaveLength(6)
    expect(result[result.length - 1]!.value).toBe(1200)
  })
})
