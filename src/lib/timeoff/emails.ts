import { getResend } from '@/lib/email/client'
import { buildEmailFrom } from '@/lib/email/from'
import { resolveSchoolAdminEmail } from '@/lib/email/send'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logging'
import { formatDate } from '@/lib/utils'
import type { EmailType, TimeOffStatus } from '@/types/database'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

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
      <p style="color:#c9bdf0;margin:4px 0 0;font-size:13px;">Time off</p>
    </div>
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
      <h2 style="font-size:16px;font-weight:700;margin:0 0 8px;">${esc(heading)}</h2>
      ${bodyHtml}
      <div style="margin-top:20px;">
        <a href="${esc(ctaUrl)}" style="display:inline-block;background:#573c9b;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600;">${esc(ctaLabel)}</a>
      </div>
    </div>
    <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px;">Automated message from the ${esc(schoolName)} Admin Portal.</p>
  </div></body></html>`
}

async function getSchoolName(schoolId: string, adminClient: AdminClient): Promise<string> {
  const { data } = await adminClient.from('schools').select('name').eq('id', schoolId).maybeSingle()
  return (data as { name: string } | null)?.name ?? 'Your school'
}

function dateRange(startDate: string, endDate: string): string {
  return endDate !== startDate
    ? `${formatDate(startDate)} – ${formatDate(endDate)}`
    : formatDate(startDate)
}

/** Send + record the email in email_notifications (order_id NULL + school_id). */
async function send(
  schoolId: string,
  schoolName: string,
  adminClient: AdminClient,
  to: string,
  type: EmailType,
  subject: string,
  html: string,
  text: string,
): Promise<void> {
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
    logger.error('time_off_email_pre_insert_failed', { schoolId, type, error: preErr.message })
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

  if (error) logger.error('time_off_email_failed', { schoolId, subject, error: error.message })
  else logger.info('time_off_email_sent', { schoolId, subject })
}

/** Notify the school admin that a teacher submitted a time-off request. */
export async function sendTimeOffRequestedEmail(
  schoolId: string,
  data: { teacherName: string; startDate: string; endDate: string; reason?: string | null },
  adminClient: AdminClient,
): Promise<void> {
  try {
    const to = await resolveSchoolAdminEmail(schoolId, adminClient)
    const name = await getSchoolName(schoolId, adminClient)
    const url = `${serverEnv.appUrl}/admin/time-off`
    const range = dateRange(data.startDate, data.endDate)
    const subject = `Time-off request from ${data.teacherName}`
    const bodyHtml = `<p style="color:#6b7280;font-size:14px;margin:0;">${esc(data.teacherName)} has requested time off for <strong>${esc(range)}</strong>.${data.reason ? ` Reason: ${esc(data.reason)}.` : ''} Please review it in the admin portal.</p>`
    const text = [
      `${name} — time-off request`,
      ``,
      `${data.teacherName} has requested time off for ${range}.`,
      ...(data.reason ? [`Reason: ${data.reason}`] : []),
      ``,
      `Review it: ${url}`,
    ].join('\n')
    await send(
      schoolId,
      name,
      adminClient,
      to,
      'time_off_requested',
      subject,
      wrap(name, 'New time-off request', bodyHtml, url, 'Review request'),
      text,
    )
  } catch (err) {
    logger.error('time_off_requested_email_error', {
      schoolId,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
  }
}

/** Notify the teacher that their request was approved or rejected. */
export async function sendTimeOffReviewedEmail(
  teacherEmail: string,
  schoolId: string,
  data: {
    decision: Extract<TimeOffStatus, 'approved' | 'rejected'>
    startDate: string
    endDate: string
    reviewNote?: string | null
  },
  adminClient: AdminClient,
): Promise<void> {
  try {
    const name = await getSchoolName(schoolId, adminClient)
    const url = `${serverEnv.appUrl}/teacher/time-off`
    const range = dateRange(data.startDate, data.endDate)
    const verb = data.decision === 'approved' ? 'approved' : 'rejected'
    const subject = `Your time-off request was ${verb}`
    const bodyHtml = `<p style="color:#6b7280;font-size:14px;margin:0;">Your time-off request for <strong>${esc(range)}</strong> was <strong>${verb}</strong>.${data.reviewNote ? ` Note: ${esc(data.reviewNote)}.` : ''}</p>`
    const text = [
      `${name} — time-off ${verb}`,
      ``,
      `Your time-off request for ${range} was ${verb}.`,
      ...(data.reviewNote ? [`Note: ${data.reviewNote}`] : []),
      ``,
      `View your requests: ${url}`,
    ].join('\n')
    await send(
      schoolId,
      name,
      adminClient,
      teacherEmail,
      'time_off_reviewed',
      subject,
      wrap(name, `Time-off ${verb}`, bodyHtml, url, 'View your requests'),
      text,
    )
  } catch (err) {
    logger.error('time_off_reviewed_email_error', {
      schoolId,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
  }
}
