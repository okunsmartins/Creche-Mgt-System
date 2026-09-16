import { getResend } from '@/lib/email/client'
import { buildEmailFrom } from '@/lib/email/from'
import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logging'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Email the one-time confirmation link for a "create your portal" request.
 * Returns whether the send succeeded — the caller surfaces a failure to the user
 * (unlike the fire-and-forget tenant notifications, this email IS the flow).
 * Platform sender (no school in scope yet).
 */
export async function sendPortalVerificationEmail(
  to: string,
  token: string,
  contactName?: string | null,
): Promise<boolean> {
  const url = `${serverEnv.appUrl}/get-started/verify?token=${encodeURIComponent(token)}`
  const greeting = contactName?.trim() ? `Hi ${esc(contactName.trim())},` : 'Hi,'
  const subject = 'Confirm your email to create your Skool Bido portal'
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:20px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;"><div style="max-width:600px;margin:0 auto;">
    <div style="background:#573c9b;padding:24px;border-radius:8px 8px 0 0;">
      <h1 style="color:#ffffff;margin:0;font-size:18px;font-weight:700;">Skool Bido</h1>
      <p style="color:#c9bdf0;margin:4px 0 0;font-size:13px;">Create your portal</p>
    </div>
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
      <p style="font-size:14px;margin:0 0 8px;">${greeting}</p>
      <p style="color:#6b7280;font-size:14px;margin:0;">Thanks for your interest in Skool Bido. Please confirm this email address to continue setting up your school portal.</p>
      <div style="margin-top:20px;">
        <a href="${esc(url)}" style="display:inline-block;background:#573c9b;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600;">Confirm my email</a>
      </div>
      <p style="color:#9ca3af;font-size:12px;margin:20px 0 0;">If the button doesn't work, copy and paste this link into your browser:<br>${esc(url)}</p>
      <p style="color:#9ca3af;font-size:12px;margin:12px 0 0;">If you didn't request this, you can safely ignore this email.</p>
    </div>
    <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px;">Automated message from Skool Bido.</p>
  </div></body></html>`
  const text = [
    greeting.replace(/<[^>]+>/g, ''),
    ``,
    `Thanks for your interest in Skool Bido. Please confirm this email address to continue setting up your school portal:`,
    url,
    ``,
    `If you didn't request this, you can safely ignore this email.`,
  ].join('\n')

  try {
    const resend = getResend()
    // Platform-level email (no tenant): send as the product brand, not the
    // tenant-fallback EMAIL_FROM_NAME.
    const { error } = await resend.emails.send({
      from: buildEmailFrom('Skool Bido'),
      to,
      subject,
      html,
      text,
    })
    if (error) {
      logger.error('portal_verification_email_failed', { error: error.message })
      return false
    }
    logger.info('portal_verification_email_sent', {})
    return true
  } catch (err) {
    logger.error('portal_verification_email_error', {
      error: err instanceof Error ? err.message : 'Unknown error',
    })
    return false
  }
}
