// Guided import (IMP-01). Target-field catalogs a crèche's own spreadsheet columns
// map onto, plus auto-mapping from header names. Pure + unit-tested; no DB/parser.

export type ImportFieldType = 'text' | 'date' | 'enum' | 'email' | 'phone'

export interface TargetField {
  /** Stable key used by the importer + mapping UI. */
  key: string
  label: string
  required: boolean
  type: ImportFieldType
  /** Lowercased header spellings we auto-match against (their own layout). */
  aliases: string[]
  /** Allowed values for `enum` fields (case-insensitive match). */
  options?: string[]
}

export type ImportDataset = 'child' | 'parent' | 'staff'

/** Children dataset — Phase 1. Mirrors the onboarding template's Children sheet. */
export const CHILD_FIELDS: readonly TargetField[] = [
  { key: 'firstName', label: 'Child first name', required: true, type: 'text',
    aliases: ['child first name', 'first name', 'firstname', 'forename', 'given name', 'first'] },
  { key: 'lastName', label: 'Child last name', required: true, type: 'text',
    aliases: ['child last name', 'last name', 'lastname', 'surname', 'family name', 'last'] },
  { key: 'preferredName', label: 'Preferred name', required: false, type: 'text',
    aliases: ['preferred name', 'known as', 'nickname'] },
  { key: 'dateOfBirth', label: 'Date of birth', required: true, type: 'date',
    aliases: ['date of birth', 'dob', 'd.o.b', 'birth date', 'birthdate', 'born'] },
  { key: 'gender', label: 'Gender', required: false, type: 'text',
    aliases: ['gender', 'sex'] },
  { key: 'startDate', label: 'Start date', required: false, type: 'date',
    aliases: ['start date', 'enrolment date', 'enrollment date', 'joined'] },
  { key: 'room', label: 'Room', required: false, type: 'text',
    aliases: ['current room', 'room', 'class', 'group', 'session'] },
  { key: 'status', label: 'Status', required: false, type: 'enum',
    options: ['Enrolled', 'Waiting', 'Left'],
    aliases: ['status', 'enrolment status'] },
  { key: 'allergies', label: 'Allergies', required: false, type: 'text',
    aliases: ['allergies', 'allergy'] },
  { key: 'dietaryNeeds', label: 'Dietary needs', required: false, type: 'text',
    aliases: ['dietary needs', 'dietary', 'diet'] },
  { key: 'medicalConditions', label: 'Medical conditions', required: false, type: 'text',
    aliases: ['medical conditions', 'medical', 'conditions'] },
  { key: 'notes', label: 'Notes', required: false, type: 'text',
    aliases: ['additional needs / notes', 'notes', 'additional needs', 'comments'] },
  { key: 'primaryGuardian', label: 'Primary parent/guardian', required: false, type: 'text',
    aliases: ['primary parent/guardian', 'parent', 'guardian', 'primary guardian', 'parent name'] },
]

export const DATASET_FIELDS: Record<ImportDataset, readonly TargetField[]> = {
  child: CHILD_FIELDS,
  // Phase 2:
  parent: [],
  staff: [],
}

/** Normalise a header for matching: lowercase, collapse whitespace/punctuation. */
export function normaliseHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_/]+/g, ' ').replace(/\s+/g, ' ').replace(/[?:.]+$/g, '').trim()
}

/**
 * Best-effort auto-map: for each target field, find the first source column whose
 * (normalised) header exactly matches an alias, else a header that contains/te
 * matches the field key words. Returns { fieldKey: columnIndex | null }.
 * A source column is used at most once.
 */
export function autoMap(headers: string[], fields: readonly TargetField[]): Record<string, number | null> {
  const norm = headers.map(normaliseHeader)
  const used = new Set<number>()
  const result: Record<string, number | null> = {}

  for (const field of fields) {
    let found: number | null = null
    // 1. exact alias match
    for (let i = 0; i < norm.length; i++) {
      if (used.has(i)) continue
      if (field.aliases.includes(norm[i]!) || norm[i] === normaliseHeader(field.label)) {
        found = i
        break
      }
    }
    // 2. substring fallback (alias contained in header or vice-versa)
    if (found === null) {
      for (let i = 0; i < norm.length; i++) {
        if (used.has(i)) continue
        const h = norm[i]!
        if (field.aliases.some((a) => h.includes(a) || a.includes(h))) {
          found = i
          break
        }
      }
    }
    if (found !== null) used.add(found)
    result[field.key] = found
  }
  return result
}
