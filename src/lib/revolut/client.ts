import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logging'

/**
 * Revolut Merchant API client (server-only).
 *
 * Auth is a Bearer secret key; every request must pin an API version via the
 * `Revolut-Api-Version` header (Revolut dates their API — this value is stable
 * and independent of the sandbox/production base URL).
 *
 * The key is optional in env until credentials are provisioned, so callers must
 * gate on `isRevolutConfigured()` before using the API — the payment-method
 * selector and webhook are inert while it is false.
 */

// Revolut's dated API version. Bump deliberately when adopting new fields.
const REVOLUT_API_VERSION = '2024-09-01'

export function isRevolutConfigured(): boolean {
  return serverEnv.revolutApiKey.length > 0
}

export class RevolutApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message)
    this.name = 'RevolutApiError'
  }
}

function baseUrl(): string {
  // Trim a trailing slash so path joins are predictable.
  return serverEnv.revolutApiBaseUrl.replace(/\/+$/, '')
}

/**
 * POST to a Merchant API endpoint (e.g. '/orders'). Returns parsed JSON.
 * Throws RevolutApiError on non-2xx so callers can log and fail closed.
 */
export async function revolutPost<T>(path: string, payload: unknown, apiKey?: string): Promise<T> {
  // A per-school key (Connect-style) takes precedence; otherwise the platform key.
  const key = apiKey || serverEnv.revolutApiKey
  if (!key) {
    throw new RevolutApiError('Revolut is not configured', 0, '')
  }
  const url = `${baseUrl()}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Revolut-Api-Version': REVOLUT_API_VERSION,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
    // Never cache money operations.
    cache: 'no-store',
  })

  const text = await res.text()
  if (!res.ok) {
    // Body may contain a Revolut error code — log it but do not leak to clients.
    logger.error('revolut_api_error', { path, status: res.status })
    throw new RevolutApiError(`Revolut API ${res.status} for ${path}`, res.status, text)
  }
  return (text ? JSON.parse(text) : {}) as T
}

/** GET a Merchant API endpoint (e.g. `/orders/{id}`). */
export async function revolutGet<T>(path: string, apiKey?: string): Promise<T> {
  const key = apiKey || serverEnv.revolutApiKey
  if (!key) {
    throw new RevolutApiError('Revolut is not configured', 0, '')
  }
  const url = `${baseUrl()}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${key}`,
      'Revolut-Api-Version': REVOLUT_API_VERSION,
      Accept: 'application/json',
    },
    cache: 'no-store',
  })
  const text = await res.text()
  if (!res.ok) {
    logger.error('revolut_api_error', { path, status: res.status })
    throw new RevolutApiError(`Revolut API ${res.status} for ${path}`, res.status, text)
  }
  return (text ? JSON.parse(text) : {}) as T
}

/** True when the platform talks to Revolut's SANDBOX (test mode), from the base URL. */
export function isRevolutSandbox(): boolean {
  return /sandbox/i.test(serverEnv.revolutApiBaseUrl)
}

/** Scheme + host of the Merchant API (sandbox or production), e.g. https://merchant.revolut.com */
export function revolutApiOrigin(): string {
  return new URL(serverEnv.revolutApiBaseUrl).origin
}

/**
 * Call a dated Merchant API endpoint by its path from the API origin, e.g.
 * `/api/webhooks`. Used where the current (non-1.0) API is needed. An explicit
 * key is required — these calls always act on a crèche's own account.
 */
export async function revolutRequest<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  apiKey: string,
  body?: unknown,
): Promise<T> {
  if (!apiKey) throw new RevolutApiError('Revolut is not configured', 0, '')
  const res = await fetch(`${revolutApiOrigin()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Revolut-Api-Version': REVOLUT_API_VERSION,
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  })
  const text = await res.text()
  if (!res.ok) {
    logger.error('revolut_api_error', { path, status: res.status })
    throw new RevolutApiError(`Revolut API ${res.status} for ${path}`, res.status, text)
  }
  return (text ? JSON.parse(text) : {}) as T
}
