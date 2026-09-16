import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendSms, type SmsConfig } from '../client'

const cfg: SmsConfig = {
  accountSid: 'AC123',
  authToken: 'tok',
  messagingServiceSid: 'MG123',
  statusCallbackUrl: null,
}

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

function res(ok: boolean, status: number, body: unknown): Response {
  return { ok, status, json: async () => body } as unknown as Response
}

describe('sendSms', () => {
  it('returns an error and makes no request when unconfigured', async () => {
    const r = await sendSms('+353871234567', 'Hi', null)
    expect(r).toEqual({ ok: false, error: 'SMS is not configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts to the Twilio Messages API and returns the sid on success', async () => {
    fetchMock.mockResolvedValueOnce(res(true, 201, { sid: 'SM_abc' }))
    const r = await sendSms('+353871234567', 'Hello parents', cfg)
    expect(r).toEqual({ ok: true, sid: 'SM_abc' })

    const [url, opts] = fetchMock.mock.calls[0]!
    expect(String(url)).toBe('https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json')
    expect((opts as RequestInit).method).toBe('POST')
    const headers = (opts as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe(`Basic ${Buffer.from('AC123:tok').toString('base64')}`)
    const params = new URLSearchParams((opts as RequestInit).body as string)
    expect(params.get('To')).toBe('+353871234567')
    expect(params.get('MessagingServiceSid')).toBe('MG123')
    expect(params.get('Body')).toBe('Hello parents')
  })

  it('surfaces the Twilio error message on failure', async () => {
    fetchMock.mockResolvedValueOnce(res(false, 400, { message: 'Invalid number', code: 21211 }))
    const r = await sendSms('+353000', 'Hi', cfg)
    expect(r).toEqual({ ok: false, error: 'Invalid number' })
  })
})
