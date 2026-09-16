import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Verify a Revolut webhook signature.
 *
 * Revolut signs the payload as `v1.{timestamp}.{raw_body}` with HMAC-SHA256
 * keyed by the endpoint's signing secret, and sends:
 *   - `Revolut-Signature`: one or more `v1=<hex>` values (comma/space separated
 *     during secret rotation — any match is valid)
 *   - `Revolut-Request-Timestamp`: the timestamp used in the signed string
 *
 * We recompute the HMAC over the EXACT raw request body (never a re-serialised
 * object) and compare in constant time. Optionally reject stale timestamps to
 * blunt replay attacks.
 *
 * Returns true only when a provided signature matches. Fails closed on any
 * missing input.
 */
export function verifyRevolutSignature(params: {
  rawBody: string
  signatureHeader: string | null
  timestampHeader: string | null
  secret: string
  /** Reject if the timestamp is older than this many ms (default 5 min). 0 disables. */
  toleranceMs?: number
  /** Injectable for tests; defaults to Date.now(). */
  now?: number
}): boolean {
  const {
    rawBody,
    signatureHeader,
    timestampHeader,
    secret,
    toleranceMs = 5 * 60 * 1000,
    now = Date.now(),
  } = params

  if (!signatureHeader || !timestampHeader || !secret) return false

  // Timestamp must be a positive integer. Revolut documents epoch MILLISECONDS,
  // but normalise defensively: a ~10-digit value is seconds (anything below
  // 1e12 ms would be before year 2001), so scale it up. The freshness check is
  // the only thing this affects — the HMAC always signs the RAW header string.
  const tsRaw = Number(timestampHeader)
  if (!Number.isFinite(tsRaw) || tsRaw <= 0) return false
  const tsMs = tsRaw < 1e12 ? tsRaw * 1000 : tsRaw
  if (toleranceMs > 0 && Math.abs(now - tsMs) > toleranceMs) return false

  const signedPayload = `v1.${timestampHeader}.${rawBody}`
  const expected = createHmac('sha256', secret).update(signedPayload).digest('hex')
  const expectedValue = `v1=${expected}`

  // The header may carry several signatures during key rotation.
  const candidates = signatureHeader
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  return candidates.some((candidate) => safeEqual(candidate, expectedValue))
}

/** Constant-time compare that tolerates length mismatch without throwing. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}
