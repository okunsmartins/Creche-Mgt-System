import { describe, it, expect } from 'vitest'
import { validateSubdomain } from '../provision'

describe('validateSubdomain', () => {
  it('accepts a valid subdomain and normalises case/whitespace', () => {
    expect(validateSubdomain('  StMarys  ')).toEqual({ ok: true, value: 'stmarys' })
    expect(validateSubdomain('st-marys-ns')).toEqual({ ok: true, value: 'st-marys-ns' })
    expect(validateSubdomain('school123')).toEqual({ ok: true, value: 'school123' })
  })

  it('rejects empty input', () => {
    expect(validateSubdomain('').ok).toBe(false)
    expect(validateSubdomain(null).ok).toBe(false)
    expect(validateSubdomain(undefined).ok).toBe(false)
  })

  it('enforces length bounds', () => {
    expect(validateSubdomain('ab').ok).toBe(false) // too short
    expect(validateSubdomain('a'.repeat(31)).ok).toBe(false) // too long
    expect(validateSubdomain('abc').ok).toBe(true)
    expect(validateSubdomain('a'.repeat(30)).ok).toBe(true)
  })

  it('rejects leading/trailing/double hyphens', () => {
    expect(validateSubdomain('-abc').ok).toBe(false)
    expect(validateSubdomain('abc-').ok).toBe(false)
    expect(validateSubdomain('ab--cd').ok).toBe(false)
  })

  it('rejects invalid characters', () => {
    expect(validateSubdomain('st_marys').ok).toBe(false) // underscore
    expect(validateSubdomain('st.marys').ok).toBe(false) // dot
    expect(validateSubdomain('st marys').ok).toBe(false) // space
    expect(validateSubdomain('stMárys').ok).toBe(false) // accent
  })

  it('rejects reserved subdomains', () => {
    for (const r of ['www', 'admin', 'api', 'app', 'schooldemo', 'demo', 'stripe', 'webhooks']) {
      expect(validateSubdomain(r).ok).toBe(false)
    }
  })

  it('rejects the path-tenancy reset keywords', () => {
    for (const r of ['reset', 'default', 'main']) {
      expect(validateSubdomain(r).ok).toBe(false)
    }
  })
})
