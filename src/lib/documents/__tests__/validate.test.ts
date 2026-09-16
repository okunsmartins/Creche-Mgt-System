import { describe, it, expect } from 'vitest'
import { isDocumentCategory, documentStoragePath, CATEGORY_LABEL } from '../validate'

describe('isDocumentCategory', () => {
  it('accepts the two known categories only', () => {
    expect(isDocumentCategory('test_result')).toBe(true)
    expect(isDocumentCategory('report_card')).toBe(true)
    expect(isDocumentCategory('assignment')).toBe(false)
    expect(isDocumentCategory('')).toBe(false)
  })
})

describe('CATEGORY_LABEL', () => {
  it('has a human label per category', () => {
    expect(CATEGORY_LABEL.test_result).toBe('Test result')
    expect(CATEGORY_LABEL.report_card).toBe('Report card')
  })
})

describe('documentStoragePath', () => {
  it('namespaces by school/student/category with a timestamp + slug + ext', () => {
    expect(
      documentStoragePath({
        schoolId: 'sch1',
        studentId: 'stu2',
        category: 'report_card',
        originalName: 'Term 1 Report.PDF',
        ext: 'pdf',
        now: 1_700_000_000_000,
      }),
    ).toBe('sch1/stu2/report_card/1700000000000-term-1-report.pdf')
  })
})
