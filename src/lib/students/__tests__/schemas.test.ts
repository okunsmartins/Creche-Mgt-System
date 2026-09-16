import { describe, it, expect } from 'vitest'
import {
  createStudentSchema,
  updateStudentSchema,
  linkRequestSchema,
  rejectLinkRequestSchema,
  approveLinkRequestSchema,
  adminLinkParentSchema,
} from '../schemas'

const VALID_UUID = '00000000-0000-4000-a000-000000000001'

// ─── createStudentSchema ──────────────────────────────────────────────────────

describe('createStudentSchema', () => {
  const valid = {
    firstName: 'Aoife',
    lastName: 'Murphy',
    classId: VALID_UUID,
    parentFirstName: 'Mary',
    parentLastName: 'Murphy',
    parentEmail: 'mary.murphy@example.com',
  }

  it('accepts valid student + parent data', () => {
    expect(createStudentSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects empty firstName', () => {
    const r = createStudentSchema.safeParse({ ...valid, firstName: '' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors.firstName).toBeDefined()
  })

  it('rejects firstName longer than 50 characters', () => {
    const r = createStudentSchema.safeParse({ ...valid, firstName: 'A'.repeat(51) })
    expect(r.success).toBe(false)
  })

  it('rejects empty lastName', () => {
    const r = createStudentSchema.safeParse({ ...valid, lastName: '' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors.lastName).toBeDefined()
  })

  it('rejects non-UUID classId', () => {
    const r = createStudentSchema.safeParse({ ...valid, classId: 'not-a-uuid' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors.classId).toBeDefined()
  })

  it('rejects missing classId', () => {
    const r = createStudentSchema.safeParse({ ...valid, classId: undefined })
    expect(r.success).toBe(false)
  })

  it('rejects empty parentFirstName', () => {
    const r = createStudentSchema.safeParse({ ...valid, parentFirstName: '' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors.parentFirstName).toBeDefined()
  })

  it('rejects empty parentLastName', () => {
    const r = createStudentSchema.safeParse({ ...valid, parentLastName: '' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors.parentLastName).toBeDefined()
  })

  it('rejects invalid parentEmail', () => {
    const r = createStudentSchema.safeParse({ ...valid, parentEmail: 'not-an-email' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors.parentEmail).toBeDefined()
  })

  it('rejects missing parentEmail', () => {
    const { parentEmail: _ignored, ...withoutEmail } = valid
    const r = createStudentSchema.safeParse(withoutEmail)
    expect(r.success).toBe(false)
  })
})

// ─── updateStudentSchema ──────────────────────────────────────────────────────

describe('updateStudentSchema', () => {
  const valid = {
    studentId: VALID_UUID,
    firstName: 'Seán',
    lastName: "O'Brien",
    classId: VALID_UUID,
  }

  it('accepts valid update data', () => {
    expect(updateStudentSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects invalid studentId', () => {
    const r = updateStudentSchema.safeParse({ ...valid, studentId: 'bad' })
    expect(r.success).toBe(false)
  })

  it('rejects empty firstName', () => {
    const r = updateStudentSchema.safeParse({ ...valid, firstName: '' })
    expect(r.success).toBe(false)
  })
})

// ─── linkRequestSchema ────────────────────────────────────────────────────────

describe('linkRequestSchema', () => {
  it('accepts a valid pupil code', () => {
    expect(linkRequestSchema.safeParse({ pupilCode: 'SB-AM224567' }).success).toBe(true)
  })

  it('accepts all valid charset characters', () => {
    expect(linkRequestSchema.safeParse({ pupilCode: 'SB-ABCDEFGH' }).success).toBe(true)
  })

  it('normalises lowercase input to uppercase and accepts it', () => {
    const r = linkRequestSchema.safeParse({ pupilCode: 'sb-am224567' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.pupilCode).toBe('SB-AM224567')
  })

  it('accepts a per-school prefix (3 chars)', () => {
    expect(linkRequestSchema.safeParse({ pupilCode: 'SPP-AB23CD45' }).success).toBe(true)
  })

  it('accepts a 4-char prefix', () => {
    expect(linkRequestSchema.safeParse({ pupilCode: 'ABCD-AB23CD45' }).success).toBe(true)
  })

  it('rejects a 1-char prefix', () => {
    expect(linkRequestSchema.safeParse({ pupilCode: 'A-AB23CD45' }).success).toBe(false)
  })

  it('rejects a 5-char prefix', () => {
    expect(linkRequestSchema.safeParse({ pupilCode: 'ABCDE-AB23CD45' }).success).toBe(false)
  })

  it('rejects code with forbidden character O', () => {
    expect(linkRequestSchema.safeParse({ pupilCode: 'SB-AO224567' }).success).toBe(false)
  })

  it('rejects code with forbidden character I', () => {
    expect(linkRequestSchema.safeParse({ pupilCode: 'SB-AI224567' }).success).toBe(false)
  })

  it('rejects code with digit 0', () => {
    expect(linkRequestSchema.safeParse({ pupilCode: 'SB-A0224567' }).success).toBe(false)
  })

  it('rejects code with digit 1', () => {
    expect(linkRequestSchema.safeParse({ pupilCode: 'SB-A1224567' }).success).toBe(false)
  })

  it('rejects too-short code', () => {
    expect(linkRequestSchema.safeParse({ pupilCode: 'SB-AM2245' }).success).toBe(false)
  })

  it('rejects too-long code', () => {
    expect(linkRequestSchema.safeParse({ pupilCode: 'SB-AM2245678' }).success).toBe(false)
  })

  it('rejects empty string', () => {
    const r = linkRequestSchema.safeParse({ pupilCode: '' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors.pupilCode).toBeDefined()
  })

  it('rejects code without SB- prefix', () => {
    expect(linkRequestSchema.safeParse({ pupilCode: 'AM22456789' }).success).toBe(false)
  })
})

// ─── rejectLinkRequestSchema ──────────────────────────────────────────────────

describe('rejectLinkRequestSchema', () => {
  const valid = {
    requestId: VALID_UUID,
    rejectionReason: 'Could not verify the relationship.',
  }

  it('accepts valid rejection data', () => {
    expect(rejectLinkRequestSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects empty rejectionReason', () => {
    const r = rejectLinkRequestSchema.safeParse({ ...valid, rejectionReason: '' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors.rejectionReason).toBeDefined()
  })

  it('rejects rejectionReason longer than 500 characters', () => {
    const r = rejectLinkRequestSchema.safeParse({ ...valid, rejectionReason: 'x'.repeat(501) })
    expect(r.success).toBe(false)
  })

  it('rejects invalid requestId', () => {
    const r = rejectLinkRequestSchema.safeParse({ ...valid, requestId: 'not-uuid' })
    expect(r.success).toBe(false)
  })
})

// ─── approveLinkRequestSchema ─────────────────────────────────────────────────

describe('approveLinkRequestSchema', () => {
  it('accepts a valid UUID', () => {
    expect(approveLinkRequestSchema.safeParse({ requestId: VALID_UUID }).success).toBe(true)
  })

  it('rejects a non-UUID string', () => {
    expect(approveLinkRequestSchema.safeParse({ requestId: 'bad-id' }).success).toBe(false)
  })
})

// ─── adminLinkParentSchema ────────────────────────────────────────────────────

describe('adminLinkParentSchema', () => {
  const valid = { studentId: VALID_UUID, parentEmail: 'parent@example.com' }

  it('accepts valid student ID and parent email', () => {
    expect(adminLinkParentSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects invalid studentId', () => {
    const r = adminLinkParentSchema.safeParse({ ...valid, studentId: 'not-a-uuid' })
    expect(r.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const r = adminLinkParentSchema.safeParse({ ...valid, parentEmail: 'not-an-email' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.flatten().fieldErrors.parentEmail).toBeDefined()
  })

  it('rejects empty email', () => {
    const r = adminLinkParentSchema.safeParse({ ...valid, parentEmail: '' })
    expect(r.success).toBe(false)
  })
})
