'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'
import { getStripe } from '@/lib/stripe/client'
import { getSchoolConnect } from '@/lib/stripe/connect'
import { revolutPost } from '@/lib/revolut/client'
import { resolveRevolutApiKey } from '@/lib/revolut/perSchool'
import { formatCurrency, createCorrelationId } from '@/lib/utils'
import { logger } from '@/lib/logging'
import { initiateRefundSchema, type RefundActionState } from './schemas'
export type { RefundActionState } from './schemas'
import type { PaymentRow } from '@/types/database'

export async function initiateRefundAction(
  _prev: RefundActionState,
  formData: FormData,
): Promise<RefundActionState> {
  const admin = await requireAdmin()

  const parsed = initiateRefundSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { orderId, paymentId, amountEuros: amountCents, reason } = parsed.data
  const adminClient = createSupabaseAdminClient()

  // Verify order belongs to admin's school
  const { data: orderRow, error: orderFetchError } = await adminClient
    .from('orders')
    .select('school_id, status')
    .eq('id', orderId)
    .single()

  if (orderFetchError || !orderRow) return { error: 'Order not found' }

  type OrderCheck = { school_id: string; status: string }
  const { school_id, status: orderStatus } = orderRow as OrderCheck

  if (school_id !== admin.schoolId) return { error: 'Order not found' }
  if (orderStatus !== 'paid' && orderStatus !== 'partially_refunded') {
    return { error: 'Only paid orders can be refunded' }
  }

  // Fetch payment and verify it belongs to this order
  const { data: paymentRow, error: paymentFetchError } = await adminClient
    .from('payments')
    .select('id, amount_cents, provider, provider_payment_intent_id, provider_order_id, status')
    .eq('id', paymentId)
    .eq('order_id', orderId)
    .single()

  if (paymentFetchError || !paymentRow) return { error: 'Payment not found' }

  const payment = paymentRow as Pick<
    PaymentRow,
    | 'id'
    | 'amount_cents'
    | 'provider'
    | 'provider_payment_intent_id'
    | 'provider_order_id'
    | 'status'
  >

  if (payment.status !== 'paid') return { error: 'Payment is not in a refundable state' }

  // §11.4 refund ceiling: total pending + succeeded refunds cannot exceed payment amount
  const { data: existingRefunds } = await adminClient
    .from('refunds')
    .select('amount_cents, status')
    .eq('payment_id', paymentId)
    .in('status', ['pending', 'processing', 'succeeded'])

  type RefundAmount = { amount_cents: number; status: string }
  const alreadyRefunded =
    (existingRefunds as RefundAmount[] | null)?.reduce((s, r) => s + r.amount_cents, 0) ?? 0
  const refundable = payment.amount_cents - alreadyRefunded

  if (amountCents <= 0) return { error: 'Refund amount must be greater than zero' }
  if (amountCents > refundable) {
    return {
      error: `Cannot refund ${formatCurrency(amountCents)}. Maximum refundable: ${formatCurrency(refundable)}`,
    }
  }

  // Issue the refund on the SAME rails the payment used. Stripe payments are
  // direct charges on the school's connected account, so the refund must be
  // created ON that connected account. Revolut refunds go through the Revolut
  // Merchant API against the original order.
  let providerRefundId: string
  let refundStatus: 'succeeded' | 'pending' | 'cancelled'

  if (payment.provider === 'revolut') {
    if (!payment.provider_order_id) return { error: 'Payment has no Revolut reference' }
    try {
      // Refund on the SAME Revolut account the charge used (school's own if set).
      const revolutApiKey = await resolveRevolutApiKey(school_id)
      const res = await revolutPost<{ id?: string; state?: string }>(
        `/orders/${payment.provider_order_id}/refund`,
        { amount: amountCents, currency: 'EUR' },
        revolutApiKey,
      )
      providerRefundId = res.id ?? `revolut_refund_${payment.provider_order_id}`
      // Revolut card refunds usually complete immediately; treat anything other
      // than an explicit completed state as pending (reconciliation confirms).
      refundStatus = res.state === 'completed' ? 'succeeded' : 'pending'
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Revolut refund failed'
      logger.error('revolut_refund_create_failed', { orderId, paymentId, error: message })
      return { error: `Refund failed: ${message}` }
    }
  } else {
    if (!payment.provider_payment_intent_id) return { error: 'Payment has no Stripe reference' }
    const connect = await getSchoolConnect(school_id)
    if (!connect?.stripe_connect_account_id) {
      return { error: 'This school has no connected Stripe account to refund from.' }
    }
    const stripe = getStripe()
    try {
      const stripeRefund = await stripe.refunds.create(
        {
          payment_intent: payment.provider_payment_intent_id,
          amount: amountCents,
          reason: 'requested_by_customer',
          metadata: { order_id: orderId, requested_by: admin.id ?? '' },
        },
        // Refund on the school's connected account (the charge lives there).
        { stripeAccount: connect.stripe_connect_account_id },
      )
      providerRefundId = stripeRefund.id
      refundStatus =
        stripeRefund.status === 'succeeded'
          ? 'succeeded'
          : stripeRefund.status === 'canceled'
            ? 'cancelled'
            : 'pending'
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Stripe refund failed'
      logger.error('stripe_refund_create_failed', { orderId, paymentId, error: message })
      return { error: `Refund failed: ${message}` }
    }
  }

  const { error: refundInsertError } = await adminClient.from('refunds').insert({
    payment_id: paymentId,
    order_id: orderId,
    amount_cents: amountCents,
    reason,
    status: refundStatus,
    provider_refund_id: providerRefundId,
    requested_by: admin.id ?? null,
  })

  if (refundInsertError) {
    // Stripe refund already processed — log but don't fail the action
    logger.error('refund_insert_failed', { orderId, error: refundInsertError.message })
  }

  // Update order status immediately if Stripe already confirmed the refund
  if (refundStatus === 'succeeded') {
    const totalRefunded = alreadyRefunded + amountCents
    const newOrderStatus =
      totalRefunded >= payment.amount_cents
        ? ('fully_refunded' as const)
        : ('partially_refunded' as const)

    await adminClient.from('orders').update({ status: newOrderStatus }).eq('id', orderId)
  }

  // Audit log (AT-017, FR-ADM-006)
  await adminClient.from('audit_logs').insert({
    school_id: admin.schoolId,
    actor_id: admin.id,
    actor_email: admin.email,
    action: 'refund.requested',
    resource_type: 'refund',
    resource_id: orderId,
    metadata: {
      amount_cents: amountCents,
      reason,
      provider: payment.provider,
      provider_refund_id: providerRefundId,
      refund_status: refundStatus,
    },
    correlation_id: createCorrelationId(),
  })

  logger.info('refund_initiated', {
    orderId,
    paymentId,
    amountCents,
    provider: payment.provider,
    providerRefundId,
    refundStatus,
  })

  // Refresh the surfaces that show refund/order state.
  revalidatePath('/admin/refunds')
  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderId}`)
  return { success: true, refundedAmountCents: amountCents }
}
