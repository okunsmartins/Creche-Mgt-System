import { describe, it, expect } from 'vitest'
import { validateSubdomain, provisionSchool } from '../provision'
import { hasProAccess } from '@/lib/subscriptions/access'
import { TRIAL_PERIOD_DAYS } from '@/lib/subscriptions/trial'

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

// ── provisionSchool → the new crèche's free trial actually grants access ──────

/** Minimal chainable fake of the Supabase admin client; records every insert. */
function fakeAdminClient() {
  const inserts: Record<string, unknown[]> = {}
  const result = (table: string, op: string) => {
    if (table === 'schools' && op === 'maybeSingle') return { data: null, error: null }
    if (table === 'roles') return { data: { id: 'role-admin' }, error: null }
    if (table === 'schools' && op === 'single') return { data: { id: 'school-new' }, error: null }
    return { data: null, error: null }
  }
  const builder = (table: string) => {
    const b: Record<string, unknown> = {
      select: () => b,
      eq: () => b,
      update: () => b,
      insert: (row: unknown) => {
        ;(inserts[table] ??= []).push(row)
        return b
      },
      maybeSingle: async () => result(table, 'maybeSingle'),
      single: async () => result(table, 'single'),
      then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
    }
    return b
  }
  return { client: { from: builder } as never, inserts }
}

describe('provisionSchool free trial', () => {
  it('gives a brand-new crèche a 30-day trial it can use straight away', async () => {
    const { client, inserts } = fakeAdminClient()
    const before = Date.now()
    const res = await provisionSchool(client, {
      name: 'Little Meadows',
      subdomain: 'littlemeadows',
      ownerProfileId: 'owner-1',
    })
    expect(res).toEqual({ ok: true, schoolId: 'school-new' })

    const sub = inserts['subscriptions']?.[0] as {
      plan: 'pro'
      status: 'trialing'
      trial_ends_at: string
    }
    expect(sub).toMatchObject({ school_id: 'school-new', plan: 'pro', status: 'trialing' })

    const days = (Date.parse(sub.trial_ends_at) - before) / 86_400_000
    expect(days).toBeGreaterThan(TRIAL_PERIOD_DAYS - 0.01)
    expect(days).toBeLessThan(TRIAL_PERIOD_DAYS + 0.01)

    const row = { ...sub, current_period_end: null }
    // Day one: full access. Day 31: locked → must subscribe.
    expect(hasProAccess(row)).toBe(true)
    expect(hasProAccess(row, new Date(Date.parse(sub.trial_ends_at) + 60_000))).toBe(false)
  })
})
