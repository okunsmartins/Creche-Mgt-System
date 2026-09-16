import { getResend } from '@/lib/email/client'
import { buildEmailFrom } from '@/lib/email/from'
import { resolveSchoolAdminEmail } from '@/lib/email/send'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logging'
import type { EmailType } from '@/types/database'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

// Subscription (dunning/lifecycle) emails are sent via Resend AND recorded in
// `email_notifications` with a null order_id + the school_id (migrations 041/042
// added the subscription email_type values and the nullable order_id + school_id).

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function wrap(
  schoolName: string,
  heading: string,
  bodyHtml: string,
  ctaUrl: string,
  ctaLabel: string,
): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:20px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;"><div style="max-width:600px;margin:0 auto;">
    <div style="background:#573c9b;padding:24px;border-radius:8px 8px 0 0;">
      <h1 style="color:#ffffff;margin:0;font-size:18px;font-weight:700;">${esc(schoolName)}</h1>
      <p style="color:#c9bdf0;margin:4px 0 0;font-size:13px;">Subscription</p>
    </div>
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
      <h2 style="font-size:16px;font-weight:700;margin:0 0 8px;">${esc(heading)}</h2>
      ${bodyHtml}
      <div style="margin-top:20px;">
        <a href="${esc(ctaUrl)}" style="display:inline-block;background:#573c9b;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600;">${esc(ctaLabel)}</a>
      </div>
    </div>
    <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px;">This is an automated message from the ${esc(schoolName)} Admin Portal.</p>
  </div></body></html>`
}

async function getSchoolName(schoolId: string, adminClient: AdminClient): Promise<string> {
  const { data } = await adminClient.from('schools').select('name').eq('id', schoolId).maybeSingle()
  return (data as { name: string } | null)?.name ?? 'Your school'
}

async function send(
  schoolId: string,
  schoolName: string,
  adminClient: AdminClient,
  type: EmailType,
  subject: string,
  html: string,
  text: string,
): Promise<void> {
  const to = await resolveSchoolAdminEmail(schoolId, adminClient)

  // Record the attempt before sending so it is always logged (mirrors order emails).
  let notifId: string | null = null
  const { data: notifRow, error: preErr } = await adminClient
    .from('email_notifications')
    .insert({
      order_id: null,
      school_id: schoolId,
      type,
      recipient_email: to,
      subject,
      status: 'pending' as const,
      last_attempted_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (preErr) {
    logger.error('subscription_email_pre_insert_failed', { schoolId, type, error: preErr.message })
  } else {
    notifId = (notifRow as { id: string } | null)?.id ?? null
  }

  const resend = getResend()
  const { data, error } = await resend.emails.send({
    from: buildEmailFrom(schoolName),
    to,
    subject,
    html,
    text,
  })

  const outcome = {
    status: error ? ('failed' as const) : ('sent' as const),
    provider_message_id: error ? null : (data?.id ?? null),
    failure_details: error ? error.message : null,
    sent_at: error ? null : new Date().toISOString(),
  }
  if (notifId) {
    await adminClient.from('email_notifications').update(outcome).eq('id', notifId)
  } else {
    // pre-insert failed; record the outcome as a new row
    await adminClient.from('email_notifications').insert({
      order_id: null,
      school_id: schoolId,
      type,
      recipient_email: to,
      subject,
      ...outcome,
      last_attempted_at: new Date().toISOString(),
    })
  }

  if (error) {
    logger.error('subscription_email_failed', { schoolId, subject, error: error.message })
  } else {
    logger.info('subscription_email_sent', { schoolId, subject })
  }
}

/** invoice.payment_failed — tell the admin a renewal payment failed (grace period running). */
export async function sendSubscriptionPaymentFailedEmail(
  schoolId: string,
  adminClient: AdminClient,
): Promise<void> {
  try {
    const name = await getSchoolName(schoolId, adminClient)
    const url = `${serverEnv.appUrl}/admin/subscription`
    const subject = `Action required — ${name} subscription payment failed`
    const bodyHtml = `<p style="color:#6b7280;font-size:14px;margin:0;">We couldn't process the latest payment for your Pro subscription. Your Pro features remain active for a short grace period. Please update your payment method to avoid losing access.</p>`
    const text = [
      `${name} — subscription payment failed`,
      ``,
      `We couldn't process the latest payment for your Pro subscription.`,
      `Your Pro features remain active for a short grace period.`,
      `Update your payment method: ${url}`,
    ].join('\n')
    await send(
      schoolId,
      name,
      adminClient,
      'subscription_payment_failed',
      subject,
      wrap(name, 'Subscription payment failed', bodyHtml, url, 'Update payment method'),
      text,
    )
  } catch (err) {
    logger.error('subscription_payment_failed_email_error', {
      schoolId,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
  }
}

/** customer.subscription.deleted — tell the admin their Pro subscription has ended. */
export async function sendSubscriptionEndedEmail(
  schoolId: string,
  adminClient: AdminClient,
): Promise<void> {
  try {
    const name = await getSchoolName(schoolId, adminClient)
    const url = `${serverEnv.appUrl}/pricing`
    const subject = `${name} Pro subscription has ended`
    const bodyHtml = `<p style="color:#6b7280;font-size:14px;margin:0;">Your Pro subscription has ended and Pro features are now disabled. Your core payment features continue to work on the free plan. You can re-subscribe any time.</p>`
    const text = [
      `${name} — Pro subscription ended`,
      ``,
      `Your Pro subscription has ended and Pro features are now disabled.`,
      `Your core payment features continue on the free plan.`,
      `Re-subscribe any time: ${url}`,
    ].join('\n')
    await send(
      schoolId,
      name,
      adminClient,
      'subscription_ended',
      subject,
      wrap(name, 'Your Pro subscription has ended', bodyHtml, url, 'View plans'),
      text,
    )
  } catch (err) {
    logger.error('subscription_ended_email_error', {
      schoolId,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
  }
}
