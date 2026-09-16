import 'server-only'
import { getResend } from '@/lib/email/client'
import { buildEmailFrom } from '@/lib/email/from'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logging'
import { dueReminderDate } from './validate'
import type { PermissionSlipAudience } from '@/types/database'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function reminderEmail(
  schoolName: string,
  title: string,
  dueDate: string,
  url: string,
): { subject: string; html: string; text: string } {
  const subject = `Reminder: please respond to “${title}”`
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:20px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;"><div style="max-width:600px;margin:0 auto;">
    <div style="background:#573c9b;padding:24px;border-radius:8px 8px 0 0;">
      <h1 style="color:#ffffff;margin:0;font-size:18px;font-weight:700;">${esc(schoolName)}</h1>
      <p style="color:#c9bdf0;margin:4px 0 0;font-size:13px;">Permission slip reminder</p>
    </div>
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
      <h2 style="font-size:16px;font-weight:700;margin:0 0 8px;">${esc(title)}</h2>
      <p style="color:#6b7280;font-size:14px;margin:0;">You haven't responded to this permission slip yet. It is due <strong>${esc(formatDate(dueDate))}</strong>. Please grant or decline permission for your child in the parent portal.</p>
      <div style="margin-top:20px;">
        <a href="${esc(url)}" style="display:inline-block;background:#573c9b;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600;">Respond now</a>
      </div>
    </div>
    <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px;">Automated reminder from the ${esc(schoolName)} parent portal.</p>
  </div></body></html>`
  const text = [
    `${schoolName} — permission slip reminder`,
    ``,
    `${title}`,
    `You haven't responded yet. It is due ${formatDate(dueDate)}.`,
    ``,
    `Grant or decline permission for your child: ${url}`,
  ].join('\n')
  return { subject, html, text }
}

type SlipRow = {
  id: string
  school_id: string
  title: string
  due_date: string
  audience_type: PermissionSlipAudience
  class_id: string | null
}

/** Active students in the slip's audience (class or whole school). */
async function targetStudentIds(adminClient: AdminClient, slip: SlipRow): Promise<string[]> {
  let q = adminClient
    .from('students')
    .select('id')
    .eq('school_id', slip.school_id)
    .eq('is_active', true)
  if (slip.audience_type === 'class' && slip.class_id) q = q.eq('class_id', slip.class_id)
  const { data } = await q
  return ((data as { id: string }[] | null) ?? []).map((s) => s.id)
}

async function schoolName(adminClient: AdminClient, schoolId: string): Promise<string> {
  const { data } = await adminClient.from('schools').select('name').eq('id', schoolId).maybeSingle()
  return (data as { name: string } | null)?.name ?? 'Your school'
}

/**
 * Email a reminder to parents who still have a pending response on a slip whose
 * due date is `daysAhead` days away (default: tomorrow). One email per parent,
 * only for children who have not responded. Best-effort per recipient. Returns
 * how many slips were processed and reminder emails attempted. Platform-wide —
 * only invoked from the CRON_SECRET-guarded cron endpoint.
 */
export async function sendDueSoonReminders(
  daysAhead = 1,
): Promise<{ slips: number; emails: number }> {
  const adminClient = createSupabaseAdminClient()
  const target = dueReminderDate(new Date(), daysAhead)

  const { data: slipData } = await adminClient
    .from('permission_slips')
    .select('id, school_id, title, due_date, audience_type, class_id')
    .eq('is_active', true)
    .eq('due_date', target)
  const slips = (slipData as SlipRow[] | null) ?? []
  if (slips.length === 0) return { slips: 0, emails: 0 }

  const resend = getResend()
  let emails = 0

  for (const slip of slips) {
    try {
      const studentIds = await targetStudentIds(adminClient, slip)
      if (studentIds.length === 0) continue

      const { data: respData } = await adminClient
        .from('permission_slip_responses')
        .select('student_id')
        .eq('slip_id', slip.id)
      const responded = new Set(
        ((respData as { student_id: string }[] | null) ?? []).map((r) => r.student_id),
      )
      const pending = studentIds.filter((id) => !responded.has(id))
      if (pending.length === 0) continue

      const { data: linkData } = await adminClient
        .from('parent_student_links')
        .select('parent_id')
        .in('student_id', pending)
        .eq('is_active', true)
      const parentIds = [
        ...new Set(((linkData as { parent_id: string }[] | null) ?? []).map((l) => l.parent_id)),
      ]
      if (parentIds.length === 0) continue

      const { data: profileData } = await adminClient
        .from('profiles')
        .select('email')
        .in('id', parentIds)
        .eq('is_active', true)
      const toEmails = [
        ...new Set(
          ((profileData as { email: string | null }[] | null) ?? [])
            .map((p) => p.email)
            .filter((e): e is string => !!e && e.length > 0),
        ),
      ]
      if (toEmails.length === 0) continue

      const name = await schoolName(adminClient, slip.school_id)
      const url = `${serverEnv.appUrl}/parent/permission-slips`
      const email = reminderEmail(name, slip.title, slip.due_date, url)
      const from = buildEmailFrom(name)

      await Promise.allSettled(
        toEmails.map(async (to) => {
          const { data: sent, error } = await resend.emails.send({
            from,
            to,
            subject: email.subject,
            html: email.html,
            text: email.text,
          })
          await adminClient.from('email_notifications').insert({
            order_id: null,
            school_id: slip.school_id,
            type: 'parent_message' as const,
            recipient_email: to,
            subject: email.subject,
            status: error ? ('failed' as const) : ('sent' as const),
            provider_message_id: error ? null : (sent?.id ?? null),
            failure_details: error ? error.message : null,
            last_attempted_at: new Date().toISOString(),
            sent_at: error ? null : new Date().toISOString(),
          })
          emails += 1
        }),
      )
    } catch (err) {
      logger.error('permission_slip_reminder_slip_failed', {
        slipId: slip.id,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  return { slips: slips.length, emails }
}
