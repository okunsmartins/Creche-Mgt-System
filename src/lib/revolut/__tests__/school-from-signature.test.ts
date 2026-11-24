// schoolIdFromWebhookSignature: when a webhook's reference can't name the crèche (the
// dated Revolut API drops merchant_order_ext_ref), the crèche is the one whose OWN
// signing secret verifies the body. Nothing the sender controls can pick the crèche.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'node:crypto'

vi.mock('@/lib/logging', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/env', () => ({ serverEnv: { revolutApiKey: '', revolutWebhookSecret: '' } }))

let rows: { id: string; revolut_webhook_secret_enc: string | null }[] = []
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({ select: () => ({ not: async () => ({ data: rows }) }) }),
  }),
}))

import { encryptSecret } from '@/lib/crypto/secrets'
import { verifyRevolutSignature } from '../signature'
import { schoolIdFromWebhookSignature } from '../perSchool'

const body = '{"event":"ORDER_COMPLETED","order_id":"o1"}'
const ts = String(Date.now())
const sign = (secret: string) =>
  'v1=' + createHmac('sha256', secret).update(`v1.${ts}.${body}`).digest('hex')
const verifierFor = (signature: string) => (secret: string) =>
  verifyRevolutSignature({ rawBody: body, signatureHeader: signature, timestampHeader: ts, secret })

describe('schoolIdFromWebhookSignature', () => {
  beforeEach(() => {
    process.env['ENCRYPTION_KEY'] = 'test-encryption-key'
    rows = [
      { id: 'school_a', revolut_webhook_secret_enc: encryptSecret('wsk_a') },
      { id: 'school_b', revolut_webhook_secret_enc: encryptSecret('wsk_b') },
      { id: 'school_broken', revolut_webhook_secret_enc: 'not-a-ciphertext' },
    ]
  })

  it('returns the crèche whose secret signed the webhook', async () => {
    expect(await schoolIdFromWebhookSignature(verifierFor(sign('wsk_b')))).toMatchObject({
      schoolId: 'school_b',
    })
    expect(await schoolIdFromWebhookSignature(verifierFor(sign('wsk_a')))).toMatchObject({
      schoolId: 'school_a',
    })
  })

  it('a forged signature matches no crèche', async () => {
    expect(await schoolIdFromWebhookSignature(verifierFor(sign('attacker')))).toEqual({
      schoolId: null,
      secretsChecked: 2, // the unreadable secret is skipped, never matched
    })
  })

  it('no crèche has Revolut connected → nothing checked', async () => {
    rows = []
    expect(await schoolIdFromWebhookSignature(verifierFor(sign('wsk_a')))).toEqual({
      schoolId: null,
      secretsChecked: 0,
    })
  })
})
