'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'
import { getSchoolConnect } from '@/lib/stripe/connect'
import { revolutPost } from '@/lib/revolut/client'
import { resolveRevolutApiKey } from '@/lib/revolut/perSchool'
import { formatCurrency, createCorrelationId } from '@/lib/utils'
import { logger } from '@/lib/logging'
import {
  applyFeeRefund,
  feeSubjectForPayment,
  sendFeeRefundEmails,
  type FeePaymentRecord,
} from './apply-refund'
import { refundableCents } from './refund-math'

export type FeeRefundState = null | { error: string } | { success: true; message: string }

type PaymentRow = FeePaymentRecord & {
  provider: 'stripe' | 'revolut'
  provider_payment_intent_id: string | null
  provider_order_id: string | null
  currency: string
}

/**
 * Admin refunds (part of) an online invoice / late-fee payment. The money goes back on
 * the same rails it came in on: Stripe → refund on the crèche's connected account;
 * Revolut → Merchant API refund against the original order. Our records are then
 * updated by applyFeeRefund (shared with the Stripe webhook, so the two can't
 * double-count). School-scoped through the invoice / late fee the payment belongs to.
 */
export async function refundFeePaymentAction(
  _prev: FeeRefundState,
  formData: FormData,
): Promise<FeeRefundState> {
  const admin = await requireAdmin()
  if (!admin.schoolId) return { error: 'No crèche is associated with your account.' }

  const paymentId = String(formData.get('paymentId') ?? '')
  const amountEuros = Number(String(formData.get('amount') ?? '').replace(',', '.'))
  const reason = String(formData.get('reason') ?? '')
    .trim()
    .slice(0, 300)
  if (!paymentId) return { error: 'Payment not found.' }
  if (!Number.isFinite(amountEuros) || amountEuros <= 0)
    return { error: 'Enter a refund amount greater than zero.' }
  const amountCents = Math.round(amountEuros * 100)

  const db = createSupabaseAdminClient()
  const { data } = await db
    .from('payments')
    .select(
      'id, invoice_id, late_collection_id, amount_cents, refunded_amount_cents, status, provider, provider_payment_intent_id, provider_order_id, currency',
    )
    .eq('id', paymentId)
    .maybeSingle()
  const payment = data as PaymentRow | null
  if (!payment) return { error: 'Payment not found.' }

  const subject = await feeSubjectForPayment(db, payment)
  // Not a fee payment, or another crèche's: same answer, no leak.
  if (!subject || subject.schoolId !== admin.schoolId) return { error: 'Payment not found.' }

  if (payment.status !== 'paid' && payment.status !== 'partially_refunded')
    return { error: 'This payment has already been fully refunded.' }
  const refundable = refundableCents(payment.amount_cents, payment.refunded_amount_cents ?? 0)
  if (amountCents > refundable)
    return { error: `You can refund at most ${formatCurrency(refundable)} on this payment.` }

  let providerRefundId: string
  try {
    if (payment.provider === 'revolut') {
      if (!payment.provider_order_id) return { error: 'This payment has no Revolut reference.' }
      const key = await resolveRevolutApiKey(admin.schoolId)
      const res = await revolutPost<{ id?: string }>(
        `/orders/${payment.provider_order_id}/refund`,
        { amount: amountCents, currency: (payment.currency || 'EUR').toUpperCase() },
        key,
      )
      providerRefundId = res.id ?? `revolut_refund_${payment.provider_order_id}`
    } else {
      if (!payment.provider_payment_intent_id)
        return { error: 'This payment has no Stripe reference.' }
      const connect = await getSchoolConnect(admin.schoolId)
      if (!connect?.stripe_connect_account_id)
        return { error: 'Your Stripe account is not connected, so the refund cannot be sent.' }
      const refund = await getStripe().refunds.create(
        {
          payment_intent: payment.provider_payment_intent_id,
          amount: amountCents,
          reason: 'requested_by_customer',
          metadata: { fee_payment_id: payment.id, requested_by: admin.id ?? '' },
        },
        // The charge lives on the crèche's connected account.
        { stripeAccount: connect.stripe_connect_account_id },
      )
      if (refund.status === 'failed' || refund.status === 'canceled')
        return { error: `Stripe could not process the refund (${refund.status}).` }
      providerRefundId = refund.id
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Refund failed'
    logger.error('fee_refund_provider_failed', {
      paymentId,
      provider: payment.provider,
      error: message,
    })
    await db.from('audit_logs').insert({
      school_id: admin.schoolId,
      actor_id: admin.id,
      actor_email: admin.email,
      action: 'refund.failed',
      resource_type: 'payment',
      resource_id: payment.id,
      metadata: { amount_cents: amountCents, provider: payment.provider, error: message },
      correlation_id: createCorrelationId(),
      ip_address: null,
    })
    return { error: `Refund failed: ${message}` }
  }

  const { newlyRefundedCents } = await applyFeeRefund(
    db,
    payment,
    subject,
    (payment.refunded_amount_cents ?? 0) + amountCents,
  )

  await db.from('audit_logs').insert({
    school_id: admin.schoolId,
    actor_id: admin.id,
    actor_email: admin.email,
    action: 'refund.completed',
    resource_type: 'payment',
    resource_id: payment.id,
    metadata: {
      amount_cents: amountCents,
      provider: payment.provider,
      provider_refund_id: providerRefundId,
      subject: subject.label,
      reason: reason || null,
    },
    correlation_id: createCorrelationId(),
    ip_address: null,
  })

  // Email only if this call recorded it (the webhook may have got there first and
  // already emailed).
  if (newlyRefundedCents > 0) await sendFeeRefundEmails(db, subject, newlyRefundedCents)

  revalidatePath(`/admin/fees/${subject.studentId}`)
  revalidatePath('/parent/invoices')
  revalidatePath('/parent/late-fees')
  return {
    success: true,
    message: `Refunded ${formatCurrency(amountCents)}. The parent has been emailed.`,
  }
}
