import { describe, it, expect } from 'vitest'
import {
  COLLECTOR_STATUSES,
  COLLECTOR_RELATIONSHIPS,
  isCollectorStatus,
  isCollectorRelationship,
  validateCollector,
  canTransitionCollector,
} from '../collectors'

describe('collector catalog guards', () => {
  it('recognises valid statuses and relationships', () => {
    expect(isCollectorStatus('approved')).toBe(true)
    expect(isCollectorStatus('nope')).toBe(false)
    expect(isCollectorRelationship('grandparent')).toBe(true)
    expect(isCollectorRelationship('cousin')).toBe(false)
  })

  it('has a label for every status and relationship', () => {
    expect(COLLECTOR_STATUSES.length).toBe(4)
    expect(COLLECTOR_RELATIONSHIPS).toContain('childminder')
  })
})

describe('validateCollector', () => {
  it('requires a full name', () => {
    const r = validateCollector({ fullName: '  ', relationship: 'parent' })
    expect(r.ok).toBe(false)
  })

  it('requires a valid relationship', () => {
    const r = validateCollector({ fullName: 'Mary Ryan', relationship: 'cousin' })
    expect(r.ok).toBe(false)
  })

  it('accepts a valid collector with no phone', () => {
    expect(validateCollector({ fullName: 'Mary Ryan', relationship: 'grandparent' }).ok).toBe(true)
  })

  it('accepts a plausible phone', () => {
    expect(
      validateCollector({
        fullName: 'Mary Ryan',
        relationship: 'parent',
        phone: '+353 86 123 4567',
      }).ok,
    ).toBe(true)
  })

  it('rejects a nonsense phone', () => {
    expect(
      validateCollector({ fullName: 'Mary Ryan', relationship: 'parent', phone: '12' }).ok,
    ).toBe(false)
    expect(
      validateCollector({ fullName: 'Mary Ryan', relationship: 'parent', phone: 'call me' }).ok,
    ).toBe(false)
  })
})

describe('canTransitionCollector', () => {
  it('allows review decisions from pending', () => {
    expect(canTransitionCollector('pending', 'approved')).toBe(true)
    expect(canTransitionCollector('pending', 'declined')).toBe(true)
  })

  it('allows revoking an approved collector and reconsidering a declined one', () => {
    expect(canTransitionCollector('approved', 'revoked')).toBe(true)
    expect(canTransitionCollector('declined', 'approved')).toBe(true)
    expect(canTransitionCollector('revoked', 'approved')).toBe(true)
  })

  it('forbids no-op and illegal moves', () => {
    expect(canTransitionCollector('approved', 'approved')).toBe(false)
    expect(canTransitionCollector('approved', 'pending')).toBe(false)
    expect(canTransitionCollector('declined', 'revoked')).toBe(false)
  })
})
