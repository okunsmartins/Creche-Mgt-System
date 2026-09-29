// Daily check-in state (crèche arrivals/departures). Pure + unit-tested.
// A child's day is one row: arrival (checked_in_at) and departure (checked_out_at).

export interface CheckInRow {
  checked_in_at: string | null
  checked_out_at: string | null
}

/** 'in' = present now, 'out' = arrived then left, 'not_in' = no arrival recorded. */
export type CheckInState = 'in' | 'out' | 'not_in'

export function checkInState(row: CheckInRow | null | undefined): CheckInState {
  if (!row || !row.checked_in_at) return 'not_in'
  if (row.checked_out_at) return 'out'
  return 'in'
}

/** True when the child is currently on the premises (arrived, not departed). */
export function isPresentNow(row: CheckInRow | null | undefined): boolean {
  return checkInState(row) === 'in'
}

/** Count children present now from a list of their check-in rows. */
export function countPresent(rows: ReadonlyArray<CheckInRow | null | undefined>): number {
  return rows.reduce((n, r) => n + (isPresentNow(r) ? 1 : 0), 0)
}
