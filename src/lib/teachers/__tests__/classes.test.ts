import { describe, it, expect } from 'vitest'
import { selectTeacherClass, type TeacherClass } from '../classes'

const classes: TeacherClass[] = [
  { id: 'aaaaaaaa-0000-0000-0000-000000000001', name: 'Junior Infants' },
  { id: 'aaaaaaaa-0000-0000-0000-000000000002', name: 'Senior Infants' },
]

describe('selectTeacherClass', () => {
  it('returns null when the teacher has no classes', () => {
    expect(selectTeacherClass([], 'anything')).toBeNull()
    expect(selectTeacherClass([])).toBeNull()
  })

  it('defaults to the first class when no id is requested', () => {
    expect(selectTeacherClass(classes)).toEqual(classes[0])
  })

  it('returns the requested class when it belongs to the teacher', () => {
    expect(selectTeacherClass(classes, classes[1]!.id)).toEqual(classes[1])
  })

  it('falls back to the first class when the requested id is not theirs', () => {
    expect(selectTeacherClass(classes, 'not-a-class-of-theirs')).toEqual(classes[0])
  })
})
