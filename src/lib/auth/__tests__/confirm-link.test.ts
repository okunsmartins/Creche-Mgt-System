import { describe, it, expect } from 'vitest'
import { parseConfirmLink, safeNextPath } from '../confirm-link'

const HASH = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c'

describe('safeNextPath', () => {
  it('keeps same-site relative paths', () => {
    expect(safeNextPath('/reset-password')).toBe('/reset-password')
    expect(safeNextPath('/parent/dashboard?x=1')).toBe('/parent/dashboard?x=1')
  })

  it('rejects anything that could leave the site', () => {
    for (const bad of ['https://evil.com', '//evil.com', '/\\evil.com', 'evil.com', '', '/a\nb']) {
      expect(safeNextPath(bad, '/fallback')).toBe('/fallback')
    }
    expect(safeNextPath(undefined, '/fallback')).toBe('/fallback')
    expect(safeNextPath(['/x'], '/fallback')).toBe('/fallback')
  })
})

describe('parseConfirmLink', () => {
  it('accepts a password-reset link and defaults to the set-password page', () => {
    expect(parseConfirmLink({ token_hash: HASH, type: 'recovery' })).toEqual({
      tokenHash: HASH,
      type: 'recovery',
      next: '/reset-password',
    })
  })

  it('honours a safe next and ignores an unsafe one', () => {
    expect(parseConfirmLink({ token_hash: HASH, type: 'email', next: '/onboarding' })?.next).toBe(
      '/onboarding',
    )
    expect(parseConfirmLink({ token_hash: HASH, type: 'recovery', next: '//evil.com' })?.next).toBe(
      '/reset-password',
    )
  })

  it('takes the first value when a param is repeated', () => {
    expect(parseConfirmLink({ token_hash: [HASH, 'x'], type: ['recovery'] })?.type).toBe('recovery')
  })

  it('rejects missing or malformed tokens and unknown types', () => {
    expect(parseConfirmLink({ type: 'recovery' })).toBeNull()
    expect(parseConfirmLink({ token_hash: 'short', type: 'recovery' })).toBeNull()
    expect(parseConfirmLink({ token_hash: `${HASH}<script>`, type: 'recovery' })).toBeNull()
    expect(parseConfirmLink({ token_hash: HASH, type: 'sms' })).toBeNull()
    expect(parseConfirmLink({ token_hash: HASH })).toBeNull()
  })
})
