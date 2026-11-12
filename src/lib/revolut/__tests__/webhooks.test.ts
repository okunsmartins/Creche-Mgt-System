import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/env', () => ({
  serverEnv: {
    appUrl: 'https://crechewise.com',
    revolutApiBaseUrl: 'https://sandbox-merchant.revolut.com/api/1.0',
    revolutApiKey: '',
  },
}))
vi.mock('@/lib/logging', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import {
  registerRevolutWebhook,
  removeRevolutWebhooks,
  revolutWebhookUrl,
  REVOLUT_WEBHOOK_EVENTS,
} from '../webhooks'

type Call = { method: string; url: string; body?: unknown; auth?: string | undefined }
let calls: Call[]
let existing: { id: string; url: string }[]
let failWith: number | null

function respond(status: number, body: unknown) {
  return Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status }))
}

beforeEach(() => {
  calls = []
  existing = []
  failWith = null
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>
      calls.push({
        method: init.method ?? 'GET',
        url,
        body: init.body ? JSON.parse(init.body as string) : undefined,
        auth: headers.Authorization,
      })
      if (failWith) return respond(failWith, { message: 'nope' })
      if (init.method === 'GET') return respond(200, existing)
      if (init.method === 'DELETE') return respond(204, undefined)
      return respond(200, {
        id: 'wh_new',
        url: revolutWebhookUrl(),
        events: REVOLUT_WEBHOOK_EVENTS,
        signing_secret: 'wsk_secret123',
      })
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())

describe('registerRevolutWebhook', () => {
  it('creates our webhook on the crèche account and returns the signing secret', async () => {
    const r = await registerRevolutWebhook('sk_crèche')
    expect(r).toEqual({ ok: true, signingSecret: 'wsk_secret123' })
    const post = calls.find((c) => c.method === 'POST')!
    expect(post.url).toBe('https://sandbox-merchant.revolut.com/api/webhooks')
    expect(post.auth).toBe('Bearer sk_crèche')
    expect(post.body).toEqual({
      url: 'https://crechewise.com/api/webhooks/revolut',
      events: [...REVOLUT_WEBHOOK_EVENTS],
    })
  })

  it('replaces an existing Creche Wise webhook instead of adding a duplicate', async () => {
    existing = [
      { id: 'wh_old', url: 'https://crechewise.com/api/webhooks/revolut' },
      { id: 'wh_other', url: 'https://some-other-shop.ie/hook' },
    ]
    await registerRevolutWebhook('sk_x')
    const deletes = calls.filter((c) => c.method === 'DELETE').map((c) => c.url)
    expect(deletes).toEqual(['https://sandbox-merchant.revolut.com/api/webhooks/wh_old'])
  })

  it('reports a rejected key', async () => {
    failWith = 401
    expect(await registerRevolutWebhook('sk_bad')).toEqual({ ok: false, reason: 'bad_key' })
  })

  it('reports the 10-webhook limit', async () => {
    existing = []
    vi.mocked(fetch).mockImplementation((_url, init) =>
      init?.method === 'POST' ? respond(422, { message: 'limit' }) : respond(200, []),
    )
    expect(await registerRevolutWebhook('sk_x')).toEqual({ ok: false, reason: 'too_many' })
  })

  it('fails safely when Revolut returns no signing secret', async () => {
    vi.mocked(fetch).mockImplementation((_url, init) =>
      init?.method === 'POST' ? respond(200, { id: 'wh' }) : respond(200, []),
    )
    expect(await registerRevolutWebhook('sk_x')).toEqual({ ok: false, reason: 'failed' })
  })
})

describe('removeRevolutWebhooks', () => {
  it('removes only our webhooks and never throws', async () => {
    existing = [{ id: 'a', url: 'https://crechewise.com/api/webhooks/revolut' }]
    expect(await removeRevolutWebhooks('sk_x')).toBe(1)
    failWith = 500
    expect(await removeRevolutWebhooks('sk_x')).toBe(0)
  })
})
