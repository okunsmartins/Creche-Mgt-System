import { describe, expect, it } from 'vitest'
import { buildCrecheNotificationEmail, buildParentConfirmationEmail } from './website-emails'
import type { WebsiteEnquiry } from './website'

const base: WebsiteEnquiry = {
  parentName: 'Sarah Byrne',
  parentEmail: 'sarah@example.com',
  parentPhone: '087 123 4567',
  childFirstName: 'Emma',
  childDob: '2024-03-15',
  desiredStartDate: '2026-11-03',
  days: ['Mon', 'Thu'],
  wantsVisit: true,
  message: 'She has a nut allergy.',
  notes: 'ignored by the emails',
}

describe('buildParentConfirmationEmail', () => {
  it('thanks the parent by first name, branded with the crèche, echoing their details', () => {
    const m = buildParentConfirmationEmail('Little Meadows Crèche', base, 'hello@meadows.ie')
    expect(m.subject).toBe('Thanks for your enquiry — Little Meadows Crèche')
    expect(m.html).toContain('Hi Sarah,')
    expect(m.html).toContain('Little Meadows Crèche')
    expect(m.html).toContain("Emma's enquiry")
    expect(m.html).toContain('15 March 2024')
    expect(m.html).toContain('Mon, Thu')
    expect(m.html).toContain('You asked to visit')
    expect(m.html).toContain('mailto:hello@meadows.ie')
    expect(m.text).toContain('She has a nut allergy.')
    // Contact details the parent typed aren't echoed back to them.
    expect(m.html).not.toContain('087 123 4567')
  })

  it('escapes anything the family typed', () => {
    const m = buildParentConfirmationEmail(
      'Crèche',
      { ...base, parentName: '<b>x</b>', message: '<script>alert(1)</script>' },
      null,
    )
    expect(m.html).not.toContain('<script>')
    expect(m.html).not.toContain('<b>x</b>')
    expect(m.html).toContain('&lt;script&gt;')
    expect(m.text).toContain('Just reply to this email')
  })

  it('reads naturally with minimal details', () => {
    const m = buildParentConfirmationEmail(
      'Crèche',
      {
        ...base,
        childFirstName: null,
        childDob: null,
        desiredStartDate: null,
        days: [],
        wantsVisit: false,
        message: null,
      },
      null,
    )
    expect(m.html).toContain('received your enquiry')
    expect(m.html).not.toContain('What you told us')
    expect(m.html).not.toContain('You asked to visit')
  })
})

describe('buildCrecheNotificationEmail', () => {
  it('gives the team every contact detail and flags a visit request', () => {
    const m = buildCrecheNotificationEmail('Little Meadows Crèche', base)
    expect(m.subject).toBe('New visit request from Sarah Byrne')
    expect(m.html).toContain('sarah@example.com')
    expect(m.html).toContain('087 123 4567')
    expect(m.html).toContain('Enquiries')
    expect(buildCrecheNotificationEmail('X', { ...base, wantsVisit: false }).subject).toBe(
      'New waiting-list enquiry from Sarah Byrne',
    )
  })
})
