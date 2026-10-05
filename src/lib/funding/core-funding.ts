// Funding & Hive Centre — Phase 4: Core Funding shadow profile + drift (pure).
// Core Funding is confirmed periodically (Review & Confirm). Creche Wise keeps the
// last VERIFIED snapshot of the funding-relevant profile and compares it to the
// CURRENT profile derived from live operational data (rooms, staffed capacity,
// operating weeks, staff count). Any drift surfaces as a review item before the next
// Review & Confirm window — Creche Wise never changes the funding data itself.

/** The funding-relevant service profile (derived from live data, or a snapshot). */
export interface CoreProfile {
  /** Active staff (teachers) count. */
  staffCount: number
  /** Active rooms (classes) count. */
  roomCount: number
  /** Total registered capacity (places) across rooms. */
  totalCapacity: number
  /** Weeks of operation in the programme year. */
  operatingWeeks: number
}

/** How a manager classifies a detected change. */
export const CHANGE_CLASSIFICATIONS = [
  'NO_IMPACT',
  'REVIEW_REQUIRED',
  'APPLICATION_CHANGE_REQUIRED',
  'EXTERNALLY_COMPLETED',
] as const
export type ChangeClassification = (typeof CHANGE_CLASSIFICATIONS)[number]

export const CHANGE_CLASSIFICATION_LABELS: Record<ChangeClassification, string> = {
  NO_IMPACT: 'No Core Funding impact',
  REVIEW_REQUIRED: 'Review required',
  APPLICATION_CHANGE_REQUIRED: 'Application change required',
  EXTERNALLY_COMPLETED: 'Completed on Hive',
}

export interface ProfileChange {
  field: keyof CoreProfile
  label: string
  from: number
  to: number
  /** to − from (positive = increased). */
  delta: number
}

const FIELD_LABELS: Record<keyof CoreProfile, string> = {
  staffCount: 'Staff',
  roomCount: 'Rooms',
  totalCapacity: 'Total capacity (places)',
  operatingWeeks: 'Operating weeks',
}

const FIELDS: (keyof CoreProfile)[] = ['staffCount', 'roomCount', 'totalCapacity', 'operatingWeeks']

/**
 * Compare the last verified snapshot to the current live profile and return the
 * fields that have drifted. Pure — the service feeds it the two profiles.
 */
export function diffCoreProfiles(snapshot: CoreProfile, current: CoreProfile): ProfileChange[] {
  const changes: ProfileChange[] = []
  for (const field of FIELDS) {
    const from = snapshot[field]
    const to = current[field]
    if (from !== to) {
      changes.push({ field, label: FIELD_LABELS[field], from, to, delta: to - from })
    }
  }
  return changes
}

export function hasDrift(changes: ReadonlyArray<ProfileChange>): boolean {
  return changes.length > 0
}

/**
 * A short plain-language summary of the drift for an action description, e.g.
 * "Staff 5 → 4; Total capacity (places) 60 → 54".
 */
export function summariseDrift(changes: ReadonlyArray<ProfileChange>): string {
  return changes.map((c) => `${c.label} ${c.from} → ${c.to}`).join('; ')
}
