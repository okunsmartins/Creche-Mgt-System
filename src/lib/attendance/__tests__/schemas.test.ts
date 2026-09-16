import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Re-define schemas locally (they live inline in actions.ts as they are private)
const recordSchema = z.object({
  studentId: z.string().uuid(),
  status: z.enum(['present', 'absent', 'late']),
  note: z.string().max(255).optional(),
})

const markAttendanceSchema = z.object({
  classId: z.string().uuid(),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(500).optional(),
  records: z.array(recordSchema).min(1),
})

const VALID_UUID = '00000000-0000-0000-0000-000000000001'
const VALID_DATE = '2026-06-22'

// ─── recordSchema ─────────────────────────────────────────────────────────────

describe('recordSchema', () => {
  it('accepts present status with no note', () => {
    const result = recordSchema.safeParse({ studentId: VALID_UUID, status: 'present' })
    expect(result.success).toBe(true)
  })

  it('accepts absent status with a note', () => {
    const result = recordSchema.safeParse({ studentId: VALID_UUID, status: 'absent', note: 'Sick' })
    expect(result.success).toBe(true)
  })

  it('accepts late status', () => {
    const result = recordSchema.safeParse({ studentId: VALID_UUID, status: 'late' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid status', () => {
    const result = recordSchema.safeParse({ studentId: VALID_UUID, status: 'excused' })
    expect(result.success).toBe(false)
  })

  it('rejects non-UUID studentId', () => {
    const result = recordSchema.safeParse({ studentId: 'not-a-uuid', status: 'present' })
    expect(result.success).toBe(false)
  })

  it('rejects note exceeding 255 characters', () => {
    const result = recordSchema.safeParse({
      studentId: VALID_UUID,
      status: 'absent',
      note: 'a'.repeat(256),
    })
    expect(result.success).toBe(false)
  })

  it('accepts note at exactly 255 characters', () => {
    const result = recordSchema.safeParse({
      studentId: VALID_UUID,
      status: 'absent',
      note: 'a'.repeat(255),
    })
    expect(result.success).toBe(true)
  })
})

// ─── markAttendanceSchema ─────────────────────────────────────────────────────

describe('markAttendanceSchema', () => {
  const validRecord = { studentId: VALID_UUID, status: 'present' as const }

  it('accepts valid input with one record', () => {
    const result = markAttendanceSchema.safeParse({
      classId: VALID_UUID,
      sessionDate: VALID_DATE,
      records: [validRecord],
    })
    expect(result.success).toBe(true)
  })

  it('accepts optional session notes', () => {
    const result = markAttendanceSchema.safeParse({
      classId: VALID_UUID,
      sessionDate: VALID_DATE,
      notes: 'Fire drill at 10am',
      records: [validRecord],
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-UUID classId', () => {
    const result = markAttendanceSchema.safeParse({
      classId: 'not-a-uuid',
      sessionDate: VALID_DATE,
      records: [validRecord],
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid date format', () => {
    const result = markAttendanceSchema.safeParse({
      classId: VALID_UUID,
      sessionDate: '22-06-2026',
      records: [validRecord],
    })
    expect(result.success).toBe(false)
  })

  it('rejects date with slashes', () => {
    const result = markAttendanceSchema.safeParse({
      classId: VALID_UUID,
      sessionDate: '2026/06/22',
      records: [validRecord],
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty records array', () => {
    const result = markAttendanceSchema.safeParse({
      classId: VALID_UUID,
      sessionDate: VALID_DATE,
      records: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing records field', () => {
    const result = markAttendanceSchema.safeParse({
      classId: VALID_UUID,
      sessionDate: VALID_DATE,
    })
    expect(result.success).toBe(false)
  })

  it('rejects session notes exceeding 500 characters', () => {
    const result = markAttendanceSchema.safeParse({
      classId: VALID_UUID,
      sessionDate: VALID_DATE,
      notes: 'a'.repeat(501),
      records: [validRecord],
    })
    expect(result.success).toBe(false)
  })

  it('accepts session notes at exactly 500 characters', () => {
    const result = markAttendanceSchema.safeParse({
      classId: VALID_UUID,
      sessionDate: VALID_DATE,
      notes: 'a'.repeat(500),
      records: [validRecord],
    })
    expect(result.success).toBe(true)
  })

  it('accepts multiple records with mixed statuses', () => {
    const result = markAttendanceSchema.safeParse({
      classId: VALID_UUID,
      sessionDate: VALID_DATE,
      records: [
        { studentId: VALID_UUID, status: 'present' },
        { studentId: '00000000-0000-0000-0000-000000000002', status: 'absent', note: 'Sick' },
        { studentId: '00000000-0000-0000-0000-000000000003', status: 'late', note: 'Bus delay' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects records containing an invalid studentId', () => {
    const result = markAttendanceSchema.safeParse({
      classId: VALID_UUID,
      sessionDate: VALID_DATE,
      records: [{ studentId: 'bad-id', status: 'present' }],
    })
    expect(result.success).toBe(false)
  })
})
