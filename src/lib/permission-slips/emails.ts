import { getResend } from '@/lib/email/client'
import { buildEmailFrom } from '@/lib/email/from'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logging'
import { resolveRecipients } from '@/lib/messages/recipients'
import type { ParentMessageAudienceInput } from '@/lib/messages/schemas'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function wrap(schoolName: string, title: string, bodyHtml: string, ctaUrl: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:20px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;"><div style="max-width:600px;margin:0 auto;">
    <div style="background:#573c9b;padding:24px;border-radius:8px 8px 0 0;">
      <h1 style="color:#ffffff;margin:0;font-size:18px;font-weight:700;">${esc(schoolName)}</h1>
      <p style="color:#c9bdf0;margin:4px 0 0;font-size:13px;">Permission slip</p>
    </div>
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
      <h2 style="font-size:16px;font-weight:700;margin:0 0 8px;">${esc(title)}</h2>
      ${bodyHtml}
      <div style="margin-top:20px;">
        <a href="${esc(ctaUrl)}" style="display:inline-block;background:#573c9b;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600;">Respond now</a>
      </div>
    </div>
    <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px;">Automated message from the ${esc(schoolName)} parent portal.</p>
  </div></body></html>`
}

/**
 * Email the parents in a new slip's audience, asking them to respond. Best-effort
 * and per-recipient (never a shared To); logged in email_notifications. Never
 * throws — a failed notification must not fail slip creation.
 */
export async function sendPermissionSlipCreatedEmails(
  adminClient: AdminClient,
  schoolId: string,
  data: { title: string; dueDate: string | null; audience: ParentMessageAudienceInput },
): Promise<void> {
  try {
    const recipients = await resolveRecipients(adminClient, schoolId, data.audience)
    if (recipients.length === 0) return

    const { data: schoolRow } = await adminClient
      .from('schools')
      .select('name')
      .eq('id', schoolId)
      .maybeSingle()
    const schoolName = (schoolRow as { name: string } | null)?.name ?? 'Your school'

    const url = `${serverEnv.appUrl}/parent/permission-slips`
    const subject = `Permission needed: ${data.title}`
    const dueLine = data.dueDate ? ` Please respond by ${formatDate(data.dueDate)}.` : ''
    const bodyHtml = `<p style="color:#6b7280;font-size:14px;margin:0;">${esc(schoolName)} needs your consent for <strong>${esc(data.title)}</strong>.${dueLine ? ` ${esc(dueLine.trim())}` : ''} Please grant or decline permission for your child in the parent portal.</p>`
    const html = wrap(schoolName, data.title, bodyHtml, url)
    const text = [
      `${schoolName} — permission needed`,
      ``,
      `${data.title}`,
      ...(data.dueDate ? [`Please respond by ${formatDate(data.dueDate)}.`] : []),
      ``,
      `Grant or decline permission for your child: ${url}`,
    ].join('\n')

    const resend = getResend()
    const from = buildEmailFrom(schoolName)
    await Promise.allSettled(
      recipients.map(async (r) => {
        const { data: sent, error } = await resend.emails.send({
          from,
          to: r.email,
          subject,
          html,
          text,
        })
        await adminClient.from('email_notifications').insert({
          order_id: null,
          school_id: schoolId,
          // Logged under the parent-message type (no dedicated enum value needed).
          type: 'parent_message' as const,
          recipient_email: r.email,
          subject,
          status: error ? ('failed' as const) : ('sent' as const),
          provider_message_id: error ? null : (sent?.id ?? null),
          failure_details: error ? error.message : null,
          last_attempted_at: new Date().toISOString(),
          sent_at: error ? null : new Date().toISOString(),
        })
      }),
    )
    logger.info('permission_slip_emails_sent', { schoolId, recipients: recipients.length })
  } catch (err) {
    logger.error('permission_slip_email_error', {
      schoolId,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
  }
}
