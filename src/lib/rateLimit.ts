// Simple sliding window rate limiter.
// In serverless deployments each instance maintains independent state.
// For cross-instance coordination, replace with Redis (e.g. Upstash).

const WINDOW_MS = 60_000
const MAX_REQUESTS = 10

const store = new Map<string, { count: number; windowStart: number }>()

export function checkRateLimit(key: string): { allowed: boolean } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    store.set(key, { count: 1, windowStart: now })
    return { allowed: true }
  }

  entry.count++
  return { allowed: entry.count <= MAX_REQUESTS }
}
