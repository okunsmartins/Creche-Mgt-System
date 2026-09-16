import { describe, it, expect } from 'vitest'
import { parseTenantSubdomain } from '../parse'

describe('parseTenantSubdomain', () => {
  it('extracts the subdomain from an apex tenant host', () => {
    expect(parseTenantSubdomain('stmarys.example.ie')).toBe('stmarys')
  })

  it('lowercases the subdomain', () => {
    expect(parseTenantSubdomain('StMarys.Example.IE')).toBe('stmarys')
  })

  it('strips the port', () => {
    expect(parseTenantSubdomain('stmarys.example.ie:443')).toBe('stmarys')
  })

  it('takes the first label for deeper hosts', () => {
    expect(parseTenantSubdomain('a.b.c.d')).toBe('a')
  })

  it('returns null for an apex domain (no subdomain)', () => {
    expect(parseTenantSubdomain('example.ie')).toBeNull()
  })

  it('returns null for www', () => {
    expect(parseTenantSubdomain('www.example.ie')).toBeNull()
  })

  it('returns null for localhost (with and without port)', () => {
    expect(parseTenantSubdomain('localhost')).toBeNull()
    expect(parseTenantSubdomain('localhost:3000')).toBeNull()
  })

  it('returns null for *.vercel.app preview/project URLs', () => {
    expect(parseTenantSubdomain('primary-school-payments-portal.vercel.app')).toBeNull()
    expect(parseTenantSubdomain('some-branch-xyz.vercel.app')).toBeNull()
  })

  it('returns null for empty / nullish input', () => {
    expect(parseTenantSubdomain('')).toBeNull()
    expect(parseTenantSubdomain(null)).toBeNull()
    expect(parseTenantSubdomain(undefined)).toBeNull()
  })
})
