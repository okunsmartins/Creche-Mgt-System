'use server'

import { requireVerifiedAuth } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logging'
import { formatCurrency } from '@/lib/utils'
import { schoolHasProAccess } from '@/lib/subscriptions/access'
import {
  INSTALMENT_MIN_CENTS,
  isInstalmentEligible,
  nextInstalmentCents,
} from '@/lib/payments/instalments'
import { revolutPost } from './client'
import { resolveRevolutApiKey } from './perSchool'
import type { OrderRow } from '@/types/database'

export type RevolutOrderState = {
  error?: string
  url?: string
} | null

type OrderForRevolut = Pick<
  OrderRow,
  | 'id'
  | 'order_reference'
  | 'status'
  | 'payer_profile_id'
  | 'guest_payer_email'
  | 'total_cents'
  | 'amount_paid_cents'
  | 'school_id'
>

// Terminal or non-payable statuses that prevent checkout (mirrors the Stripe path).
const NON_PAYABLE_STATUSES = new Set(['paid', 'partially_refunded', 'fully_refunded', 'cancelled'])

/** Shape of the Merchant API create-order response we rely on. */
interface RevolutOrderResponse {
  id: string
  checkout_url?: string
  token?: string
}

/**
 * Create a Revolut Merchant API order and return its hosted checkout URL.
 *
 * The charged amount is computed entirely server-side from the order — the
 * client never supplies an amount. For a normal payment we charge the full
 * outstanding balance; when `payInstalment` is set (parent + Pro only) we charge
 * the next outstanding quarter via the shared instalment schedule. Partial
 * payments are reconciled by the webhook (amount_paid_cents += charged), never
 * by the browser redirect.
 */
async function buildRevolutCheckoutUrl(
  orderId: string,
  expectedPayerProfileId: string | null,
  payInstalment = false,
): Promise<{ url: string } | { error: string }> {
  const adminClient = createSupabaseAdminClient()

  const { data: orderData } = await adminClient
    .from('orders')
    .select(
      'id, order_reference, status, payer_profile_id, guest_payer_email, total_cents, amount_paid_cents, school_id',
    )
    .eq('id', orderId)
    .single()

  if (!orderData) return { error: 'Order not found.' }
  const order = orderData as OrderForRevolut

  // Portal must be on an active plan (trial not expired). Blocks payment
  // collection — including guest checkout — once a school's trial/subscription lapses.
  if (order.school_id && !(await schoolHasProAccess(order.school_id))) {
    return { error: 'This school’s portal is not active. Please contact the school.' }
  }

  // Per-school Revolut: charge on the SCHOOL's own Revolut account if configured,
  // otherwise the platform key. If neither exists, Revolut isn't available.
  const revolutApiKey = await resolveRevolutApiKey(order.school_id)
  if (!revolutApiKey) return { error: 'Revolut payments are not available right now.' }

  // Ownership check: guest orders have null payer_profile_id; parent orders match by ID.
  const isGuestRequest = expectedPayerProfileId === null
  if (isGuestRequest && order.payer_profile_id !== null) return { error: 'Order not found.' }
  if (!isGuestRequest && order.payer_profile_id !== expectedPayerProfileId) {
    return { error: 'Order not found.' }
  }

  if (NON_PAYABLE_STATUSES.has(order.status)) {
    if (order.status === 'paid') return { error: 'This order has already been paid.' }
    return { error: 'This order cannot be paid at this time.' }
  }
  if (order.status === 'expired') return { error: 'This order has expired.' }

  const remainingCents = order.total_cents - order.amount_paid_cents
  if (remainingCents <= 0) return { error: 'This order has already been paid.' }

  // Amount to charge — computed entirely server-side. For instalments we charge
  // the next outstanding quarter (shared schedule with Stripe); otherwise the
  // full remaining balance.
  let chargeCents: number
  if (payInstalment) {
    if (!isInstalmentEligible(order.total_cents)) {
      return {
        error: `Instalments are only available for orders of ${formatCurrency(INSTALMENT_MIN_CENTS)} or more.`,
      }
    }
    chargeCents = nextInstalmentCents(order.total_cents, order.amount_paid_cents)
  } else {
    chargeCents = remainingCents
  }
  if (chargeCents <= 0 || chargeCents > remainingCents) {
    return { error: 'This order cannot be paid at this time.' }
  }

  const isGuest = !order.payer_profile_id
  const appUrl = serverEnv.appUrl
  const redirectUrl = `${appUrl}/payment/success?order_id=${orderId}&type=${isGuest ? 'guest' : 'parent'}`

  let created: RevolutOrderResponse
  try {
    created = await revolutPost<RevolutOrderResponse>(
      '/orders',
      {
        amount: chargeCents,
        currency: 'EUR',
        // Echoed back for reconciliation. Suffixed with amount_paid so each
        // instalment gets a distinct ext_ref (the webhook maps via metadata.order_id,
        // not this field).
        merchant_order_ext_ref: `${order.order_reference}-${order.amount_paid_cents}`,
        metadata: {
          order_id: orderId,
          order_reference: order.order_reference,
          order_type: isGuest ? 'guest' : 'parent',
        },
        redirect_url: redirectUrl,
        ...(order.guest_payer_email ? { customer: { email: order.guest_payer_email } } : {}),
      },
      revolutApiKey,
    )
  } catch (err) {
    logger.error('revolut_order_create_failed', {
      orderId,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
    return { error: 'Failed to start payment. Please try again.' }
  }

  if (!created.checkout_url) {
    logger.error('revolut_order_no_checkout_url', { orderId, revolutOrderId: created.id })
    return { error: 'Failed to start payment. Please try again.' }
  }

  // Transition draft → pending_payment (guarded so we never overwrite a later state).
  if (order.status === 'draft') {
    const { error: transitionError } = await adminClient
      .from('orders')
      .update({ status: 'pending_payment' })
      .eq('id', orderId)
      .eq('status', 'draft')
    if (transitionError) {
      logger.error('order_status_transition_failed', { orderId, error: transitionError.message })
    }
  }

  return { url: created.checkout_url }
}

export async function createGuestRevolutOrderAction(
  _prev: RevolutOrderState,
  formData: FormData,
): Promise<RevolutOrderState> {
  const orderId = formData.get('orderId')
  if (typeof orderId !== 'string' || !orderId) return { error: 'Invalid order.' }
  return buildRevolutCheckoutUrl(orderId, null)
}

export async function createParentRevolutOrderAction(
  _prev: RevolutOrderState,
  formData: FormData,
): Promise<RevolutOrderState> {
  const user = await requireVerifiedAuth()
  const orderId = formData.get('orderId')
  if (typeof orderId !== 'string' || !orderId) return { error: 'Invalid order.' }

  const payInstalment = formData.get('payInstalment') === 'true'

  // Instalments are a Pro feature of the parent's school — enforce server-side so a
  // tampered/stale form can't get a partial charge when the school isn't on Pro.
  if (payInstalment) {
    const proOk = user.schoolId ? await schoolHasProAccess(user.schoolId) : false
    if (!proOk) {
      return { error: 'Instalment payments are not available. Please pay the full amount.' }
    }
  }

  return buildRevolutCheckoutUrl(orderId, user.id, payInstalment)
}
