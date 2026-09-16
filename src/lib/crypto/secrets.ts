import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'
// Note: not marked `server-only` so it stays unit-testable; the `node:crypto`
// dependency already prevents any client/browser bundle from importing it.

/**
 * Symmetric encryption for third-party secrets stored per-school (e.g. a school's
 * own Revolut Merchant API key). AES-256-GCM with a platform key from the
 * `ENCRYPTION_KEY` env var.
 *
 * `ENCRYPTION_KEY` may be any non-empty string; it is hashed to a 32-byte key so
 * a base64/hex 32-byte value or a long passphrase both work. Keep it stable —
 * rotating it makes previously-stored ciphertexts undecryptable.
 *
 * Serialised form: base64(iv).base64(authTag).base64(ciphertext) — self-contained
 * so decryption needs only the stored string + the env key.
 */

const IV_BYTES = 12 // GCM standard nonce length

export function isEncryptionConfigured(): boolean {
  return (process.env['ENCRYPTION_KEY'] ?? '').length > 0
}

function key(): Buffer {
  const raw = process.env['ENCRYPTION_KEY'] ?? ''
  if (!raw) throw new Error('ENCRYPTION_KEY is not set')
  // Normalise any input to exactly 32 bytes.
  return createHash('sha256').update(raw).digest()
}

/** Encrypt a plaintext secret. Returns the serialised iv.tag.ciphertext string. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}.${tag.toString('base64')}.${ct.toString('base64')}`
}

/** Decrypt a value produced by {@link encryptSecret}. Throws on tamper/format error. */
export function decryptSecret(serialised: string): string {
  const parts = serialised.split('.')
  if (parts.length !== 3) throw new Error('Malformed ciphertext')
  const [ivB64, tagB64, ctB64] = parts as [string, string, string]
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString(
    'utf8',
  )
}
