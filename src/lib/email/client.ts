import { Resend } from 'resend'
import { serverEnv } from '@/lib/env'

let _resend: Resend | null = null

export function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(serverEnv.resendApiKey)
  }
  return _resend
}
