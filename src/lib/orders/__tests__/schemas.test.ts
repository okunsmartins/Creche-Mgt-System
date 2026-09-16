import { describe, it, expect } from 'vitest'
import {
  lookupPupilSchema,
  guestCodeOrderSchema,
  guestManualOrderSchema,
  parentOrderSchema,
} from '../schemas'

const VALID_ACTIVITY_ID = '00000000-0000-0000-0000-000000000001'
const VALID_ACTIVITY_ID_2 = '00000000-0000-0000-0000-000000000004'
const VALID_STUDENT_ID = '00000000-0000-0000-0000-000000000002'
const VALID_CLASS_ID = '00000000-0000-0000-0000-000000000003'
const VALID_PUPIL_CODE = 'SB-ABC23456'

// ─── lookupPupilSchema ────────────────────────────────────────────────────────

describe('lookupPupilSchema', () => {
  it('accepts a valid pupil code', () => {
    const result = lookupPupilSchema.safeParse({ pupilCode: VALID_PUPIL_CODE })
    expect(result.success).toBe(true)
    expect(result.data?.pupilCode).toBe('SB-ABC23456')
  })

  it('transforms lowercase input to uppercase', () => {
    const result = lookupPupilSchema.safeParse({ pupilCode: 'sb-abc23456' })
    expect(result.success).toBe(true)
    expect(result.data?.pupilCode).toBe('SB-ABC23456')
  })

  it('trims surrounding whitespace before parsing', () => {
    const result = lookupPupilSchema.safeParse({ pupilCode: '  SB-ABC23456  ' })
    expect(result.success).toBe(true)
    expect(result.data?.pupilCode).toBe('SB-ABC23456')
  })

  it('rejects empty string', () => {
    const result = lookupPupilSchema.safeParse({ pupilCode: '' })
    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors.pupilCode?.[0]).toMatch(/payment code/i)
  })

  it('rejects invalid format without SB- prefix', () => {
    const result = lookupPupilSchema.safeParse({ pupilCode: 'ABCDEFGH' })
    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors.pupilCode?.[0]).toMatch(/valid pupil code/i)
  })

  it('rejects codes containing excluded characters I and O', () => {
    const result = lookupPupilSchema.safeParse({ pupilCode: 'SB-IIIIIIII' })
    expect(result.success).toBe(false)
  })

  it('accepts a per-school prefix (e.g. SPP-)', () => {
    const result = lookupPupilSchema.safeParse({ pupilCode: 'SPP-AB23CD45' })
    expect(result.success).toBe(true)
    expect(result.data?.pupilCode).toBe('SPP-AB23CD45')
  })

  it('rejects a prefix longer than 4 characters', () => {
    const result = lookupPupilSchema.safeParse({ pupilCode: 'ABCDE-AB23CD45' })
    expect(result.success).toBe(false)
  })
})

const VALID_PROGRAMME_ID = '00000000-0000-0000-0000-000000000005'

// ─── guestCodeOrderSchema ─────────────────────────────────────────────────────

describe('guestCodeOrderSchema', () => {
  const valid = {
    payerName: 'Jane Smith',
    payerEmail: 'jane@example.com',
    pupilCode: VALID_PUPIL_CODE,
    basket: JSON.stringify([{ kind: 'activity', activityId: VALID_ACTIVITY_ID }]),
  }

  it('accepts a single activity basket item', () => {
    const result = guestCodeOrderSchema.safeParse(valid)
    expect(result.success).toBe(true)
    expect(result.data?.payerName).toBe('Jane Smith')
    expect(result.data?.payerEmail).toBe('jane@example.com')
    expect(result.data?.basket).toHaveLength(1)
    const item = result.data?.basket[0]
    if (item?.kind === 'activity') expect(item.activityId).toBe(VALID_ACTIVITY_ID)
  })

  it('accepts a single programme basket item', () => {
    const result = guestCodeOrderSchema.safeParse({
      ...valid,
      basket: JSON.stringify([{ kind: 'programme', programmeId: VALID_PROGRAMME_ID }]),
    })
    expect(result.success).toBe(true)
    const item = result.data?.basket[0]
    if (item?.kind === 'programme') expect(item.programmeId).toBe(VALID_PROGRAMME_ID)
  })

  it('accepts a mixed basket with activities and programmes', () => {
    const result = guestCodeOrderSchema.safeParse({
      ...valid,
      basket: JSON.stringify([
        { kind: 'activity', activityId: VALID_ACTIVITY_ID },
        { kind: 'activity', activityId: VALID_ACTIVITY_ID_2 },
        { kind: 'programme', programmeId: VALID_PROGRAMME_ID },
      ]),
    })
    expect(result.success).toBe(true)
    expect(result.data?.basket).toHaveLength(3)
  })

  it('trims and lowercases the payer email', () => {
    const result = guestCodeOrderSchema.safeParse({ ...valid, payerEmail: '  Jane@Example.COM  ' })
    expect(result.success).toBe(true)
    expect(result.data?.payerEmail).toBe('jane@example.com')
  })

  it('trims whitespace from payer name', () => {
    const result = guestCodeOrderSchema.safeParse({ ...valid, payerName: '  Jane Smith  ' })
    expect(result.success).toBe(true)
    expect(result.data?.payerName).toBe('Jane Smith')
  })

  it('rejects empty payer name', () => {
    const result = guestCodeOrderSchema.safeParse({ ...valid, payerName: '' })
    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors.payerName?.[0]).toMatch(/name/i)
  })

  it('rejects whitespace-only payer name', () => {
    const result = guestCodeOrderSchema.safeParse({ ...valid, payerName: '   ' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = guestCodeOrderSchema.safeParse({ ...valid, payerEmail: 'not-an-email' })
    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors.payerEmail?.[0]).toMatch(/email/i)
  })

  it('rejects invalid pupil code', () => {
    const result = guestCodeOrderSchema.safeParse({ ...valid, pupilCode: 'BADCODE' })
    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors.pupilCode?.[0]).toMatch(/pupil code/i)
  })

  it('rejects payer name exceeding 200 characters', () => {
    const result = guestCodeOrderSchema.safeParse({ ...valid, payerName: 'A'.repeat(201) })
    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors.payerName?.[0]).toMatch(/long/i)
  })

  it('rejects empty basket array', () => {
    const result = guestCodeOrderSchema.safeParse({ ...valid, basket: JSON.stringify([]) })
    expect(result.success).toBe(false)
  })

  it('rejects non-JSON basket', () => {
    const result = guestCodeOrderSchema.safeParse({ ...valid, basket: 'not-json' })
    expect(result.success).toBe(false)
  })

  it('rejects basket item with unknown kind', () => {
    const result = guestCodeOrderSchema.safeParse({
      ...valid,
      basket: JSON.stringify([{ kind: 'other', activityId: VALID_ACTIVITY_ID }]),
    })
    expect(result.success).toBe(false)
  })

  it('rejects basket item missing kind', () => {
    const result = guestCodeOrderSchema.safeParse({
      ...valid,
      basket: JSON.stringify([{ activityId: VALID_ACTIVITY_ID }]),
    })
    expect(result.success).toBe(false)
  })

  it('rejects basket activity item with non-UUID activityId', () => {
    const result = guestCodeOrderSchema.safeParse({
      ...valid,
      basket: JSON.stringify([{ kind: 'activity', activityId: 'not-a-uuid' }]),
    })
    expect(result.success).toBe(false)
  })

  it('rejects basket programme item with non-UUID programmeId', () => {
    const result = guestCodeOrderSchema.safeParse({
      ...valid,
      basket: JSON.stringify([{ kind: 'programme', programmeId: 'not-a-uuid' }]),
    })
    expect(result.success).toBe(false)
  })

  it('rejects basket that is not an array', () => {
    const result = guestCodeOrderSchema.safeParse({
      ...valid,
      basket: JSON.stringify({ kind: 'activity', activityId: VALID_ACTIVITY_ID }),
    })
    expect(result.success).toBe(false)
  })
})

// ─── guestManualOrderSchema ───────────────────────────────────────────────────

describe('guestManualOrderSchema', () => {
  const valid = {
    payerName: 'Jane Smith',
    payerEmail: 'jane@example.com',
    childFirstName: 'Alice',
    childLastName: 'Smith',
    childClassId: VALID_CLASS_ID,
    basket: JSON.stringify([{ kind: 'activity', activityId: VALID_ACTIVITY_ID }]),
  }

  it('accepts a valid single-activity manual submission', () => {
    const result = guestManualOrderSchema.safeParse(valid)
    expect(result.success).toBe(true)
    expect(result.data?.childFirstName).toBe('Alice')
    expect(result.data?.childLastName).toBe('Smith')
    expect(result.data?.basket).toHaveLength(1)
  })

  it('accepts a programme basket item', () => {
    const result = guestManualOrderSchema.safeParse({
      ...valid,
      basket: JSON.stringify([{ kind: 'programme', programmeId: VALID_PROGRAMME_ID }]),
    })
    expect(result.success).toBe(true)
    expect(result.data?.basket).toHaveLength(1)
  })

  it('accepts a mixed basket', () => {
    const result = guestManualOrderSchema.safeParse({
      ...valid,
      basket: JSON.stringify([
        { kind: 'activity', activityId: VALID_ACTIVITY_ID },
        { kind: 'programme', programmeId: VALID_PROGRAMME_ID },
      ]),
    })
    expect(result.success).toBe(true)
    expect(result.data?.basket).toHaveLength(2)
  })

  it('trims child names', () => {
    const result = guestManualOrderSchema.safeParse({
      ...valid,
      childFirstName: '  Alice  ',
      childLastName: '  Smith  ',
    })
    expect(result.success).toBe(true)
    expect(result.data?.childFirstName).toBe('Alice')
    expect(result.data?.childLastName).toBe('Smith')
  })

  it('rejects empty child first name', () => {
    const result = guestManualOrderSchema.safeParse({ ...valid, childFirstName: '' })
    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors.childFirstName?.[0]).toMatch(/first name/i)
  })

  it('rejects empty child last name', () => {
    const result = guestManualOrderSchema.safeParse({ ...valid, childLastName: '' })
    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors.childLastName?.[0]).toMatch(/last name/i)
  })

  it('rejects missing child class ID', () => {
    const result = guestManualOrderSchema.safeParse({ ...valid, childClassId: '' })
    expect(result.success).toBe(false)
  })

  it('rejects non-UUID child class ID', () => {
    const result = guestManualOrderSchema.safeParse({ ...valid, childClassId: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = guestManualOrderSchema.safeParse({ ...valid, payerEmail: 'bad' })
    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors.payerEmail?.[0]).toMatch(/email/i)
  })

  it('rejects empty basket array', () => {
    const result = guestManualOrderSchema.safeParse({ ...valid, basket: JSON.stringify([]) })
    expect(result.success).toBe(false)
  })

  it('rejects non-JSON basket', () => {
    const result = guestManualOrderSchema.safeParse({ ...valid, basket: 'bad' })
    expect(result.success).toBe(false)
  })

  it('rejects basket item with unknown kind', () => {
    const result = guestManualOrderSchema.safeParse({
      ...valid,
      basket: JSON.stringify([{ kind: 'other', activityId: VALID_ACTIVITY_ID }]),
    })
    expect(result.success).toBe(false)
  })
})

// ─── parentOrderSchema ────────────────────────────────────────────────────────

describe('parentOrderSchema', () => {
  const validActivityBasket = JSON.stringify([
    { kind: 'activity', studentId: VALID_STUDENT_ID, activityId: VALID_ACTIVITY_ID },
  ])
  const validProgrammeBasket = JSON.stringify([
    { kind: 'programme', studentId: VALID_STUDENT_ID, programmeId: VALID_ACTIVITY_ID },
  ])

  it('accepts a single activity basket item', () => {
    const result = parentOrderSchema.safeParse({ basket: validActivityBasket })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.basket).toHaveLength(1)
    const item = result.data.basket[0]
    expect(item?.studentId).toBe(VALID_STUDENT_ID)
    if (item?.kind === 'activity') {
      expect(item.activityId).toBe(VALID_ACTIVITY_ID)
    }
  })

  it('accepts a single programme basket item', () => {
    const result = parentOrderSchema.safeParse({ basket: validProgrammeBasket })
    expect(result.success).toBe(true)
    if (!result.success) return
    const item = result.data.basket[0]
    if (item?.kind === 'programme') {
      expect(item.programmeId).toBe(VALID_ACTIVITY_ID)
    }
  })

  it('accepts a multi-item basket with mixed kinds', () => {
    const result = parentOrderSchema.safeParse({
      basket: JSON.stringify([
        { kind: 'activity', studentId: VALID_STUDENT_ID, activityId: VALID_ACTIVITY_ID },
        { kind: 'activity', studentId: VALID_STUDENT_ID, activityId: VALID_ACTIVITY_ID_2 },
        { kind: 'programme', studentId: VALID_STUDENT_ID, programmeId: VALID_ACTIVITY_ID },
      ]),
    })
    expect(result.success).toBe(true)
    expect(result.data?.basket).toHaveLength(3)
  })

  it('rejects basket items without a kind field', () => {
    const result = parentOrderSchema.safeParse({
      basket: JSON.stringify([{ studentId: VALID_STUDENT_ID, activityId: VALID_ACTIVITY_ID }]),
    })
    expect(result.success).toBe(false)
  })

  it('rejects basket items with an unknown kind', () => {
    const result = parentOrderSchema.safeParse({
      basket: JSON.stringify([
        { kind: 'other', studentId: VALID_STUDENT_ID, activityId: VALID_ACTIVITY_ID },
      ]),
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty basket array', () => {
    const result = parentOrderSchema.safeParse({ basket: JSON.stringify([]) })
    expect(result.success).toBe(false)
  })

  it('rejects non-JSON basket', () => {
    const result = parentOrderSchema.safeParse({ basket: 'not-json' })
    expect(result.success).toBe(false)
  })

  it('rejects basket that is not an array', () => {
    const result = parentOrderSchema.safeParse({
      basket: JSON.stringify({
        kind: 'activity',
        studentId: VALID_STUDENT_ID,
        activityId: VALID_ACTIVITY_ID,
      }),
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-UUID student ID', () => {
    const result = parentOrderSchema.safeParse({
      basket: JSON.stringify([
        { kind: 'activity', studentId: 'bad', activityId: VALID_ACTIVITY_ID },
      ]),
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-UUID activity ID', () => {
    const result = parentOrderSchema.safeParse({
      basket: JSON.stringify([
        { kind: 'activity', studentId: VALID_STUDENT_ID, activityId: 'bad' },
      ]),
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-UUID programme ID', () => {
    const result = parentOrderSchema.safeParse({
      basket: JSON.stringify([
        { kind: 'programme', studentId: VALID_STUDENT_ID, programmeId: 'bad' },
      ]),
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing basket field', () => {
    const result = parentOrderSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})
