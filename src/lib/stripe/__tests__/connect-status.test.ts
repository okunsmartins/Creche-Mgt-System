import { describe, it, expect } from 'vitest'
import { connectStatus, type SchoolConnectFields } from '../connect-status'

const fields = (partial: Partial<SchoolConnectFields>): SchoolConnectFields => ({
  stripe_connect_account_id: null,
  stripe_connect_charges_enabled: false,
  stripe_connect_details_submitted: false,
  ...partial,
})

describe('connectStatus', () => {
  it('no row → not_started', () => {
    expect(connectStatus(null)).toBe('not_started')
  })

  it('no account id → not_started (even if flags somehow set)', () => {
    expect(connectStatus(fields({ stripe_connect_charges_enabled: true }))).toBe('not_started')
  })

  it('account exists but charges not enabled → pending', () => {
    expect(
      connectStatus(
        fields({ stripe_connect_account_id: 'acct_1', stripe_connect_charges_enabled: false }),
      ),
    ).toBe('pending')
  })

  it('account exists, details submitted, not yet chargeable → pending', () => {
    expect(
      connectStatus(
        fields({
          stripe_connect_account_id: 'acct_1',
          stripe_connect_details_submitted: true,
          stripe_connect_charges_enabled: false,
        }),
      ),
    ).toBe('pending')
  })

  it('charges enabled → active', () => {
    expect(
      connectStatus(
        fields({ stripe_connect_account_id: 'acct_1', stripe_connect_charges_enabled: true }),
      ),
    ).toBe('active')
  })
})
