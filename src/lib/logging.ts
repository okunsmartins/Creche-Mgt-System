/**
 * Structured server-side logger.
 * Never logs secrets, card details, or excessive PII.
 * In production, replace with a proper log drain (e.g. Axiom, Datadog).
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  correlationId?: string
  [key: string]: unknown
}

function sanitise(obj: Record<string, unknown>): Record<string, unknown> {
  const SENSITIVE = new Set([
    'password',
    'token',
    'secret',
    'key',
    'card',
    'cvv',
    'cvc',
    'pan',
    'stripe_secret',
    'service_role',
  ])
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, SENSITIVE.has(k.toLowerCase()) ? '[REDACTED]' : v]),
  )
}

function log(level: LogLevel, message: string, meta: Record<string, unknown> = {}) {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...sanitise(meta),
  }
  const output = JSON.stringify(entry)
  if (level === 'error') {
    console.error(output)
  } else if (level === 'warn') {
    console.warn(output)
  } else {
    if (process.env['NODE_ENV'] !== 'production' || level !== 'debug') {
      // eslint-disable-next-line no-console
      console.log(output)
    }
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => log('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
}
