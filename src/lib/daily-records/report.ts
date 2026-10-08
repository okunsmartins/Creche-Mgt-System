// Daily-records reporting — pure aggregation (end-of-day/week/month). Unit-tested.

import { DAILY_RECORD_TYPES, type DailyRecordType } from './records'

export interface DailyRecordInputRow {
  studentId: string
  studentName: string
  type: DailyRecordType
  recordedAt: string // ISO timestamp
}

export type TypeCounts = Record<DailyRecordType, number>

export interface DailyRecordChildLine {
  studentId: string
  name: string
  counts: TypeCounts
  total: number
}

export interface DailyRecordsSummary {
  byChild: DailyRecordChildLine[]
  byType: TypeCounts
  total: number
}

function emptyCounts(): TypeCounts {
  return { sleep: 0, nappy: 0, meal: 0, incident: 0, medication: 0 }
}

/**
 * Aggregate daily-record rows into per-child type counts and overall type totals.
 * Children are returned sorted by name. Pure — the period window is applied by the caller.
 */
export function summariseDailyRecords(
  rows: ReadonlyArray<DailyRecordInputRow>,
): DailyRecordsSummary {
  const byChildMap = new Map<string, DailyRecordChildLine>()
  const byType = emptyCounts()
  let total = 0

  for (const r of rows) {
    if (!DAILY_RECORD_TYPES.includes(r.type)) continue
    const line =
      byChildMap.get(r.studentId) ??
      ({
        studentId: r.studentId,
        name: r.studentName,
        counts: emptyCounts(),
        total: 0,
      } satisfies DailyRecordChildLine)
    line.counts[r.type] += 1
    line.total += 1
    byChildMap.set(r.studentId, line)
    byType[r.type] += 1
    total += 1
  }

  const byChild = [...byChildMap.values()].sort((a, b) => a.name.localeCompare(b.name))
  return { byChild, byType, total }
}
