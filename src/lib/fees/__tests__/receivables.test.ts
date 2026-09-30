import { describe, it, expect } from 'vitest'
import { summariseProviderReceivables, type ReceivableInvoice } from '../receivables'

const inv = (o: Partial<ReceivableInvoice>): ReceivableInvoice => ({
  studentId: 'a',
  studentName: 'Child A',
  providerReceivableEcceCents: 6900,
  providerReceivableNcsCents: 8560,
  status: 'issued',
  ...o,
})

describe('summariseProviderReceivables', () => {
  it('sums ECCE + NCS per child and overall', () => {
    const s = summariseProviderReceivables([
      inv({ studentId: 'a' }),
      inv({ studentId: 'a' }),
      inv({ studentId: 'b', providerReceivableEcceCents: 6900, providerReceivableNcsCents: 0 }),
    ])
    expect(s.totalEcceCents).toBe(6900 * 3)
    expect(s.totalNcsCents).toBe(8560 * 2)
    expect(s.totalCents).toBe(6900 * 3 + 8560 * 2)
    const a = s.byChild.find((c) => c.studentId === 'a')!
    expect(a.ecceCents).toBe(13800)
    expect(a.ncsCents).toBe(17120)
    expect(a.invoiceCount).toBe(2)
  })

  it('excludes draft and void; includes issued/part_paid/paid', () => {
    const s = summariseProviderReceivables([
      inv({ status: 'draft' }),
      inv({ status: 'void' }),
      inv({ status: 'paid' }),
    ])
    expect(s.totalCents).toBe(6900 + 8560) // only the paid one
  })

  it('skips invoices with zero receivables (private-pay children)', () => {
    const s = summariseProviderReceivables([
      inv({ providerReceivableEcceCents: 0, providerReceivableNcsCents: 0 }),
    ])
    expect(s.byChild).toEqual([])
    expect(s.totalCents).toBe(0)
  })

  it('sorts children by total receivable, largest first', () => {
    const s = summariseProviderReceivables([
      inv({
        studentId: 'a',
        studentName: 'A',
        providerReceivableEcceCents: 1000,
        providerReceivableNcsCents: 0,
      }),
      inv({
        studentId: 'b',
        studentName: 'B',
        providerReceivableEcceCents: 5000,
        providerReceivableNcsCents: 0,
      }),
    ])
    expect(s.byChild.map((c) => c.studentId)).toEqual(['b', 'a'])
  })
})
