import { describe, it, expect } from 'vitest'
import { lockReasonFrom, lockedBannerFor } from '../locked-banner'

const admin = { roles: ['school_admin'], schoolId: 's1', schoolName: 'Little Acorns' }
const teacher = { roles: ['teacher'], schoolId: 's1', schoolName: 'Little Acorns' }
const parent = { roles: [], schoolId: 's1', schoolName: 'Little Acorns' }

describe('lockReasonFrom', () => {
  it('reads ?reason= and treats the older ?locked= as trial ended', () => {
    expect(lockReasonFrom({ reason: 'trial_ended' })).toBe('trial_ended')
    expect(lockReasonFrom({ reason: 'start_trial' })).toBe('start_trial')
    expect(lockReasonFrom({ locked: 'csv_import' })).toBe('trial_ended')
    expect(lockReasonFrom({ reason: 'anything-else' })).toBeNull()
    expect(lockReasonFrom({})).toBeNull()
  })
})

describe('lockedBannerFor', () => {
  it('no banner on a plain visit to /pricing', () => {
    expect(lockedBannerFor({ reason: null, user: admin, schoolHasAccess: false })).toEqual({
      kind: 'none',
    })
  })

  it('signed out: the generic message, no crèche name', () => {
    expect(lockedBannerFor({ reason: 'trial_ended', user: null, schoolHasAccess: false })).toEqual({
      kind: 'generic',
      reason: 'trial_ended',
    })
  })

  it('admin of a locked crèche: its name + subscribe', () => {
    expect(lockedBannerFor({ reason: 'trial_ended', user: admin, schoolHasAccess: false })).toEqual(
      { kind: 'admin', reason: 'trial_ended', schoolName: 'Little Acorns' },
    )
    const finance = { ...admin, roles: ['finance_admin'] }
    expect(
      lockedBannerFor({ reason: 'trial_ended', user: finance, schoolHasAccess: false }).kind,
    ).toBe('admin')
  })

  it('staff and parents get the name but no subscribe', () => {
    for (const user of [teacher, parent]) {
      expect(lockedBannerFor({ reason: 'trial_ended', user, schoolHasAccess: false })).toEqual({
        kind: 'member',
        reason: 'trial_ended',
        schoolName: 'Little Acorns',
      })
    }
  })

  it('a crèche that is no longer locked sees no banner (stale link)', () => {
    expect(lockedBannerFor({ reason: 'trial_ended', user: admin, schoolHasAccess: true })).toEqual({
      kind: 'none',
    })
  })

  it('falls back to "Your crèche" when the name is missing', () => {
    const noName = { ...admin, schoolName: '  ' }
    expect(
      lockedBannerFor({ reason: 'trial_ended', user: noName, schoolHasAccess: false }),
    ).toEqual({ kind: 'admin', reason: 'trial_ended', schoolName: 'Your crèche' })
  })
})
