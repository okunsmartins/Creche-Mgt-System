'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getResend } from '@/lib/email/client'
import { buildEmailFrom } from '@/lib/email/from'
import { renderBrandedEmail } from '@/lib/email/layout'
import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logging'
import { formatCurrency } from '@/lib/utils'
import type { ActionResult } from './actions'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Email a child's linked parent(s) an outstanding-balance reminder with a link to pay
 * in their portal. Triggered by an admin from the Arrears page — one send per click.
 * Sums every issued/part-paid invoice balance for the child. School-scoped.
 */
export async function sendArrearsReminderAction(studentId: string): Promise<ActionResult> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId
  if (!schoolId) return { ok: false, error: 'No crèche is associated with your account.' }
  const db = createSupabaseAdminClient()

  const { data: child } = await db
    .from('students')
    .select('first_name, last_name')
    .eq('id', studentId)
    .eq('school_id', schoolId)
    .maybeSingle()
  if (!child) return { ok: false, error: 'Child not found in this crèche.' }
  const childName = `${(child as { first_name: string }).first_name} ${(child as { last_name: string }).last_name}`

  const { data: invData } = await db
    .from('invoices')
    .select('net_parent_cents, amount_paid_cents')
    .eq('school_id', schoolId)
    .eq('student_id', studentId)
    .in('status', ['issued', 'part_paid'])
  const outstanding = (
    (invData ?? []) as { net_parent_cents: number; amount_paid_cents: number }[]
  ).reduce((n, i) => n + Math.max(0, i.net_parent_cents - i.amount_paid_cents), 0)
  if (outstanding <= 0) return { ok: false, error: 'This child has nothing outstanding.' }

  const { data: links } = await db
    .from('parent_student_links')
    .select('parent_id')
    .eq('student_id', studentId)
    .eq('school_id', schoolId)
    .eq('is_active', true)
  const parentIds = (links ?? []).map((l) => (l as { parent_id: string }).parent_id)
  if (parentIds.length === 0) {
    return { ok: false, error: 'No parent is linked to this child yet.' }
  }

  const { data: profiles } = await db
    .from('profiles')
    .select('email, first_name')
    .in('id', parentIds)
  const recipients = (profiles ?? [])
    .map((p) => p as { email: string | null; first_name: string | null })
    .filter((p): p is { email: string; first_name: string | null } => !!p.email)
  if (recipients.length === 0) {
    return { ok: false, error: 'No email address on record for this child’s parent(s).' }
  }

  const { data: schoolRow } = await db
    .from('schools')
    .select('name')
    .eq('id', schoolId)
    .maybeSingle()
  const schoolName = (schoolRow as { name: string } | null)?.name ?? 'your crèche'
  const portalUrl = `${serverEnv.appUrl}/parent/invoices`
  const from = buildEmailFrom(schoolName)
  const resend = getResend()
  const subject = `Outstanding fees for ${childName} — ${formatCurrency(outstanding)}`

  let sent = 0
  for (const r of recipients) {
    const greeting = r.first_name ? `Hi ${esc(r.first_name)},` : 'Hi,'
    const html = renderBrandedEmail({
      schoolName,
      subtitle: 'Payment reminder',
      bodyHtml: `
        <p style="margin:0 0 12px">${greeting}</p>
        <p>This is a reminder that there is an outstanding balance of
           <strong>${formatCurrency(outstanding)}</strong> for <strong>${esc(childName)}</strong>
           (after any ECCE/NCS funding).</p>
        <p style="margin:16px 0">
          <a href="${portalUrl}" style="display:inline-block;background:#573c9b;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">
            View &amp; pay your invoices
          </a>
        </p>
        <p style="color:#6b7280;font-size:13px;margin:0">Sign in to your parent portal to see each invoice and pay online.</p>`,
    })
    const text =
      `${r.first_name ? `Hi ${r.first_name},` : 'Hi,'}\n\n` +
      `Outstanding balance for ${childName} at ${schoolName}: ${formatCurrency(outstanding)}.\n` +
      `View and pay your invoices: ${portalUrl}\n`
    const { error } = await resend.emails.send({ from, to: r.email, subject, html, text })
    if (error) logger.error('arrears_reminder_failed', { studentId, error: error.message })
    else sent++
  }

  if (sent === 0) return { ok: false, error: 'Could not send the email. Please try again.' }

  await db.from('audit_logs').insert({
    school_id: schoolId,
    actor_id: admin.id,
    actor_email: admin.email,
    action: 'invoice.sent',
    resource_type: 'student',
    resource_id: studentId,
    metadata: { kind: 'arrears_reminder', recipients: sent, outstanding_cents: outstanding },
    correlation_id: null,
    ip_address: null,
  })

  logger.info('arrears_reminder_sent', { studentId, schoolId, recipients: sent })
  return { ok: true }
}
