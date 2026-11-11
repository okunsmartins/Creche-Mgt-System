// Records an online fee payment (invoice or late-collection fee) from a Stripe or
// Revolut webhook. Shared by both webhook routes so they behave the same way.
//
// Order of work (retry-safe):
//   1. Insert the payment row. It is unique per Stripe checkout session / Revolut
//      order, so a retried webhook hits 23505 and adds nothing.
//   2. Re-total every paid payment for the invoice/fee and settle from that total
//      (settle-payment.ts). Re-running this is harmless.
//   3. Only for a NEW payment: email the parent(s) a receipt, and if more was
//      received than owed, log it and email the crèche to refund the excess.
// Emails are best-effort: a failed email never fails the webhook.

import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { resolveSchoolAdminEmail } from '@/lib/email/send'
import { getResend } from '@/lib/email/client'
import { buildEmailFrom } from '@/lib/email/from'
import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logging'
import { settleInvoice, settleLateFee } from './settle-payment'
import { buildFeeReceiptEmail, buildOverpaymentAlertEmail } from './payment-emails'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

export interface FeePaymentInput {
  kind: 'invoice' | 'late_fee'
  /** invoices.id or late_collections.id */
  subjectId: string
  provider: 'stripe' | 'revolut'
  amountCents: number
  currency: string
  /** Stripe only. */
  checkoutSessionId?: string | null
  paymentIntentId?: string | null
  /** Revolut only. */
  providerOrderId?: string | null
}

export interface FeePaymentResult {
  /** False when this payment was already recorded (webhook retry). */
  isNew: boolean
  /** Money received beyond what was owed, across all payments for the subject. */
  excessCents: number
}

interface SubjectInfo {
  schoolId: string
  studentId: string
  label: string
  balanceCents: number
  excessCents: number
}

export async function recordFeePayment(
  db: AdminClient,
  p: FeePaymentInput,
): Promise<FeePaymentResult> {
  if (!Number.isFinite(p.amountCents) || p.amountCents <= 0) {
    throw new Error(`Invalid payment amount ${p.amountCents} for ${p.kind} ${p.subjectId}`)
  }
  const paidAt = new Date().toISOString()
  const subjectCol = p.kind === 'invoice' ? 'invoice_id' : 'late_collection_id'

  // 1) Record the payment (the idempotency gate).
  const { error: payErr } = await db.from('payments').insert({
    [subjectCol]: p.subjectId,
    provider: p.provider,
    provider_checkout_session_id: p.checkoutSessionId ?? null,
    provider_payment_intent_id: p.paymentIntentId ?? null,
    provider_order_id: p.providerOrderId ?? null,
    amount_cents: p.amountCents,
    currency: p.currency.toUpperCase(),
    status: 'paid',
    paid_at: paidAt,
  })
  if (payErr && payErr.code !== '23505') throw new Error(payErr.message)
  const isNew = !payErr

  // 2) Settle from the total received.
  const { data: payRows, error: sumErr } = await db
    .from('payments')
    .select('amount_cents')
    .eq(subjectCol, p.subjectId)
    .eq('status', 'paid')
  if (sumErr) throw new Error(sumErr.message)
  const totalReceived = ((payRows ?? []) as { amount_cents: number }[]).reduce(
    (s, r) => s + (r.amount_cents ?? 0),
    0,
  )

  const info =
    p.kind === 'invoice'
      ? await settleInvoiceRow(db, p.subjectId, totalReceived)
      : await settleLateFeeRow(db, p.subjectId, totalReceived, paidAt)

  const ref = p.checkoutSessionId ?? p.providerOrderId ?? ''
  logger.info('fee_payment_recorded', {
    kind: p.kind,
    subjectId: p.subjectId,
    provider: p.provider,
    amount: p.amountCents,
    isNew,
  })

  // 3) Notifications — only once, for a newly recorded payment.
  if (isNew) {
    if (info.excessCents > 0) {
      logger.error('fee_overpayment', {
        kind: p.kind,
        subjectId: p.subjectId,
        provider: p.provider,
        excessCents: info.excessCents,
        reference: ref,
      })
    }
    await sendPaymentEmails(db, p, info, paidAt, ref)
  }

  return { isNew, excessCents: info.excessCents }
}

async function settleInvoiceRow(
  db: AdminClient,
  invoiceId: string,
  totalReceived: number,
): Promise<SubjectInfo> {
  const { data, error } = await db
    .from('invoices')
    .select('school_id, student_id, invoice_number, net_parent_cents, amount_paid_cents, status')
    .eq('id', invoiceId)
    .single()
  if (error || !data) throw new Error(`Invoice ${invoiceId} not found for payment`)
  const inv = data as {
    school_id: string
    student_id: string
    invoice_number: string
    net_parent_cents: number
    amount_paid_cents: number
    status: string
  }

  const s = settleInvoice(
    {
      netParentCents: inv.net_parent_cents,
      amountPaidCents: inv.amount_paid_cents,
      status: inv.status,
    },
    totalReceived,
  )
  if (s.changed) {
    // Guarded on status so a concurrent void/edit isn't overwritten.
    const { error: updErr } = await db
      .from('invoices')
      .update({ amount_paid_cents: s.amountPaidCents, status: s.status })
      .eq('id', invoiceId)
      .in('status', ['issued', 'part_paid'])
    if (updErr) throw new Error(updErr.message)
  }
  const owed = inv.status === 'void' || inv.status === 'draft' ? 0 : inv.net_parent_cents
  return {
    schoolId: inv.school_id,
    studentId: inv.student_id,
    label: `Invoice ${inv.invoice_number}`,
    balanceCents: Math.max(0, owed - s.amountPaidCents),
    excessCents: s.excessCents,
  }
}

async function settleLateFeeRow(
  db: AdminClient,
  lateId: string,
  totalReceived: number,
  paidAt: string,
): Promise<SubjectInfo> {
  const { data, error } = await db
    .from('late_collections')
    .select('school_id, student_id, fee_cents, amount_paid_cents, paid_at')
    .eq('id', lateId)
    .single()
  if (error || !data) throw new Error(`Late collection ${lateId} not found for payment`)
  const lc = data as {
    school_id: string
    student_id: string
    fee_cents: number
    amount_paid_cents: number
    paid_at: string | null
  }

  const s = settleLateFee(
    { feeCents: lc.fee_cents, amountPaidCents: lc.amount_paid_cents },
    totalReceived,
  )
  if (s.changed) {
    const { error: updErr } = await db
      .from('late_collections')
      .update({
        amount_paid_cents: s.amountPaidCents,
        paid_at: s.fullyPaid ? (lc.paid_at ?? paidAt) : null,
      })
      .eq('id', lateId)
    if (updErr) throw new Error(updErr.message)
  }
  return {
    schoolId: lc.school_id,
    studentId: lc.student_id,
    label: 'Late collection fee',
    balanceCents: Math.max(0, lc.fee_cents - s.amountPaidCents),
    excessCents: s.excessCents,
  }
}

async function sendPaymentEmails(
  db: AdminClient,
  p: FeePaymentInput,
  info: SubjectInfo,
  paidAt: string,
  reference: string,
): Promise<void> {
  try {
    const [{ data: school }, { data: child }, { data: links }] = await Promise.all([
      db.from('schools').select('name').eq('id', info.schoolId).maybeSingle(),
      db.from('students').select('first_name, last_name').eq('id', info.studentId).maybeSingle(),
      db
        .from('parent_student_links')
        .select('parent_id')
        .eq('student_id', info.studentId)
        .eq('school_id', info.schoolId)
        .eq('is_active', true),
    ])
    const schoolName = (school as { name: string } | null)?.name ?? 'Your crèche'
    const c = child as { first_name: string; last_name: string } | null
    const childName = c ? `${c.first_name} ${c.last_name}` : 'your child'
    const resend = getResend()
    const from = buildEmailFrom(schoolName)

    // Receipt → every linked parent with an email (either parent may have paid).
    const parentIds = ((links ?? []) as { parent_id: string }[]).map((l) => l.parent_id)
    if (parentIds.length > 0) {
      const { data: profiles } = await db.from('profiles').select('email').in('id', parentIds)
      const emails = ((profiles ?? []) as { email: string | null }[])
        .map((r) => r.email)
        .filter((e): e is string => !!e)
      const receipt = buildFeeReceiptEmail({
        schoolName,
        childName,
        subjectLabel: info.label,
        amountCents: p.amountCents,
        balanceCents: info.balanceCents,
        paidAtISO: paidAt,
        portalUrl: `${serverEnv.appUrl}/parent/${p.kind === 'invoice' ? 'invoices' : 'late-fees'}`,
      })
      for (const to of emails) {
        const { error } = await resend.emails.send({ from, to, ...receipt })
        if (error)
          logger.error('fee_receipt_email_failed', { subjectId: p.subjectId, error: error.message })
      }
      if (emails.length === 0)
        logger.warn('fee_receipt_no_parent_email', { subjectId: p.subjectId })
    }

    // Overpayment → the crèche's admin, so they refund it.
    if (info.excessCents > 0) {
      const adminEmail = await resolveSchoolAdminEmail(info.schoolId, db)
      const alert = buildOverpaymentAlertEmail({
        schoolName,
        childName,
        subjectLabel: info.label,
        excessCents: info.excessCents,
        provider: p.provider,
        reference,
        adminUrl: `${serverEnv.appUrl}/admin/fees/${info.studentId}`,
      })
      const { error } = await resend.emails.send({
        from: buildEmailFrom('Creche Wise'),
        to: adminEmail,
        ...alert,
      })
      if (error)
        logger.error('fee_overpayment_email_failed', {
          subjectId: p.subjectId,
          error: error.message,
        })
    }
  } catch (err) {
    logger.error('fee_payment_emails_failed', {
      subjectId: p.subjectId,
      error: err instanceof Error ? err.message : 'unknown',
    })
  }
}
