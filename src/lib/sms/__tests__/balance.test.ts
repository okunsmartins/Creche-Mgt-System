import { describe, it, expect } from 'vitest'
import { loadSmsBalanceView } from '../balance'
import { periodStartOf } from '../credits'

type BalanceRow = {
  included_limit: number
  included_used: number
  period_start: string
  credits: number
  credits_expire_at: string | null
}

// Minimal chainable stand-in: from().select().eq().maybeSingle() → { data }.
function mockAdmin(row: BalanceRow | null) {
  const chain = {
    from: () => chain,
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: row }),
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return chain as any
}

const thisMonth = periodStartOf(new Date())

describe('loadSmsBalanceView', () => {
  it('returns the default allowance when no row exists', async () => {
    const view = await loadSmsBalanceView(mockAdmin(null), 'school_1')
    expect(view).toEqual({
      allowanceLimit: 500,
      allowanceRemaining: 500,
      credits: 0,
      creditsExpireAt: null,
    })
  })

  it('reports remaining allowance within the current period', async () => {
    const view = await loadSmsBalanceView(
      mockAdmin({
        included_limit: 100,
        included_used: 30,
        period_start: thisMonth,
        credits: 50,
        credits_expire_at: '2999-01-01',
      }),
      'school_1',
    )
    expect(view.allowanceRemaining).toBe(70)
    expect(view.credits).toBe(50)
    expect(view.creditsExpireAt).toBe('2999-01-01')
  })

  it('treats a stale period as reset (full allowance) without writing', async () => {
    const view = await loadSmsBalanceView(
      mockAdmin({
        included_limit: 100,
        included_used: 90,
        period_start: '2000-01-01',
        credits: 0,
        credits_expire_at: null,
      }),
      'school_1',
    )
    expect(view.allowanceRemaining).toBe(100)
  })

  it('zeroes out expired credits for display', async () => {
    const view = await loadSmsBalanceView(
      mockAdmin({
        included_limit: 100,
        included_used: 0,
        period_start: thisMonth,
        credits: 40,
        credits_expire_at: '2000-01-01',
      }),
      'school_1',
    )
    expect(view.credits).toBe(0)
    expect(view.creditsExpireAt).toBeNull()
  })

  it('never reports negative remaining allowance', async () => {
    const view = await loadSmsBalanceView(
      mockAdmin({
        included_limit: 100,
        included_used: 130,
        period_start: thisMonth,
        credits: 0,
        credits_expire_at: null,
      }),
      'school_1',
    )
    expect(view.allowanceRemaining).toBe(0)
  })
})
