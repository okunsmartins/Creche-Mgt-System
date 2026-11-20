import { describe, it, expect } from 'vitest'
import { refundEventMatchesSchool } from '../event-account'

describe('refundEventMatchesSchool', () => {
  it('accepts an event from the crèche’s own connected account', () => {
    expect(refundEventMatchesSchool('acct_A', 'acct_A', true)).toBe(true)
    expect(refundEventMatchesSchool('acct_A', 'acct_A', false)).toBe(true)
  })
  it('rejects an event from a different connected account', () => {
    expect(refundEventMatchesSchool('acct_B', 'acct_A', true)).toBe(false)
    expect(refundEventMatchesSchool('acct_B', 'acct_A', false)).toBe(false)
  })
  it('fee refunds (strict): rejects platform-account events and crèches with no account', () => {
    expect(refundEventMatchesSchool(null, 'acct_A', true)).toBe(false)
    expect(refundEventMatchesSchool('acct_A', null, true)).toBe(false)
    expect(refundEventMatchesSchool(undefined, undefined, true)).toBe(false)
  })
  it('order refunds (lenient): only an explicit mismatch is rejected', () => {
    expect(refundEventMatchesSchool(null, 'acct_A', false)).toBe(true)
    expect(refundEventMatchesSchool('acct_A', null, false)).toBe(true)
  })
})
