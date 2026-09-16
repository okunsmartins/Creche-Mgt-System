import { describe, it, expect } from 'vitest'
import {
  createActivitySchema,
  updateActivitySchema,
  publishActivitySchema,
  archiveActivitySchema,
  closeActivitySchema,
} from '../schemas'

const VALID_UUID = '00000000-0000-4000-a000-000000000001'
const VALID_UUID_2 = '00000000-0000-4000-a000-000000000002'

const validCreate = {
  name: 'School Tour',
  amountEuros: '10.00',
  classIds: [VALID_UUID],
}

// ─── createActivitySchema ─────────────────────────────────────────────────────

describe('createActivitySchema', () => {
  it('accepts a minimal valid activity', () => {
    const r = createActivitySchema.safeParse(validCreate)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.amountEuros).toBe(1000) // 10.00 euros → 1000 cents
  })

  it('accepts all optional fields', () => {
    const r = createActivitySchema.safeParse({
      ...validCreate,
      description: 'A fun trip',
      accountingCode: 'ACC-001',
      opensAt: '2026-07-01T09:00',
      closesAt: '2026-07-15T17:00',
    })
    expect(r.success).toBe(true)
  })

  it('rejects empty name', () => {
    const r = createActivitySchema.safeParse({ ...validCreate, name: '' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors.name).toBeDefined()
  })

  it('rejects name longer than 200 characters', () => {
    const r = createActivitySchema.safeParse({ ...validCreate, name: 'A'.repeat(201) })
    expect(r.success).toBe(false)
  })

  it('rejects non-numeric amount', () => {
    const r = createActivitySchema.safeParse({ ...validCreate, amountEuros: 'abc' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors.amountEuros).toBeDefined()
  })

  it('rejects amount with more than 2 decimal places', () => {
    const r = createActivitySchema.safeParse({ ...validCreate, amountEuros: '5.123' })
    expect(r.success).toBe(false)
  })

  it('accepts integer amount and converts to cents', () => {
    const r = createActivitySchema.safeParse({ ...validCreate, amountEuros: '5' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.amountEuros).toBe(500)
  })

  it('accepts zero amount', () => {
    const r = createActivitySchema.safeParse({ ...validCreate, amountEuros: '0' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.amountEuros).toBe(0)
  })

  it('converts 5.50 to 550 cents', () => {
    const r = createActivitySchema.safeParse({ ...validCreate, amountEuros: '5.50' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.amountEuros).toBe(550)
  })

  it('rejects empty classIds with no pupilIds', () => {
    const r = createActivitySchema.safeParse({ ...validCreate, classIds: [] })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors.classIds).toBeDefined()
  })

  it('accepts empty classIds when pupilIds are provided', () => {
    const r = createActivitySchema.safeParse({
      ...validCreate,
      classIds: [],
      pupilIds: [VALID_UUID],
    })
    expect(r.success).toBe(true)
  })

  it('accepts both classIds and pupilIds', () => {
    const r = createActivitySchema.safeParse({
      ...validCreate,
      classIds: [VALID_UUID],
      pupilIds: [VALID_UUID_2],
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.classIds).toHaveLength(1)
      expect(r.data.pupilIds).toHaveLength(1)
    }
  })

  it('defaults pupilIds to empty array when omitted', () => {
    const r = createActivitySchema.safeParse(validCreate)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.pupilIds).toEqual([])
  })

  it('rejects non-UUID class IDs', () => {
    const r = createActivitySchema.safeParse({ ...validCreate, classIds: ['not-a-uuid'] })
    expect(r.success).toBe(false)
  })

  it('rejects non-UUID pupil IDs', () => {
    const r = createActivitySchema.safeParse({
      ...validCreate,
      classIds: [],
      pupilIds: ['not-a-uuid'],
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors.pupilIds).toBeDefined()
  })

  it('accepts multiple valid class IDs', () => {
    const r = createActivitySchema.safeParse({
      ...validCreate,
      classIds: [VALID_UUID, VALID_UUID_2],
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.classIds).toHaveLength(2)
  })

  it('rejects closesAt before opensAt', () => {
    const r = createActivitySchema.safeParse({
      ...validCreate,
      opensAt: '2026-07-15T10:00',
      closesAt: '2026-07-01T10:00',
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors.closesAt).toBeDefined()
  })

  it('accepts closesAt without opensAt', () => {
    const r = createActivitySchema.safeParse({ ...validCreate, closesAt: '2026-07-15T17:00' })
    expect(r.success).toBe(true)
  })

  it('transforms empty opensAt to undefined', () => {
    const r = createActivitySchema.safeParse({ ...validCreate, opensAt: '' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.opensAt).toBeUndefined()
  })

  it('transforms empty closesAt to undefined', () => {
    const r = createActivitySchema.safeParse({ ...validCreate, closesAt: '  ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.closesAt).toBeUndefined()
  })
})

// ─── updateActivitySchema ─────────────────────────────────────────────────────

describe('updateActivitySchema', () => {
  it('accepts valid update data with activityId', () => {
    const r = updateActivitySchema.safeParse({ ...validCreate, activityId: VALID_UUID })
    expect(r.success).toBe(true)
  })

  it('rejects missing activityId', () => {
    const r = updateActivitySchema.safeParse(validCreate)
    expect(r.success).toBe(false)
  })

  it('rejects invalid activityId', () => {
    const r = updateActivitySchema.safeParse({ ...validCreate, activityId: 'bad-id' })
    expect(r.success).toBe(false)
  })

  it('accepts pupil-only eligibility', () => {
    const r = updateActivitySchema.safeParse({
      ...validCreate,
      activityId: VALID_UUID,
      classIds: [],
      pupilIds: [VALID_UUID_2],
    })
    expect(r.success).toBe(true)
  })
})

// ─── publishActivitySchema ────────────────────────────────────────────────────

describe('publishActivitySchema', () => {
  it('accepts a valid UUID', () => {
    expect(publishActivitySchema.safeParse({ activityId: VALID_UUID }).success).toBe(true)
  })

  it('rejects a non-UUID string', () => {
    expect(publishActivitySchema.safeParse({ activityId: 'bad' }).success).toBe(false)
  })

  it('rejects missing activityId', () => {
    expect(publishActivitySchema.safeParse({}).success).toBe(false)
  })
})

// ─── archiveActivitySchema ────────────────────────────────────────────────────

describe('archiveActivitySchema', () => {
  it('accepts a valid UUID', () => {
    expect(archiveActivitySchema.safeParse({ activityId: VALID_UUID }).success).toBe(true)
  })

  it('rejects a non-UUID string', () => {
    expect(archiveActivitySchema.safeParse({ activityId: 'bad' }).success).toBe(false)
  })

  it('rejects missing activityId', () => {
    expect(archiveActivitySchema.safeParse({}).success).toBe(false)
  })
})

// ─── closeActivitySchema ──────────────────────────────────────────────────────

describe('closeActivitySchema', () => {
  it('accepts a valid UUID', () => {
    expect(closeActivitySchema.safeParse({ activityId: VALID_UUID }).success).toBe(true)
  })

  it('rejects a non-UUID string', () => {
    expect(closeActivitySchema.safeParse({ activityId: 'bad' }).success).toBe(false)
  })

  it('rejects missing activityId', () => {
    expect(closeActivitySchema.safeParse({}).success).toBe(false)
  })
})
