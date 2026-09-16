import { describe, it, expect, vi } from 'vitest'

// serverEnv validates env vars at import; mock it so the helper is testable in
// isolation without a full env. Values mirror the real shape.
vi.mock('@/lib/env', () => ({
  serverEnv: {
    emailFromName: 'Skool Bido',
    emailFromAddress: 'noreply@send.skoolbido.com',
  },
}))

import { buildEmailFrom, formatEmailFrom } from '../from'

describe('formatEmailFrom', () => {
  it('quotes the display name and appends the angle-bracketed address', () => {
    expect(formatEmailFrom('St Peters NS', 'noreply@send.skoolbido.com')).toBe(
      '"St Peters NS" <noreply@send.skoolbido.com>',
    )
  })

  it('keeps commas inside the quoted display name (no header split)', () => {
    // An unquoted comma would be read as an address separator by mail clients.
    expect(formatEmailFrom('St. Mary’s, Blackrock', 'a@b.com')).toBe(
      '"St. Mary’s, Blackrock" <a@b.com>',
    )
  })

  it('escapes embedded double-quotes and backslashes', () => {
    expect(formatEmailFrom('The "Big" School\\Annex', 'a@b.com')).toBe(
      '"The \\"Big\\" School\\\\Annex" <a@b.com>',
    )
  })

  it('strips CR/LF/control chars so the name cannot split or inject headers', () => {
    expect(formatEmailFrom('Evil\r\nBcc: victim@x.com', 'a@b.com')).toBe(
      '"Evil Bcc: victim@x.com" <a@b.com>',
    )
    expect(formatEmailFrom('Tabbed\tName', 'a@b.com')).toBe('"Tabbed Name" <a@b.com>')
  })

  it('preserves hyphens (does not treat them as separators)', () => {
    expect(formatEmailFrom("St Peter's-on-the-Hill", 'a@b.com')).toBe(
      '"St Peter\'s-on-the-Hill" <a@b.com>',
    )
  })
})

describe('buildEmailFrom', () => {
  it('uses the school name as the sender when provided (per-tenant)', () => {
    expect(buildEmailFrom('St Peters NS')).toBe('"St Peters NS" <noreply@send.skoolbido.com>')
  })

  it('falls back to EMAIL_FROM_NAME when no school name is given', () => {
    expect(buildEmailFrom()).toBe('"Skool Bido" <noreply@send.skoolbido.com>')
    expect(buildEmailFrom(null)).toBe('"Skool Bido" <noreply@send.skoolbido.com>')
  })

  it('falls back when the school name is blank or whitespace-only', () => {
    expect(buildEmailFrom('   ')).toBe('"Skool Bido" <noreply@send.skoolbido.com>')
  })

  it('trims surrounding whitespace from the school name', () => {
    expect(buildEmailFrom('  St Peters NS  ')).toBe('"St Peters NS" <noreply@send.skoolbido.com>')
  })
})
