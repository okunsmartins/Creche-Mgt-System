import { describe, it, expect } from 'vitest'
import {
  AISTEAR_THEMES,
  isAistearTheme,
  normaliseThemes,
  themeLabels,
  acceptedImageExt,
  safePhotoBase,
  observationStoragePath,
  validateObservation,
} from '../observations'

describe('Aistear themes', () => {
  it('has the four framework themes', () => {
    expect(AISTEAR_THEMES).toEqual([
      'well_being',
      'identity_belonging',
      'communicating',
      'exploring_thinking',
    ])
    expect(isAistearTheme('communicating')).toBe(true)
    expect(isAistearTheme('numeracy')).toBe(false)
  })

  it('normalises: drops invalid, de-duplicates, canonical order', () => {
    expect(normaliseThemes(['exploring_thinking', 'well_being', 'well_being', 'nope'])).toEqual([
      'well_being',
      'exploring_thinking',
    ])
    expect(normaliseThemes([])).toEqual([])
  })

  it('maps to human labels', () => {
    expect(themeLabels(['communicating', 'well_being'])).toEqual(['Well-being', 'Communicating'])
  })
})

describe('photo attachment helpers', () => {
  it('accepts common image types, rejects others', () => {
    expect(acceptedImageExt('image/jpeg')).toBe('jpg')
    expect(acceptedImageExt('image/png')).toBe('png')
    expect(acceptedImageExt('image/heic')).toBe('heic')
    expect(acceptedImageExt('application/pdf')).toBeNull()
    expect(acceptedImageExt('text/plain')).toBeNull()
  })

  it('slugs filenames safely', () => {
    expect(safePhotoBase('Tommy at the Water Table!.JPG')).toBe('tommy-at-the-water-table')
    expect(safePhotoBase('...')).toBe('photo')
  })

  it('namespaces the storage path by tenant + student', () => {
    const p = observationStoragePath({
      schoolId: 'sch',
      studentId: 'stu',
      originalName: 'Painting.png',
      ext: 'png',
      now: 1000,
    })
    expect(p).toBe('sch/stu/1000-painting.png')
  })
})

describe('validateObservation', () => {
  const base = {
    title: 'Water play',
    learningStory: 'Emma spent 20 minutes pouring and measuring at the water table.',
    observationDate: '2026-10-03',
    themes: ['exploring_thinking'],
  }

  it('accepts a valid observation', () => {
    expect(validateObservation(base).ok).toBe(true)
  })

  it('requires a title, story and a valid date', () => {
    expect(validateObservation({ ...base, title: '  ' }).ok).toBe(false)
    expect(validateObservation({ ...base, learningStory: '' }).ok).toBe(false)
    expect(validateObservation({ ...base, observationDate: '03/10/2026' }).ok).toBe(false)
  })

  it('rejects an over-long title and invalid themes', () => {
    expect(validateObservation({ ...base, title: 'x'.repeat(141) }).ok).toBe(false)
    expect(validateObservation({ ...base, themes: ['well_being', 'bogus'] }).ok).toBe(false)
  })

  it('allows no themes (tagging is optional)', () => {
    expect(validateObservation({ ...base, themes: [] }).ok).toBe(true)
    const { title, learningStory, observationDate } = base
    expect(validateObservation({ title, learningStory, observationDate }).ok).toBe(true)
  })
})
