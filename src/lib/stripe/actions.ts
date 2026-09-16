'use server'

import { requireVerifiedAuth } from '@/lib/auth/guards'
import { schoolHasProAccess } from '@/lib/subscriptions/access'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'
import { getSchoolConnect, connectStatus } from '@/lib/stripe/connect'
import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logging'
import { formatCurrency } from '@/lib/utils'
import {
  INSTALMENT_MIN_CENTS,
  isInstalmentEligible,
  nextInstalmentCents,
} from '@/lib/payments/instalments'
import type { OrderRow, OrderItemRow } from '@/types/database'

export type CheckoutSessionState = {
  error?: string
  url?: string
} | null

type OrderForCheckout = Pick<
  OrderRow,
  | 'id'
  | 'order_reference'
  | 'status'
  | 'payer_profile_id'
  | 'guest_payer_email'
  | 'total_cents'
  | 'amount_paid_cents'
  | 'school_id'
> & {
  order_items: Pick<
    OrderItemRow,
    'id' | 'activity_name_snapshot' | 'programme_name_snapshot' | 'unit_amount_cents'
  >[]
}

// Terminal or non-payable statuses that prevent checkout
const NON_PAYABLE_STATUSES = new Set(['paid', 'partially_refunded', 'fully_refunded', 'cancelled'])

async function buildCheckoutUrl(
  orderId: string,
  expectedPayerProfileId: string | null,
  payInstalment = false,
): Promise<{ url: string } | { error: string }> {
  const adminClient = createSupabaseAdminClient()

  const { data: orderData } = await adminClient
    .from('orders')
    .select(
      'id, order_reference, status, payer_profile_id, guest_payer_email, total_cents, amount_paid_cents, school_id, order_items(id, activity_name_snapshot, programme_name_snapshot, unit_amount_cents)',
    )
    .eq('id', orderId)
    .single()

  if (!orderData) return { error: 'Order not found.' }

  const order = orderData as OrderForCheckout

  // Portal must be on an active plan (trial not expired). Blocks payment
  // collection — including guest checkout — once a school's trial/subscription lapses.
  if (order.school_id && !(await schoolHasProAccess(order.school_id))) {
    return { error: 'This school’s portal is not active. Please contact the school.' }
  }

  // Parent/guest payments are DIRECT CHARGES on the school's OWN connected Stripe
  // account — money goes straight to the school (no platform fee). Require the
  // school to have completed Stripe Connect onboarding (charges enabled) first.
  const connect = order.school_id ? await getSchoolConnect(order.school_id) : null
  if (connectStatus(connect) !== 'active' || !connect?.stripe_connect_account_id) {
    return {
      error: 'This school hasn’t finished setting up card payments yet. Please contact the school.',
    }
  }
  const connectedAccountId = connect.stripe_connect_account_id

  // Ownership check: guest orders have null payer_profile_id; parent orders are matched by ID
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

  if (!order.order_items.length) return { error: 'This order has no items.' }

  const remainingCents = order.total_cents - order.amount_paid_cents
  if (remainingCents <= 0) return { error: 'This order has already been paid.' }

  // Determine how much to charge. For instalments the amount is computed ENTIRELY
  // server-side from the order (never client-supplied): a min-€20 order is split
  // into 4 equal instalments and we charge the next outstanding one. Otherwise we
  // charge the full remaining balance.
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

  // Server-side bounds check: charge must be positive and within the outstanding balance.
  if (chargeCents <= 0 || chargeCents > remainingCents) {
    return { error: 'Invalid payment amount.' }
  }

  const appUrl = serverEnv.appUrl
  const isGuest = !order.payer_profile_id

  // For a fresh full payment use itemised line items (shows what each item costs).
  // For installment payments (or paying a remaining balance) use a single summary line item
  // so the Stripe session total matches the chosen charge, not the full order total.
  const isFullNewPayment = order.amount_paid_cents === 0 && chargeCents === order.total_cents
  const lineItems = isFullNewPayment
    ? order.order_items.map((item) => ({
        price_data: {
          currency: 'eur',
          product_data: {
            name:
              item.activity_name_snapshot ?? item.programme_name_snapshot ?? order.order_reference,
          },
          unit_amount: item.unit_amount_cents,
        },
        quantity: 1 as const,
      }))
    : [
        {
          price_data: {
            currency: 'eur',
            product_data: { name: `Payment — ${order.order_reference}` },
            unit_amount: chargeCents,
          },
          quantity: 1 as const,
        },
      ]

  const successUrl = `${appUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}&type=${isGuest ? 'guest' : 'parent'}`
  const cancelUrl = `${appUrl}/payment/cancelled?order_id=${orderId}&type=${isGuest ? 'guest' : 'parent'}`

  const stripe = getStripe()
  let session
  try {
    // §11.4: the idempotency key must be unique per instalment but stable for
    // double-clicks of the SAME instalment. It includes amount_paid_cents (which
    // differs for each instalment: 0, q, 2q, 3q) AND chargeCents — so 4 EQUAL
    // instalments (identical chargeCents) still get distinct keys, while a
    // double-click on one instalment (same paid + same charge) reuses the session.
    session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: lineItems,
        success_url: successUrl,
        cancel_url: cancelUrl,
        ...(order.guest_payer_email ? { customer_email: order.guest_payer_email } : {}),
        metadata: {
          order_id: orderId,
          order_reference: order.order_reference,
          order_type: isGuest ? 'guest' : 'parent',
        },
        payment_intent_data: {
          metadata: {
            order_id: orderId,
            order_reference: order.order_reference,
          },
        },
      },
      {
        // Direct charge on the school's connected account (funds go to the school).
        stripeAccount: connectedAccountId,
        idempotencyKey: `checkout-${orderId}-${order.amount_paid_cents}-${chargeCents}`,
      },
    )
  } catch (err) {
    logger.error('stripe_checkout_create_failed', {
      orderId,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
    return { error: 'Failed to start payment. Please try again.' }
  }

  if (!session.url) {
    logger.error('stripe_checkout_no_url', { orderId, sessionId: session.id })
    return { error: 'Failed to start payment. Please try again.' }
  }

  // Transition order draft → pending_payment. Guard prevents overwriting later states.
  if (order.status === 'draft') {
    const { error: transitionError } = await adminClient
      .from('orders')
      .update({ status: 'pending_payment' })
      .eq('id', orderId)
      .eq('status', 'draft')
    if (transitionError) {
      logger.error('order_status_transition_failed', {
        orderId,
        error: transitionError.message,
      })
    }
  }

  return { url: session.url }
}

export async function createGuestCheckoutSessionAction(
  _prev: CheckoutSessionState,
  formData: FormData,
): Promise<CheckoutSessionState> {
  const orderId = formData.get('orderId')
  if (typeof orderId !== 'string' || !orderId) return { error: 'Invalid order.' }
  return buildCheckoutUrl(orderId, null)
}

export async function createParentCheckoutSessionAction(
  _prev: CheckoutSessionState,
  formData: FormData,
): Promise<CheckoutSessionState> {
  // requireVerifiedAuth redirects unauthenticated users to /login
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

  return buildCheckoutUrl(orderId, user.id, payInstalment)
}
