import { describe, it, expect } from 'vitest'
import {
  slugifyKey,
  isSensitiveKey,
  validateCustomFieldValue,
  canPromoteTo,
  customFieldDefinitionSchema,
  type CustomFieldDefinition,
} from '../schema'

const def = (over: Partial<CustomFieldDefinition>): CustomFieldDefinition => ({
  entity: 'child',
  key: 'field',
  label: 'Field',
  fieldType: 'text',
  ...over,
})

describe('slugifyKey', () => {
  it('produces safe snake_case keys', () => {
    expect(slugifyKey('Bus Route')).toBe('bus_route')
    expect(slugifyKey('  Locker #  ')).toBe('locker')
    expect(slugifyKey('Sunscreen consent?')).toBe('sunscreen_consent')
  })
  it('prefixes a leading digit and never returns empty', () => {
    expect(slugifyKey('2024 cohort')).toBe('f_2024_cohort')
    expect(slugifyKey('***')).toBe('field')
  })
})

describe('isSensitiveKey', () => {
  it('flags PPSN and other sensitive identifiers', () => {
    for (const s of [
      'PPSN',
      'pps number',
      'Passport No',
      'IBAN',
      'Card CVV',
      'Password',
      'Sort Code',
    ]) {
      expect(isSensitiveKey(s)).toBe(true)
    }
  })
  it('allows ordinary custom labels', () => {
    for (const s of ['Bus Route', 'Locker Number', 'Sunscreen consent']) {
      expect(isSensitiveKey(s)).toBe(false)
    }
  })
})

describe('validateCustomFieldValue', () => {
  it('enforces required vs blank', () => {
    expect(validateCustomFieldValue(def({ required: true }), '')).toEqual({
      ok: false,
      error: 'Field is required',
    })
    expect(validateCustomFieldValue(def({ required: false }), '')).toEqual({
      ok: true,
      value: null,
    })
  })

  it('coerces numbers and rejects non-numbers', () => {
    expect(validateCustomFieldValue(def({ fieldType: 'number' }), '12.5')).toEqual({
      ok: true,
      value: 12.5,
    })
    expect(validateCustomFieldValue(def({ fieldType: 'number' }), 'abc').ok).toBe(false)
  })

  it('validates dates in ISO or DD/MM/YYYY', () => {
    expect(validateCustomFieldValue(def({ fieldType: 'date' }), '2026-09-17').ok).toBe(true)
    expect(validateCustomFieldValue(def({ fieldType: 'date' }), '17/09/2026').ok).toBe(true)
    expect(validateCustomFieldValue(def({ fieldType: 'date' }), 'Sept 17').ok).toBe(false)
  })

  it('parses checkbox truthy/falsey text', () => {
    expect(validateCustomFieldValue(def({ fieldType: 'checkbox' }), 'Yes')).toEqual({
      ok: true,
      value: true,
    })
    expect(validateCustomFieldValue(def({ fieldType: 'checkbox' }), 'no')).toEqual({
      ok: true,
      value: false,
    })
    expect(validateCustomFieldValue(def({ fieldType: 'checkbox' }), 'maybe').ok).toBe(false)
  })

  it('enforces option membership for dropdown/radio', () => {
    const d = def({ fieldType: 'dropdown', options: ['Bus A', 'Bus B'] })
    expect(validateCustomFieldValue(d, 'Bus A')).toEqual({ ok: true, value: 'Bus A' })
    expect(validateCustomFieldValue(d, 'Bus C').ok).toBe(false)
  })

  it('accepts a valid multiselect subset and rejects unknowns', () => {
    const d = def({ fieldType: 'multiselect', options: ['AM', 'PM', 'Lunch'] })
    expect(validateCustomFieldValue(d, 'AM, Lunch')).toEqual({ ok: true, value: ['AM', 'Lunch'] })
    expect(validateCustomFieldValue(d, ['AM', 'Dinner']).ok).toBe(false)
  })
})

describe('canPromoteTo (type contract)', () => {
  it('only lets a number field feed billing', () => {
    expect(canPromoteTo(def({ fieldType: 'number' }), 'billing').ok).toBe(true)
    expect(canPromoteTo(def({ fieldType: 'text' }), 'billing').ok).toBe(false)
  })
  it('requires an enum/checkbox for filters', () => {
    expect(canPromoteTo(def({ fieldType: 'dropdown', options: ['x'] }), 'filter').ok).toBe(true)
    expect(canPromoteTo(def({ fieldType: 'number' }), 'filter').ok).toBe(false)
  })
  it('requires a date/enum for compliance', () => {
    expect(canPromoteTo(def({ fieldType: 'date' }), 'compliance').ok).toBe(true)
    expect(canPromoteTo(def({ fieldType: 'text' }), 'compliance').ok).toBe(false)
  })
  it('blocks sensitive fields from messaging and reporting', () => {
    const s = def({ label: 'PPSN', key: 'ppsn', fieldType: 'text' })
    expect(canPromoteTo(s, 'messaging').ok).toBe(false)
    expect(canPromoteTo(s, 'reporting').ok).toBe(false)
  })
  it('allows any typed field into reporting when not sensitive', () => {
    expect(canPromoteTo(def({ fieldType: 'text' }), 'reporting').ok).toBe(true)
  })
})

describe('customFieldDefinitionSchema', () => {
  it('accepts a valid dropdown definition', () => {
    const r = customFieldDefinitionSchema.safeParse({
      entity: 'child',
      label: 'Bus Route',
      fieldType: 'dropdown',
      options: ['Bus A', 'Bus B'],
    })
    expect(r.success).toBe(true)
  })

  it('rejects a dropdown with no options', () => {
    const r = customFieldDefinitionSchema.safeParse({
      entity: 'child',
      label: 'Bus Route',
      fieldType: 'dropdown',
      options: [],
    })
    expect(r.success).toBe(false)
  })

  it('rejects a sensitive label', () => {
    const r = customFieldDefinitionSchema.safeParse({
      entity: 'child',
      label: 'PPSN',
      fieldType: 'text',
    })
    expect(r.success).toBe(false)
  })
})
