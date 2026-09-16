import { getResend } from '@/lib/email/client'
import { buildEmailFrom } from '@/lib/email/from'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logging'
import { assignmentKindPhrase } from './validate'
import type { AssignmentFileKind, EmailType } from '@/types/database'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function wrap(schoolName: string, heading: string, bodyHtml: string, ctaUrl: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:20px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;"><div style="max-width:600px;margin:0 auto;">
    <div style="background:#573c9b;padding:24px;border-radius:8px 8px 0 0;">
      <h1 style="color:#ffffff;margin:0;font-size:18px;font-weight:700;">${esc(schoolName)}</h1>
      <p style="color:#c9bdf0;margin:4px 0 0;font-size:13px;">Assignments</p>
    </div>
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
      <h2 style="font-size:16px;font-weight:700;margin:0 0 8px;">${esc(heading)}</h2>
      ${bodyHtml}
      <div style="margin-top:20px;">
        <a href="${esc(ctaUrl)}" style="display:inline-block;background:#573c9b;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600;">View assignments</a>
      </div>
    </div>
    <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px;">Automated message from the ${esc(schoolName)} Teacher Portal.</p>
  </div></body></html>`
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
    logger.error('assignment_email_pre_insert_failed', { schoolId, type, error: preErr.message })
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

  if (error) logger.error('assignment_email_failed', { schoolId, subject, error: error.message })
  else logger.info('assignment_email_sent', { schoolId, subject })
}

type StudentTeacherRow = {
  first_name: string
  last_name: string
  classes: {
    name: string
    teachers: {
      email: string | null
      display_name: string | null
      first_name: string
      last_name: string
      is_active: boolean
    } | null
  } | null
}

/**
 * Notify the pupil's class teacher that a parent uploaded a new assignment.
 * Best-effort: resolves the class teacher from the student; silently no-ops when
 * the pupil has no class, no assigned teacher, or the teacher has no email.
 * Never throws — a failed notification must not fail the upload.
 */
export async function sendAssignmentUploadedEmail(
  schoolId: string,
  studentId: string,
  adminClient: AdminClient,
  data: { title?: string | null; uploaderName?: string | null; fileKind: AssignmentFileKind },
): Promise<void> {
  try {
    const { data: row } = await adminClient
      .from('students')
      .select(
        'first_name, last_name, classes(name, teachers(email, display_name, first_name, last_name, is_active))',
      )
      .eq('id', studentId)
      .eq('school_id', schoolId)
      .maybeSingle()
    const student = row as StudentTeacherRow | null
    const teacher = student?.classes?.teachers ?? null
    if (!student || !teacher || !teacher.is_active || !teacher.email) return

    const { data: schoolRow } = await adminClient
      .from('schools')
      .select('name')
      .eq('id', schoolId)
      .maybeSingle()
    const schoolName = (schoolRow as { name: string } | null)?.name ?? 'Your school'

    const studentName = `${student.first_name} ${student.last_name}`.trim()
    const className = student.classes?.name ?? null
    const uploader = data.uploaderName?.trim() || 'A parent'
    const kind = assignmentKindPhrase(data.fileKind)
    const url = `${serverEnv.appUrl}/teacher/assignments`

    const subject = `New assignment for ${studentName}`
    const bodyHtml = `<p style="color:#6b7280;font-size:14px;margin:0;">${esc(uploader)} uploaded ${kind} for <strong>${esc(studentName)}</strong>${className ? ` (${esc(className)})` : ''}.${data.title ? ` Title: “${esc(data.title)}”.` : ''} You can view it in the teacher portal.</p>`
    const text = [
      `${schoolName} — new assignment`,
      ``,
      `${uploader} uploaded ${kind} for ${studentName}${className ? ` (${className})` : ''}.`,
      ...(data.title ? [`Title: ${data.title}`] : []),
      ``,
      `View it: ${url}`,
    ].join('\n')

    await send(
      schoolId,
      schoolName,
      adminClient,
      teacher.email,
      'assignment_uploaded',
      subject,
      wrap(schoolName, 'New assignment uploaded', bodyHtml, url),
      text,
    )
  } catch (err) {
    logger.error('assignment_uploaded_email_error', {
      schoolId,
      studentId,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
  }
}
