// Connecting, replacing or disconnecting a crèche's Revolut account decides where
// parents' money goes, so each change is written to the crèche's audit log (who, when,
// what), and the key / signing secret never appear in it.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/logging', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/auth/guards', () => ({
  requireAdmin: vi.fn(async () => ({
    id: 'admin_1',
    email: 'admin@example.com',
    schoolId: 'sch_1',
  })),
}))
vi.mock('@/lib/crypto/secrets', () => ({
  isEncryptionConfigured: () => true,
  encryptSecret: (s: string) => `enc(${s.length})`,
}))
vi.mock('../client', () => ({ isRevolutSandbox: () => true }))

let existingKey: string | null = null
vi.mock('../perSchool', () => ({ resolveOwnRevolutApiKey: vi.fn(async () => existingKey) }))

let registerOk = true
vi.mock('../webhooks', () => ({
  registerRevolutWebhook: vi.fn(async () =>
    registerOk ? { ok: true, signingSecret: 'wsk_SECRET' } : { ok: false, reason: 'bad_key' },
  ),
  removeRevolutWebhooks: vi.fn(async () => 1),
}))

const audits: Record<string, unknown>[] = []
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseAdminClient: () => ({
    from: (table: string) => ({
      update: () => ({ eq: async () => ({ error: null }) }),
      insert: async (row: Record<string, unknown>) => {
        if (table === 'audit_logs') audits.push(row)
        return { error: null }
      },
    }),
  }),
}))

import { saveRevolutCredentialsAction, disconnectRevolutAction } from '../settingsActions'

function form(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

describe('Revolut settings audit trail', () => {
  beforeEach(() => {
    audits.length = 0
    existingKey = null
    registerOk = true
  })

  it('first connect is audited as "connected" with the automatic webhook', async () => {
    expect(await saveRevolutCredentialsAction(null, form({ apiKey: 'r_test_KEY123' }))).toEqual({
      success: true,
    })
    expect(audits).toHaveLength(1)
    expect(audits[0]).toMatchObject({
      school_id: 'sch_1',
      actor_id: 'admin_1',
      action: 'settings.updated',
      resource_type: 'school',
      metadata: { area: 'revolut', change: 'connected', mode: 'sandbox', webhook: 'automatic' },
    })
  })

  it('pasting a new key over an existing one is "key_replaced"', async () => {
    existingKey = 'r_test_OLD'
    await saveRevolutCredentialsAction(null, form({ apiKey: 'r_test_NEW' }))
    expect(audits[0]).toMatchObject({ metadata: { change: 'key_replaced' } })
  })

  it('disconnect is audited', async () => {
    existingKey = 'r_test_OLD'
    expect(await disconnectRevolutAction(null, form({}))).toEqual({ success: true })
    expect(audits[0]).toMatchObject({ metadata: { area: 'revolut', change: 'disconnected' } })
  })

  it('never writes the key or the signing secret to the audit log', async () => {
    await saveRevolutCredentialsAction(null, form({ apiKey: 'r_test_KEY123' }))
    const text = JSON.stringify(audits)
    expect(text).not.toContain('r_test_KEY123')
    expect(text).not.toContain('wsk_SECRET')
  })

  it('a rejected key changes nothing, so nothing is audited', async () => {
    registerOk = false
    const res = await saveRevolutCredentialsAction(null, form({ apiKey: 'r_test_BAD' }))
    expect(res?.error).toMatch(/didn.t accept that key/)
    expect(audits).toHaveLength(0)
  })
})
