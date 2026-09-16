import { describe, it, expect } from 'vitest'
import { schoolPublicOrigin, schoolPayLinkUrl } from '../urls'

const APP = 'https://skoolbido.com'

describe('schoolPublicOrigin', () => {
  it('returns the apex origin', () => {
    expect(schoolPublicOrigin(APP)).toBe('https://skoolbido.com')
  })

  it('strips a trailing slash', () => {
    expect(schoolPublicOrigin('https://skoolbido.com/')).toBe('https://skoolbido.com')
  })

  it('preserves the http scheme (e.g. local dev)', () => {
    expect(schoolPublicOrigin('http://localhost:3000')).toBe('http://localhost:3000')
  })
})

describe('schoolPayLinkUrl', () => {
  it('builds an apex pay-by-link URL (Aladdin-style)', () => {
    expect(schoolPayLinkUrl(APP, 'abc123')).toBe('https://skoolbido.com/pay/abc123')
  })
})
