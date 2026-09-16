import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format euro cents as a localised EUR string (e.g. 1250 → "€12.50") */
export function formatCurrency(cents: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

/** Convert euro float to integer cents — always round to avoid floating-point drift */
export function eurosToCents(euros: number): number {
  return Math.round(euros * 100)
}

/** Convert integer cents to euros */
export function centsToEuros(cents: number): number {
  return cents / 100
}

/** Format a Date to an Irish locale string */
export function formatDate(date: Date | string, includeTime = false): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Dublin',
    ...(includeTime && { hour: '2-digit', minute: '2-digit' }),
  }
  return new Intl.DateTimeFormat('en-IE', options).format(d)
}

/** Generate a random hex string of the requested byte length */
export function randomHex(bytes = 16): string {
  const arr = new Uint8Array(bytes)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr)
  }
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Mask an email for display (e.g. john.doe@example.com → j***e@example.com) */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return email
  if (local.length <= 2) return `${local[0]}***@${domain}`
  return `${local[0]}***${local[local.length - 1]}@${domain}`
}

/** Sleep for a given number of milliseconds */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Create a correlation ID for tracing requests */
export function createCorrelationId(): string {
  return `cid_${Date.now()}_${randomHex(8)}`
}

/** Up to two uppercase initials from a school/org name (e.g. "St Peters NS" → "SP"). */
export function schoolInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase()
  return (words[0]![0]! + words[1]![0]!).toUpperCase()
}

/**
 * A short, stable code prefix derived from a school name, used for pupil
 * payment codes (e.g. "St Peters Primary School" → "SPP", "Scoil Demo" → "SD").
 * Uses the initials of up to three words; falls back to the first alphanumeric
 * characters, and finally to "SCH" so a code is always producible.
 */
export function schoolCodePrefix(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const initials = words
    .map((w) => w.replace(/[^A-Za-z0-9]/g, '')[0])
    .filter(Boolean)
    .slice(0, 3)
    .join('')
    .toUpperCase()
  if (initials.length >= 2) return initials
  const alnum = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  if (alnum.length >= 2) return alnum.slice(0, 3)
  return 'SCH'
}
