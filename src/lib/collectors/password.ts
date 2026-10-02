// One-way hashing for a collector's door "password / word" used to verify the
// person at hand-over. This is a low-sensitivity convenience secret (not a login
// credential), but we still never store or return it in plaintext. scrypt with a
// per-record random salt; constant-time compare on verify.
//
// node:crypto only — keep this out of client bundles. Imported by server actions
// and tests, never by a client component.

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const KEYLEN = 32
const SCHEME = 'scrypt'

/** Hash a plaintext word → `scrypt$<saltHex>$<hashHex>` for storage. */
export function hashCollectionPassword(plain: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(plain.normalize('NFKC'), salt, KEYLEN)
  return `${SCHEME}$${salt.toString('hex')}$${hash.toString('hex')}`
}

/** Verify a plaintext word against a stored `scrypt$salt$hash`. Never throws. */
export function verifyCollectionPassword(
  plain: string,
  stored: string | null | undefined,
): boolean {
  if (!stored) return false
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== SCHEME) return false
  try {
    const salt = Buffer.from(parts[1]!, 'hex')
    const expected = Buffer.from(parts[2]!, 'hex')
    const actual = scryptSync(plain.normalize('NFKC'), salt, expected.length)
    return expected.length === actual.length && timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}
