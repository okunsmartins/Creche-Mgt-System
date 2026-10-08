'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getResend } from '@/lib/email/client'
import { buildEmailFrom } from '@/lib/email/from'
import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logging'
import { formatCurrency } from '@/lib/utils'
import type { ActionResult } from './actions'

/** Escape tenant/child-controlled text before interpolating into email HTML. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

interface InvoiceForSend {
  id: string
  invoice_number: string
  student_id: string
  period_start: string
  period_end: string
  due_date: string
  net_parent_cents: number
  amount_paid_cents: number
  status: string
  students: { first_name: string; last_name: string } | null
}

/**
 * Email the linked parent(s) a link to view and pay an outstanding invoice in
 * their portal. Triggered by an admin from the Fees Due page — one send per click.
 *
 * Online card payment of invoices is not live yet (per-tenant payment rails are
 * activated separately); the email links the parent to /parent/invoices, where
 * they see the amount due and how to pay. School-scoped and verify-then-send.
 */
export async function sendInvoiceToParentAction(invoiceId: string): Promise<ActionResult> {
  const admin = await requireAdmin()
  const schoolId = admin.schoolId
  if (!schoolId) return { ok: false, error: 'No crèche is associated with your account.' }
  const db = createSupabaseAdminClient()

  const { data: invData } = await db
    .from('invoices')
    .select(
      'id, invoice_number, student_id, period_start, period_end, due_date, net_parent_cents, amount_paid_cents, status, students(first_name, last_name)',
    )
    .eq('id', invoiceId)
    .eq('school_id', schoolId)
    .maybeSingle()
  const invoice = invData as unknown as InvoiceForSend | null
  if (!invoice) return { ok: false, error: 'Invoice not found in this crèche.' }

  if (invoice.status !== 'issued' && invoice.status !== 'part_paid') {
    return { ok: false, error: 'Only issued invoices can be sent to a parent.' }
  }
  const outstandingCents = Math.max(0, invoice.net_parent_cents - invoice.amount_paid_cents)
  if (outstandingCents === 0) return { ok: false, error: 'This invoice has nothing outstanding.' }

  // Linked parents for this child (service-role bypasses RLS → scope by school too).
  const { data: links } = await db
    .from('parent_student_links')
    .select('parent_id')
    .eq('student_id', invoice.student_id)
    .eq('school_id', schoolId)
    .eq('is_active', true)
  const parentIds = (links ?? []).map((l) => (l as { parent_id: string }).parent_id)
  if (parentIds.length === 0) {
    return { ok: false, error: 'No parent is linked to this child yet. Link a parent first.' }
  }

  const { data: profiles } = await db
    .from('profiles')
    .select('email, first_name')
    .in('id', parentIds)
  const recipients = (profiles ?? [])
    .map((p) => p as { email: string | null; first_name: string | null })
    .filter(
      (p): p is { email: string; first_name: string | null } => !!p.email && p.email.length > 0,
    )
  if (recipients.length === 0) {
    return { ok: false, error: 'No email address on record for this child’s parent(s).' }
  }

  const { data: schoolRow } = await db
    .from('schools')
    .select('name')
    .eq('id', schoolId)
    .maybeSingle()
  const schoolName = (schoolRow as { name: string } | null)?.name ?? 'your crèche'
  const childName = invoice.students
    ? `${invoice.students.first_name} ${invoice.students.last_name}`
    : 'your child'
  const portalUrl = `${serverEnv.appUrl}/parent/invoices`

  const resend = getResend()
  const from = buildEmailFrom(schoolName)
  const subject = `Fees due for ${childName} — ${formatCurrency(outstandingCents)}`

  let sent = 0
  for (const r of recipients) {
    const greeting = r.first_name ? `Hi ${esc(r.first_name)},` : 'Hi,'
    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
        <p>${greeting}</p>
        <p>This is a reminder from <strong>${esc(schoolName)}</strong> of fees due for
           <strong>${esc(childName)}</strong> (amounts shown are after any ECCE/NCS funding).</p>
        <table style="border-collapse:collapse;margin:16px 0;font-size:14px">
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Invoice</td><td style="padding:4px 0"><strong>${esc(invoice.invoice_number)}</strong></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Period</td><td style="padding:4px 0">${esc(invoice.period_start)} → ${esc(invoice.period_end)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Due date</td><td style="padding:4px 0">${esc(invoice.due_date)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Amount due</td><td style="padding:4px 0"><strong>${formatCurrency(outstandingCents)}</strong></td></tr>
        </table>
        <p>
          <a href="${portalUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">
            View your invoices
          </a>
        </p>
        <p style="color:#6b7280;font-size:13px">Sign in to your parent portal to see the full balance and payment options.</p>
        <p style="color:#9ca3af;font-size:12px">${esc(schoolName)} · Creche Wise</p>
      </div>`
    const text =
      `${r.first_name ? `Hi ${r.first_name},` : 'Hi,'}\n\n` +
      `Fees due for ${childName} from ${schoolName}.\n` +
      `Invoice ${invoice.invoice_number} · Period ${invoice.period_start} to ${invoice.period_end}\n` +
      `Due ${invoice.due_date} · Amount due ${formatCurrency(outstandingCents)}\n\n` +
      `View your invoices: ${portalUrl}\n`

    const { error } = await resend.emails.send({ from, to: r.email, subject, html, text })
    if (error) {
      logger.error('invoice_send_failed', { invoiceId, error: error.message })
    } else {
      sent++
    }
  }

  if (sent === 0) return { ok: false, error: 'Could not send the email. Please try again.' }

  await db.from('audit_logs').insert({
    school_id: schoolId,
    actor_id: admin.id,
    actor_email: admin.email,
    action: 'invoice.sent',
    resource_type: 'invoice',
    resource_id: invoiceId,
    metadata: { recipients: sent, outstanding_cents: outstandingCents },
    correlation_id: null,
    ip_address: null,
  })

  logger.info('invoice_sent', { invoiceId, schoolId, recipients: sent })
  revalidatePath('/admin/fees/due')
  return { ok: true }
}
