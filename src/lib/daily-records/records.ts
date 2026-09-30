// Daily care records (spec §7.6). Pure catalog + validation. No DB.

export const DAILY_RECORD_TYPES = ['sleep', 'nappy', 'meal', 'incident', 'medication'] as const
export type DailyRecordType = (typeof DAILY_RECORD_TYPES)[number]

export const DAILY_RECORD_LABELS: Record<DailyRecordType, string> = {
  sleep: 'Sleep',
  nappy: 'Nappy',
  meal: 'Meal',
  incident: 'Incident',
  medication: 'Medication',
}

export function isDailyRecordType(v: string): v is DailyRecordType {
  return (DAILY_RECORD_TYPES as readonly string[]).includes(v)
}

export interface DailyRecordInput {
  type: string
  note: string
}

/** Validate a record before insert. Incident & medication require a note (safeguarding). */
export function validateDailyRecord(
  input: DailyRecordInput,
): { ok: true } | { ok: false; error: string } {
  if (!isDailyRecordType(input.type)) return { ok: false, error: 'Choose a record type.' }
  const note = input.note?.trim() ?? ''
  if ((input.type === 'incident' || input.type === 'medication') && note.length === 0) {
    return {
      ok: false,
      error: `A note is required for ${DAILY_RECORD_LABELS[input.type]} records.`,
    }
  }
  if (note.length > 2000) return { ok: false, error: 'Note is too long (2000 characters max).' }
  return { ok: true }
}
