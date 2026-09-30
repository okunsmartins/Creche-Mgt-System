import { describe, it, expect } from 'vitest'
import { isDailyRecordType, validateDailyRecord, DAILY_RECORD_TYPES } from '../records'

describe('daily record types', () => {
  it('recognises the five types', () => {
    expect(DAILY_RECORD_TYPES).toEqual(['sleep', 'nappy', 'meal', 'incident', 'medication'])
    expect(isDailyRecordType('sleep')).toBe(true)
    expect(isDailyRecordType('nappy')).toBe(true)
    expect(isDailyRecordType('nonsense')).toBe(false)
  })
})

describe('validateDailyRecord', () => {
  it('rejects unknown type', () => {
    expect(validateDailyRecord({ type: 'x', note: 'hi' })).toEqual({
      ok: false,
      error: 'Choose a record type.',
    })
  })
  it('sleep/nappy/meal accept an empty note', () => {
    expect(validateDailyRecord({ type: 'sleep', note: '' }).ok).toBe(true)
    expect(validateDailyRecord({ type: 'meal', note: '' }).ok).toBe(true)
  })
  it('incident & medication require a note', () => {
    expect(validateDailyRecord({ type: 'incident', note: '  ' }).ok).toBe(false)
    expect(validateDailyRecord({ type: 'medication', note: '' }).ok).toBe(false)
    expect(validateDailyRecord({ type: 'incident', note: 'bumped knee' }).ok).toBe(true)
  })
  it('rejects an over-long note', () => {
    expect(validateDailyRecord({ type: 'meal', note: 'x'.repeat(2001) }).ok).toBe(false)
  })
})
