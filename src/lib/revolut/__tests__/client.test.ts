// The Merchant API client must call the DATED endpoints (`<origin>/api/...`). The legacy
// `/api/1.0` endpoints reject API Console keys (r_test_/r_prod_) with 401, which broke
// "Pay with Revolut" live on 2026-11-24, so an old REVOLUT_API_BASE_URL ending in
// `/api/1.0` must still land on `/api`.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const env = vi.hoisted(() => ({
  revolutApiBaseUrl: 'https://sandbox-merchant.revolut.com/api/1.0',
  revolutApiKey: '',
}))
vi.mock('@/lib/env', () => ({ serverEnv: env }))
vi.mock('@/lib/logging', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { revolutPost, revolutGet, revolutMerchantApiBase, isRevolutSandbox } from '../client'

let urls: string[]
let headers: Record<string, string>[]
beforeEach(() => {
  urls = []
  headers = []
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      urls.push(url)
      headers.push(init.headers as Record<string, string>)
      return Promise.resolve(new Response(JSON.stringify({ id: 'o1', checkout_url: 'x' })))
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())

describe('Revolut Merchant API base', () => {
  it('an old /api/1.0 setting still calls the dated /api endpoints', async () => {
    env.revolutApiBaseUrl = 'https://sandbox-merchant.revolut.com/api/1.0'
    expect(revolutMerchantApiBase()).toBe('https://sandbox-merchant.revolut.com/api')
    await revolutPost('/orders', { amount: 100 }, 'r_test_k')
    await revolutGet('/orders/o1', 'r_test_k')
    await revolutPost('/orders/o1/refund', { amount: 50 }, 'r_test_k')
    expect(urls).toEqual([
      'https://sandbox-merchant.revolut.com/api/orders',
      'https://sandbox-merchant.revolut.com/api/orders/o1',
      'https://sandbox-merchant.revolut.com/api/orders/o1/refund',
    ])
  })

  it('production origin, any path form', () => {
    for (const v of [
      'https://merchant.revolut.com/api/1.0',
      'https://merchant.revolut.com/api',
      'https://merchant.revolut.com/',
    ]) {
      env.revolutApiBaseUrl = v
      expect(revolutMerchantApiBase()).toBe('https://merchant.revolut.com/api')
      expect(isRevolutSandbox()).toBe(false)
    }
  })

  it('every call pins the API version and uses the crèche key', async () => {
    env.revolutApiBaseUrl = 'https://sandbox-merchant.revolut.com/api'
    await revolutPost('/orders', {}, 'r_test_k')
    expect(headers[0]).toMatchObject({
      Authorization: 'Bearer r_test_k',
      'Revolut-Api-Version': '2024-09-01',
    })
  })
})
