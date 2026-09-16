import { getResend } from '@/lib/email/client'
import { buildEmailFrom } from '@/lib/email/from'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { formatDate } from '@/lib/utils'
import { formatSlotTime } from './slots'
import type { EmailType } from '@/types/database'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function wrap(schoolName: string, heading: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:20px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;"><div style="max-width:600px;margin:0 auto;">
    <div style="background:#573c9b;padding:24px;border-radius:8px 8px 0 0;">
      <h1 style="color:#ffffff;margin:0;font-size:18px;font-weight:700;">${esc(schoolName)}</h1>
      <p style="color:#c9bdf0;margin:4px 0 0;font-size:13px;">Parent–teacher meetings</p>
    </div>
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
      <h2 style="font-size:16px;font-weight:700;margin:0 0 8px;">${esc(heading)}</h2>
      ${bodyHtml}
    </div>
    <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px;">Automated message from the ${esc(schoolName)} Admin Portal.</p>
  </div></body></html>`
}

async function getSchoolName(schoolId: string, adminClient: AdminClient): Promise<string> {
  const { data } = await adminClient.from('schools').select('name').eq('id', schoolId).maybeSingle()
  return (data as { name: string } | null)?.name ?? 'Your school'
}

/** Send + record in email_notifications (order_id NULL + school_id). */
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
    logger.error('meeting_email_pre_insert_failed', { schoolId, type, error: preErr.message })
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

  if (error) logger.error('meeting_email_failed', { schoolId, subject, error: error.message })
  else logger.info('meeting_email_sent', { schoolId, subject })
}

export interface MeetingEmailData {
  slotDate: string
  startTime: string
  endTime: string
  teacherName: string
  parentName: string
  childName: string
}

function when(d: MeetingEmailData): string {
  return `${formatDate(d.slotDate)}, ${formatSlotTime(d.startTime)}–${formatSlotTime(d.endTime)}`
}

/** On booking: confirm to the parent and notify the teacher. Best-effort. */
export async function sendMeetingBookedEmails(
  schoolId: string,
  recipients: { parentEmail: string | null; teacherEmail: string | null },
  data: MeetingEmailData,
  adminClient: AdminClient,
): Promise<void> {
  try {
    const name = await getSchoolName(schoolId, adminClient)
    const range = when(data)
    if (recipients.parentEmail) {
      const subject = `Meeting confirmed — ${range}`
      const bodyHtml = `<p style="color:#6b7280;font-size:14px;margin:0;">Your meeting with <strong>${esc(data.teacherName)}</strong> about <strong>${esc(data.childName)}</strong> is confirmed for <strong>${esc(range)}</strong>.</p>`
      const text = `${name} — meeting confirmed\n\nYour meeting with ${data.teacherName} about ${data.childName} is confirmed for ${range}.`
      await send(
        schoolId,
        name,
        adminClient,
        recipients.parentEmail,
        'meeting_booked',
        subject,
        wrap(name, 'Meeting confirmed', bodyHtml),
        text,
      )
    }
    if (recipients.teacherEmail) {
      const subject = `New meeting booked — ${range}`
      const bodyHtml = `<p style="color:#6b7280;font-size:14px;margin:0;"><strong>${esc(data.parentName)}</strong> booked a meeting about <strong>${esc(data.childName)}</strong> for <strong>${esc(range)}</strong>.</p>`
      const text = `${name} — new meeting booked\n\n${data.parentName} booked a meeting about ${data.childName} for ${range}.`
      await send(
        schoolId,
        name,
        adminClient,
        recipients.teacherEmail,
        'meeting_booked',
        subject,
        wrap(name, 'New meeting booked', bodyHtml),
        text,
      )
    }
  } catch (err) {
    logger.error('meeting_booked_email_error', {
      schoolId,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
  }
}

/** On cancellation: notify the teacher the slot is free again. Best-effort. */
export async function sendMeetingCancelledEmail(
  schoolId: string,
  teacherEmail: string | null,
  data: MeetingEmailData,
  adminClient: AdminClient,
): Promise<void> {
  if (!teacherEmail) return
  try {
    const name = await getSchoolName(schoolId, adminClient)
    const range = when(data)
    const subject = `Meeting cancelled — ${range}`
    const bodyHtml = `<p style="color:#6b7280;font-size:14px;margin:0;"><strong>${esc(data.parentName)}</strong> cancelled the meeting about <strong>${esc(data.childName)}</strong> that was booked for <strong>${esc(range)}</strong>. The slot is available again.</p>`
    const text = `${name} — meeting cancelled\n\n${data.parentName} cancelled the meeting about ${data.childName} booked for ${range}. The slot is available again.`
    await send(
      schoolId,
      name,
      adminClient,
      teacherEmail,
      'meeting_cancelled',
      subject,
      wrap(name, 'Meeting cancelled', bodyHtml),
      text,
    )
  } catch (err) {
    logger.error('meeting_cancelled_email_error', {
      schoolId,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
  }
}
