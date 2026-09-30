import { describe, it, expect } from 'vitest'
import { occupancyByRoom, revenueByRoom, type RevenueInvoice } from '../commercial'

const rooms = [
  { id: 'r1', name: 'Toddler' },
  { id: 'r2', name: 'Preschool' },
  { id: 'r3', name: 'Baby' },
]

describe('occupancyByRoom', () => {
  it('counts enrolled and present per room, with utilisation %', () => {
    const s = occupancyByRoom(rooms, [
      { roomId: 'r1', present: true },
      { roomId: 'r1', present: false },
      { roomId: 'r2', present: true },
      { roomId: 'r2', present: true },
      { roomId: 'r3', present: false },
      { roomId: null, present: true }, // no room → ignored
    ])
    const r1 = s.rooms.find((r) => r.id === 'r1')!
    expect(r1.enrolled).toBe(2)
    expect(r1.present).toBe(1)
    expect(r1.utilisationPct).toBe(50)
    expect(s.rooms.find((r) => r.id === 'r2')!.utilisationPct).toBe(100)
    expect(s.rooms.find((r) => r.id === 'r3')!.utilisationPct).toBe(0) // enrolled 1, present 0
    expect(s.totalEnrolled).toBe(5)
    expect(s.totalPresent).toBe(3)
    expect(s.utilisationPct).toBe(60)
  })
  it('empty rooms and no children → 0%', () => {
    const s = occupancyByRoom(rooms, [])
    expect(s.totalEnrolled).toBe(0)
    expect(s.utilisationPct).toBe(0)
    expect(s.rooms.every((r) => r.utilisationPct === 0)).toBe(true)
  })
})

describe('revenueByRoom', () => {
  const inv = (o: Partial<RevenueInvoice>): RevenueInvoice => ({
    roomId: 'r1',
    netParentCents: 10000,
    amountPaidCents: 0,
    status: 'issued',
    ...o,
  })

  it('groups invoiced/paid/outstanding by room, excludes draft/void', () => {
    const s = revenueByRoom(rooms, [
      inv({ roomId: 'r1', netParentCents: 10000, amountPaidCents: 10000, status: 'paid' }),
      inv({ roomId: 'r1', netParentCents: 10000, amountPaidCents: 4000, status: 'part_paid' }),
      inv({ roomId: 'r2', netParentCents: 8000, amountPaidCents: 0, status: 'issued' }),
      inv({ roomId: 'r2', netParentCents: 9999, status: 'draft' }), // excluded
    ])
    const r1 = s.rooms.find((r) => r.id === 'r1')!
    expect(r1.invoicedCents).toBe(20000)
    expect(r1.paidCents).toBe(14000)
    expect(r1.outstandingCents).toBe(6000)
    expect(s.invoicedCents).toBe(28000)
    expect(s.paidCents).toBe(14000)
    expect(s.outstandingCents).toBe(6000 + 8000)
  })

  it('counts invoices with an unknown room as unassigned', () => {
    const s = revenueByRoom(rooms, [
      inv({ roomId: 'gone', netParentCents: 5000, status: 'issued' }),
    ])
    expect(s.unassignedCents).toBe(5000)
    expect(s.invoicedCents).toBe(0)
  })

  it('sorts rooms by invoiced, largest first', () => {
    const s = revenueByRoom(rooms, [
      inv({ roomId: 'r1', netParentCents: 1000 }),
      inv({ roomId: 'r2', netParentCents: 9000 }),
    ])
    expect(s.rooms[0]!.id).toBe('r2')
  })
})
