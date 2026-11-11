import { describe, it, expect } from 'vitest'
import { updatePasswordErrorMessage } from '../password-errors'

describe('updatePasswordErrorMessage', () => {
  it('explains a reused password instead of blaming the link', () => {
    const msg = updatePasswordErrorMessage({ code: 'same_password' })
    expect(msg).toMatch(/different from your current password/)
    expect(msg).not.toMatch(/expired/)
  })

  it('explains a weak password', () => {
    expect(updatePasswordErrorMessage({ code: 'weak_password' })).toMatch(/too weak/)
  })

  it('says the link expired when the reset session is gone', () => {
    for (const code of [
      'session_not_found',
      'session_expired',
      'refresh_token_not_found',
      'refresh_token_already_used',
    ]) {
      expect(updatePasswordErrorMessage({ code })).toMatch(/expired or has already been used/)
    }
    expect(updatePasswordErrorMessage({ name: 'AuthSessionMissingError' })).toMatch(
      /expired or has already been used/,
    )
  })

  it('handles rate limiting', () => {
    expect(updatePasswordErrorMessage({ code: 'over_request_rate_limit' })).toMatch(/Too many/)
  })

  it('falls back to a neutral message for anything else', () => {
    const msg = updatePasswordErrorMessage({ code: 'unexpected_failure' })
    expect(msg).toMatch(/couldn't update your password/)
    expect(updatePasswordErrorMessage({})).toBe(msg)
  })
})
