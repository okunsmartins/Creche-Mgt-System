import { describe, it, expect } from 'vitest'
import { summariseDailyRecords, type DailyRecordInputRow } from '../report'

function row(
  studentId: string,
  name: string,
  type: DailyRecordInputRow['type'],
): DailyRecordInputRow {
  return { studentId, studentName: name, type, recordedAt: '2026-10-08T09:00:00Z' }
}

describe('summariseDailyRecords', () => {
  it('counts per child and per type, sorted by name', () => {
    const { byChild, byType, total } = summariseDailyRecords([
      row('s2', 'Ben Ryan', 'sleep'),
      row('s2', 'Ben Ryan', 'nappy'),
      row('s1', 'Ava Byrne', 'meal'),
      row('s1', 'Ava Byrne', 'meal'),
      row('s1', 'Ava Byrne', 'incident'),
    ])
    expect(total).toBe(5)
    expect(byType).toEqual({ sleep: 1, nappy: 1, meal: 2, incident: 1, medication: 0 })
    expect(byChild.map((c) => c.name)).toEqual(['Ava Byrne', 'Ben Ryan']) // alphabetical
    expect(byChild[0]?.counts.meal).toBe(2)
    expect(byChild[0]?.total).toBe(3)
    expect(byChild[1]?.counts.sleep).toBe(1)
  })

  it('empty input yields zeroed totals', () => {
    const r = summariseDailyRecords([])
    expect(r.total).toBe(0)
    expect(r.byChild).toEqual([])
    expect(r.byType.medication).toBe(0)
  })
})
