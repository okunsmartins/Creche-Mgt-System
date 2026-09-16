import { describe, it, expect } from 'vitest'
import {
  acceptedAssignmentType,
  isAllowedAssignmentType,
  assignmentKindPhrase,
  formatFileSize,
  safeFilenameBase,
  assignmentStoragePath,
} from '../validate'

describe('assignmentKindPhrase', () => {
  it('reads naturally for each kind', () => {
    expect(assignmentKindPhrase('image')).toBe('a photo')
    expect(assignmentKindPhrase('pdf')).toBe('a PDF')
  })
})

describe('acceptedAssignmentType / isAllowedAssignmentType', () => {
  it('maps images to kind image with a canonical extension', () => {
    expect(acceptedAssignmentType('image/jpeg')).toEqual({ kind: 'image', ext: 'jpg' })
    expect(acceptedAssignmentType('image/png')).toEqual({ kind: 'image', ext: 'png' })
    expect(acceptedAssignmentType('image/heic')).toEqual({ kind: 'image', ext: 'heic' })
  })

  it('maps application/pdf to kind pdf', () => {
    expect(acceptedAssignmentType('application/pdf')).toEqual({ kind: 'pdf', ext: 'pdf' })
  })

  it('rejects anything else', () => {
    expect(acceptedAssignmentType('image/gif')).toBeNull()
    expect(acceptedAssignmentType('application/zip')).toBeNull()
    expect(acceptedAssignmentType('text/html')).toBeNull()
    expect(isAllowedAssignmentType('application/pdf')).toBe(true)
    expect(isAllowedAssignmentType('video/mp4')).toBe(false)
  })
})

describe('formatFileSize', () => {
  it('formats bytes, KB and MB', () => {
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(2048)).toBe('2 KB')
    expect(formatFileSize(2_517_000)).toBe('2.4 MB')
    expect(formatFileSize(15_000_000)).toBe('14 MB')
  })
})

describe('safeFilenameBase', () => {
  it('slugifies and lowercases, dropping the extension', () => {
    expect(safeFilenameBase('My Maths Homework.JPG')).toBe('my-maths-homework')
    expect(safeFilenameBase('page (1).pdf')).toBe('page-1')
  })

  it('falls back to "assignment" when nothing survives', () => {
    expect(safeFilenameBase('***.png')).toBe('assignment')
    expect(safeFilenameBase('')).toBe('assignment')
  })

  it('caps the slug length', () => {
    expect(safeFilenameBase('a'.repeat(100) + '.jpg')).toHaveLength(40)
  })
})

describe('assignmentStoragePath', () => {
  it('namespaces by school then student with a timestamp + slug + ext', () => {
    const path = assignmentStoragePath({
      schoolId: 'sch1',
      studentId: 'stu2',
      originalName: 'Spelling Test.jpeg',
      ext: 'jpg',
      now: 1_700_000_000_000,
    })
    expect(path).toBe('sch1/stu2/1700000000000-spelling-test.jpg')
  })
})
