import { describe, expect, it } from 'vitest'
import { parseWebsiteEnquiry } from './website'

function fd(entries: [string, string][]): FormData {
  const f = new FormData()
  for (const [k, v] of entries) f.append(k, v)
  return f
}

const base: [string, string][] = [
  ['parentName', '  Sarah Byrne '],
  ['parentEmail', 'sarah@example.com'],
]

describe('parseWebsiteEnquiry', () => {
  it('accepts a minimal enquiry and trims fields', () => {
    const r = parseWebsiteEnquiry(fd(base))
    expect(r).toEqual({
      ok: true,
      enquiry: {
        parentName: 'Sarah Byrne',
        parentEmail: 'sarah@example.com',
        parentPhone: null,
        childFirstName: null,
        childDob: null,
        desiredStartDate: null,
        days: [],
        wantsVisit: false,
        message: null,
        notes: null,
      },
    })
  })

  it('requires a name and a valid email', () => {
    expect(parseWebsiteEnquiry(fd([['parentEmail', 'a@b.ie']]))).toMatchObject({ ok: false })
    expect(
      parseWebsiteEnquiry(
        fd([
          ['parentName', 'A'],
          ['parentEmail', 'not-an-email'],
        ]),
      ),
    ).toMatchObject({ ok: false })
  })

  it('treats a filled honeypot as spam', () => {
    expect(parseWebsiteEnquiry(fd([...base, ['website', 'http://spam']]))).toEqual({ ok: 'spam' })
  })

  it('rejects impossible dates', () => {
    expect(parseWebsiteEnquiry(fd([...base, ['childDob', '2024-02-30']]))).toMatchObject({
      ok: false,
    })
    expect(parseWebsiteEnquiry(fd([...base, ['desiredStartDate', '01/09/2026']]))).toMatchObject({
      ok: false,
    })
  })

  it('folds days, visit request and message into notes, ignoring unknown days', () => {
    const r = parseWebsiteEnquiry(
      fd([
        ...base,
        ['days', 'Mon'],
        ['days', 'Thu'],
        ['days', 'Sun'],
        ['wantsVisit', 'on'],
        ['message', 'She has a nut allergy.'],
        ['childDob', '2024-03-15'],
      ]),
    )
    expect(r).toMatchObject({
      ok: true,
      enquiry: {
        childDob: '2024-03-15',
        notes: 'Days needed: Mon, Thu\nWould like to visit the crèche.\nShe has a nut allergy.',
      },
    })
  })
})
