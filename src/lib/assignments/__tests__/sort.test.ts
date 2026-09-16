import { describe, it, expect } from 'vitest'
import { orderByRecentSubmission, type StudentSubmissions } from '../sort'

function student(id: string, latestIso: string): StudentSubmissions {
  return {
    studentId: id,
    firstName: id,
    lastName: 'X',
    className: null,
    // index 0 is the newest upload (callers pass newest-first lists)
    assignments: [
      {
        id: `${id}-a`,
        title: null,
        fileKind: 'image',
        fileSizeBytes: 1,
        originalFilename: null,
        createdAt: latestIso,
        url: null,
      },
    ],
  }
}

describe('orderByRecentSubmission', () => {
  it('orders students by their newest upload, most recent first', () => {
    const out = orderByRecentSubmission([
      student('a', '2026-01-01T00:00:00Z'),
      student('c', '2026-03-01T00:00:00Z'),
      student('b', '2026-02-01T00:00:00Z'),
    ])
    expect(out.map((s) => s.studentId)).toEqual(['c', 'b', 'a'])
  })

  it('does not mutate the input array', () => {
    const input = [student('a', '2026-01-01T00:00:00Z'), student('b', '2026-02-01T00:00:00Z')]
    orderByRecentSubmission(input)
    expect(input.map((s) => s.studentId)).toEqual(['a', 'b'])
  })

  it('treats a student with no assignments as oldest', () => {
    const empty: StudentSubmissions = {
      studentId: 'empty',
      firstName: 'E',
      lastName: 'X',
      className: null,
      assignments: [],
    }
    const out = orderByRecentSubmission([empty, student('a', '2026-01-01T00:00:00Z')])
    expect(out[0]?.studentId).toBe('a')
  })
})
