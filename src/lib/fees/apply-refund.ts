// Applies a refund on an online fee payment (invoice or late-collection fee) to our
// records. Shared by the admin refund action and the Stripe `charge.refunded` webhook.
//
// Retry-safe: takes the CUMULATIVE refunded total (never "add this much"), only ever
// raises `refunded_amount_cents`, then re-settles the invoice / late fee from the net
// received across all its payments. Applying the same refund twice changes nothing.

import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getResend } from '@/lib/email/client'
import { buildEmailFrom } from '@/lib/email/from'
import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logging'
import {
  RECEIVED_PAYMENT_STATUSES,
  invoiceAfterRefund,
  lateFeeAfterRefund,
  netReceivedCents,
  paymentStatusAfterRefund,
} from './refund-math'
import { buildFeeRefundEmail } from './payment-emails'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

export interface FeePaymentRecord {
  id: string
  invoice_id: string | null
  late_collection_id: string | null
  amount_cents: number
  refunded_amount_cents: number | null
  status: string
}

export interface FeeSubject {
  kind: 'invoice' | 'late_fee'
  id: string
  schoolId: string
  studentId: string
  label: string
}

/** Look up the invoice / late fee a payment belongs to (null for order payments). */
export async function feeSubjectForPayment(
  db: AdminClient,
  p: Pick<FeePaymentRecord, 'invoice_id' | 'late_collection_id'>,
): Promise<FeeSubject | null> {
  if (p.invoice_id) {
    const { data } = await db
      .from('invoices')
      .select('id, school_id, student_id, invoice_number')
      .eq('id', p.invoice_id)
      .maybeSingle()
    const inv = data as {
      id: string
      school_id: string
      student_id: string
      invoice_number: string
    } | null
    return inv
      ? {
          kind: 'invoice',
          id: inv.id,
          schoolId: inv.school_id,
          studentId: inv.student_id,
          label: `Invoice ${inv.invoice_number}`,
        }
      : null
  }
  if (p.late_collection_id) {
    const { data } = await db
      .from('late_collections')
      .select('id, school_id, student_id')
      .eq('id', p.late_collection_id)
      .maybeSingle()
    const lc = data as { id: string; school_id: string; student_id: string } | null
    return lc
      ? {
          kind: 'late_fee',
          id: lc.id,
          schoolId: lc.school_id,
          studentId: lc.student_id,
          label: 'Late collection fee',
        }
      : null
  }
  return null
}

/**
 * Record that `refundedTotalCents` (cumulative) of this payment has been refunded, and
 * re-settle its invoice / late fee. Returns how much NEW refund this call recorded
 * (0 on a repeat), so callers only notify once.
 */
export async function applyFeeRefund(
  db: AdminClient,
  payment: FeePaymentRecord,
  subject: FeeSubject,
  refundedTotalCents: number,
): Promise<{ newlyRefundedCents: number }> {
  // Re-read: the webhook and the admin action can race on the same refund.
  const { data: fresh } = await db
    .from('payments')
    .select('refunded_amount_cents')
    .eq('id', payment.id)
    .single()
  const previous = Math.max(
    0,
    (fresh as { refunded_amount_cents: number | null } | null)?.refunded_amount_cents ??
      payment.refunded_amount_cents ??
      0,
  )
  const total = Math.min(payment.amount_cents, Math.max(previous, Math.round(refundedTotalCents)))
  let newlyRefundedCents = total - previous

  if (newlyRefundedCents > 0) {
    const { data: moved, error } = await db
      .from('payments')
      .update({
        refunded_amount_cents: total,
        status: paymentStatusAfterRefund(payment.amount_cents, total),
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id)
      // Optimistic guard: only move forward from what we read.
      .eq('refunded_amount_cents', previous)
      .select('id')
    if (error) throw new Error(error.message)
    // Lost the race: the other path recorded (and notifies about) this refund.
    if (!moved || moved.length === 0) newlyRefundedCents = 0
  }

  // Re-settle from every payment on the subject (always — harmless when unchanged).
  const subjectCol = subject.kind === 'invoice' ? 'invoice_id' : 'late_collection_id'
  const { data: rows, error: sumErr } = await db
    .from('payments')
    .select('amount_cents, refunded_amount_cents')
    .eq(subjectCol, subject.id)
    .in('status', [...RECEIVED_PAYMENT_STATUSES])
  if (sumErr) throw new Error(sumErr.message)
  const net = netReceivedCents(
    (rows ?? []) as { amount_cents: number; refunded_amount_cents: number | null }[],
  )

  if (subject.kind === 'invoice') {
    const { data } = await db
      .from('invoices')
      .select('net_parent_cents, status')
      .eq('id', subject.id)
      .single()
    const inv = data as { net_parent_cents: number; status: string } | null
    const next = inv
      ? invoiceAfterRefund({ netParentCents: inv.net_parent_cents, status: inv.status }, net)
      : null
    if (next) {
      const { error } = await db
        .from('invoices')
        .update({ amount_paid_cents: next.amountPaidCents, status: next.status })
        .eq('id', subject.id)
        .in('status', ['issued', 'part_paid', 'paid'])
      if (error) throw new Error(error.message)
    }
  } else {
    const { data } = await db
      .from('late_collections')
      .select('fee_cents, paid_at')
      .eq('id', subject.id)
      .single()
    const lc = data as { fee_cents: number; paid_at: string | null } | null
    if (lc) {
      const next = lateFeeAfterRefund(lc.fee_cents, net)
      const { error } = await db
        .from('late_collections')
        .update({
          amount_paid_cents: next.amountPaidCents,
          paid_at: next.fullyPaid ? lc.paid_at : null,
        })
        .eq('id', subject.id)
      if (error) throw new Error(error.message)
    }
  }

  logger.info('fee_refund_applied', {
    paymentId: payment.id,
    kind: subject.kind,
    subjectId: subject.id,
    refundedTotal: total,
    newlyRefundedCents,
  })
  return { newlyRefundedCents }
}

/** Best-effort refund notice to the child's linked parents. Never throws. */
export async function sendFeeRefundEmails(
  db: AdminClient,
  subject: FeeSubject,
  refundCents: number,
): Promise<void> {
  try {
    const [{ data: school }, { data: child }, { data: links }] = await Promise.all([
      db.from('schools').select('name').eq('id', subject.schoolId).maybeSingle(),
      db.from('students').select('first_name, last_name').eq('id', subject.studentId).maybeSingle(),
      db
        .from('parent_student_links')
        .select('parent_id')
        .eq('student_id', subject.studentId)
        .eq('school_id', subject.schoolId)
        .eq('is_active', true),
    ])
    const parentIds = ((links ?? []) as { parent_id: string }[]).map((l) => l.parent_id)
    if (parentIds.length === 0) return
    const { data: profiles } = await db.from('profiles').select('email').in('id', parentIds)
    const emails = ((profiles ?? []) as { email: string | null }[])
      .map((r) => r.email)
      .filter((e): e is string => !!e)
    const schoolName = (school as { name: string } | null)?.name ?? 'Your crèche'
    const c = child as { first_name: string; last_name: string } | null
    const msg = buildFeeRefundEmail({
      schoolName,
      childName: c ? `${c.first_name} ${c.last_name}` : 'your child',
      subjectLabel: subject.label,
      amountCents: refundCents,
      refundedAtISO: new Date().toISOString(),
      portalUrl: `${serverEnv.appUrl}/parent/${subject.kind === 'invoice' ? 'invoices' : 'late-fees'}`,
    })
    const resend = getResend()
    const from = buildEmailFrom(schoolName)
    for (const to of emails) {
      const { error } = await resend.emails.send({ from, to, ...msg })
      if (error)
        logger.error('fee_refund_email_failed', { subjectId: subject.id, error: error.message })
    }
  } catch (err) {
    logger.error('fee_refund_emails_failed', {
      subjectId: subject.id,
      error: err instanceof Error ? err.message : 'unknown',
    })
  }
}
