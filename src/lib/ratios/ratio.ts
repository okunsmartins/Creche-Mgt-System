// Room adult:child ratio calculations (spec §7.4/7.5). Pure + unit-tested.
//
// The engine is ratio-agnostic: the required adult:child ratio is a parameter
// (children per adult), because Irish regulatory ratios vary by service type and
// change — they are tenant-configurable per room. REFERENCE_EY_RATIOS below is a
// convenience default set, flagged CONFIRM, never hardcoded into the maths.

export interface RatioAssessment {
  children: number
  staffPresent: number
  childrenPerAdult: number
  /** Minimum staff required to cover the present children. */
  requiredStaff: number
  /** True when staffPresent >= requiredStaff. */
  met: boolean
  /** Extra staff needed to meet the ratio (0 when met). */
  shortfallStaff: number
  /** How many more children the present staff could take at this ratio. */
  spareChildCapacity: number
}

/** Minimum staff to cover `children` at `childrenPerAdult` (>=1). 0 children → 0. */
export function requiredStaff(children: number, childrenPerAdult: number): number {
  const cpa = Math.max(1, Math.floor(childrenPerAdult))
  const kids = Math.max(0, Math.floor(children))
  return Math.ceil(kids / cpa)
}

/** Assess a room's live ratio. */
export function assessRatio(
  children: number,
  staffPresent: number,
  childrenPerAdult: number,
): RatioAssessment {
  const cpa = Math.max(1, Math.floor(childrenPerAdult))
  const kids = Math.max(0, Math.floor(children))
  const staff = Math.max(0, Math.floor(staffPresent))
  const required = requiredStaff(kids, cpa)
  const met = staff >= required
  return {
    children: kids,
    staffPresent: staff,
    childrenPerAdult: cpa,
    requiredStaff: required,
    met,
    shortfallStaff: Math.max(0, required - staff),
    spareChildCapacity: Math.max(0, staff * cpa - kids),
  }
}

export type RatioSeverity = 'ok' | 'at_capacity' | 'breach'

/** UI severity: breach when understaffed, at_capacity when full, else ok. */
export function ratioSeverity(a: RatioAssessment): RatioSeverity {
  if (!a.met) return 'breach'
  if (a.spareChildCapacity === 0 && a.children > 0) return 'at_capacity'
  return 'ok'
}

export interface EyRatioBand {
  label: string
  minMonths: number
  maxMonths: number
  childrenPerAdult: number
}

/**
 * REFERENCE Irish Early-Years adult:child ratios (full day care) — a starting set
 * only. ⚠️ CONFIRM against current Tusla / Child Care (Early Years Services)
 * Regulations; these are tenant-configurable per room and vary by service type
 * (sessional vs full-day). Do not treat as authoritative.
 */
export const REFERENCE_EY_RATIOS: readonly EyRatioBand[] = [
  { label: '0–1 year', minMonths: 0, maxMonths: 12, childrenPerAdult: 3 },
  { label: '1–2 years', minMonths: 12, maxMonths: 24, childrenPerAdult: 5 },
  { label: '2–3 years', minMonths: 24, maxMonths: 36, childrenPerAdult: 6 },
  { label: '3–6 years', minMonths: 36, maxMonths: 72, childrenPerAdult: 8 },
]

/**
 * Pick the ratio band for an age in months from a band set (defaults to the reference set;
 * callers pass the crèche's configured bands). Null if the age is outside every band.
 */
export function ratioBandForAgeMonths(
  months: number,
  bands: ReadonlyArray<EyRatioBand> = REFERENCE_EY_RATIOS,
): EyRatioBand | null {
  return bands.find((b) => months >= b.minMonths && months < b.maxMonths) ?? null
}

export interface RoomStaffing {
  /** Children whose age maps to a ratio band. */
  totalPlaced: number
  /** Children with no DOB or an age outside the reference bands (can't ratio). */
  unknownAge: number
  /** Minimum staff needed, summed per age band (bands aren't shared). */
  requiredStaff: number
  byBand: { band: EyRatioBand; children: number; required: number }[]
}

/**
 * Minimum staffing for a room from its children's ages (months). Groups by
 * reference band and sums required staff per band — the safe reading when a child
 * of one age band can't be covered by staff assigned to another. Ages that don't
 * map to a band (null, or outside 0–72m) are counted as `unknownAge` and excluded
 * from the requirement (the UI surfaces them so a human decides).
 */
export function roomStaffingRequirement(
  agesMonths: ReadonlyArray<number | null>,
  bands: ReadonlyArray<EyRatioBand> = REFERENCE_EY_RATIOS,
): RoomStaffing {
  const counts = new Map<string, { band: EyRatioBand; children: number }>()
  let unknownAge = 0
  for (const m of agesMonths) {
    const band = m == null ? null : ratioBandForAgeMonths(m, bands)
    if (!band) {
      unknownAge++
      continue
    }
    const entry = counts.get(band.label) ?? { band, children: 0 }
    entry.children++
    counts.set(band.label, entry)
  }
  const byBand = bands
    .filter((b) => counts.has(b.label))
    .map((b) => {
      const c = counts.get(b.label)!.children
      return { band: b, children: c, required: requiredStaff(c, b.childrenPerAdult) }
    })
  return {
    totalPlaced: byBand.reduce((s, x) => s + x.children, 0),
    unknownAge,
    requiredStaff: byBand.reduce((s, x) => s + x.required, 0),
    byBand,
  }
}
