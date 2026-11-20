import { describe, it, expect } from 'vitest'
import { schoolPublicOrigin, schoolPayLinkUrl, crechePublicPath } from '../urls'

const APP = 'https://crechewise.com'

describe('schoolPublicOrigin', () => {
  it('returns the apex origin', () => {
    expect(schoolPublicOrigin(APP)).toBe('https://crechewise.com')
  })

  it('strips a trailing slash', () => {
    expect(schoolPublicOrigin('https://crechewise.com/')).toBe('https://crechewise.com')
  })

  it('preserves the http scheme (e.g. local dev)', () => {
    expect(schoolPublicOrigin('http://localhost:3000')).toBe('http://localhost:3000')
  })
})

describe('schoolPayLinkUrl', () => {
  it('builds an apex pay-by-link URL (Aladdin-style)', () => {
    expect(schoolPayLinkUrl(APP, 'abc123')).toBe('https://crechewise.com/pay/abc123')
  })
})

describe('crechePublicPath', () => {
  it("is the crèche's /s/<subdomain> page", () => {
    expect(crechePublicPath('angelsnest')).toBe('/s/angelsnest')
  })
  it('falls back to the main site when there is no subdomain', () => {
    expect(crechePublicPath(null)).toBe('/')
    expect(crechePublicPath('')).toBe('/')
  })
})
