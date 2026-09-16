import { describe, it, expect } from 'vitest'
import { canTeacherTargetAudience } from '../recipients'
import type { ParentMessageAudienceInput } from '../schemas'

const classA = '11111111-1111-1111-1111-111111111111'
const classB = '22222222-2222-2222-2222-222222222222'
const studentId = '33333333-3333-3333-3333-333333333333'

describe('canTeacherTargetAudience', () => {
  it('allows a class the teacher is assigned to', () => {
    const audience: ParentMessageAudienceInput = { type: 'class', classId: classA }
    expect(
      canTeacherTargetAudience(audience, { teacherClassIds: [classA], studentClassId: null }),
    ).toBe(true)
  })

  it('blocks a class the teacher is NOT assigned to', () => {
    const audience: ParentMessageAudienceInput = { type: 'class', classId: classB }
    expect(
      canTeacherTargetAudience(audience, { teacherClassIds: [classA], studentClassId: null }),
    ).toBe(false)
  })

  it('allows a pupil whose class the teacher owns', () => {
    const audience: ParentMessageAudienceInput = { type: 'student', studentId }
    expect(
      canTeacherTargetAudience(audience, { teacherClassIds: [classA], studentClassId: classA }),
    ).toBe(true)
  })

  it('blocks a pupil in a class the teacher does not own', () => {
    const audience: ParentMessageAudienceInput = { type: 'student', studentId }
    expect(
      canTeacherTargetAudience(audience, { teacherClassIds: [classA], studentClassId: classB }),
    ).toBe(false)
  })

  it('blocks a pupil whose class is unknown', () => {
    const audience: ParentMessageAudienceInput = { type: 'student', studentId }
    expect(
      canTeacherTargetAudience(audience, { teacherClassIds: [classA], studentClassId: null }),
    ).toBe(false)
  })

  it('always blocks a school-wide blast for teachers', () => {
    const audience: ParentMessageAudienceInput = { type: 'school' }
    expect(
      canTeacherTargetAudience(audience, {
        teacherClassIds: [classA, classB],
        studentClassId: null,
      }),
    ).toBe(false)
  })
})
