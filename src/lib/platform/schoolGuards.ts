/**
 * Pure guards for platform school actions. Kept out of the `'use server'` action
 * module (whose every export must be async) so they stay directly unit-testable
 * and reusable on the client.
 */

/**
 * The confirmation the owner types before a permanent delete must match the
 * school's name — trimmed and case-insensitive. An empty actual name never
 * matches (defends against a blank-name row confirming on an empty input).
 */
export function schoolNameConfirmed(typed: string, actual: string): boolean {
  const a = actual.trim().toLowerCase()
  return a.length > 0 && typed.trim().toLowerCase() === a
}
