import { NextResponse, type NextRequest } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/client'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logging'
import { createCorrelationId } from '@/lib/utils'
import { sendOrderEmails, sendDepositEmail, sendRefundNoticeEmail } from '@/lib/email/send'
import { incrementPaymentLinkCompletedOrderCount } from '@/lib/payment-links/actions'
import {
  syncSubscriptionFromStripe,
  handleSubscriptionDeleted,
  handleInvoicePaid,
  handleInvoiceFailed,
} from '@/lib/subscriptions/webhookHandlers'
import { isSmsTopupSession, applySmsTopup } from '@/lib/sms/topupWebhook'

// This route is excluded from auth middleware (see middleware.ts matcher pattern).
// Raw body is read BEFORE any JSON parsing — required for Stripe signature verification.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const sig = request.headers.get('stripe-signature')
  if (!sig) {
    logger.warn('stripe_webhook_missing_signature')
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 })
  }

  const body = await request.text()

  // Verify against BOTH webhook signing secrets. Stripe scopes each endpoint to
  // EITHER your account OR connected accounts, each with its own secret:
  //   - stripeWebhookSecret        → your-account events (subscriptions, invoices,
  //                                   platform SMS top-up checkout)
  //   - stripeConnectWebhookSecret → connected-account events (direct-charge parent
  //                                   payments + account.updated)
  // An event is accepted only if it verifies against one of OUR secrets, so trying
  // each in turn is safe. The connect secret is optional; when unset only
  // your-account events verify.
  const stripe = getStripe()
  const secrets = [serverEnv.stripeWebhookSecret, serverEnv.stripeConnectWebhookSecret].filter(
    (s): s is string => s.length > 0,
  )
  let event: Stripe.Event | null = null
  let lastError: unknown = null
  for (const secret of secrets) {
    try {
      event = stripe.webhooks.constructEvent(body, sig, secret)
      break
    } catch (err) {
      lastError = err
    }
  }
  if (!event) {
    logger.warn('stripe_webhook_signature_invalid', {
      error: lastError instanceof Error ? lastError.message : 'Unknown error',
      secretsTried: secrets.length,
    })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const adminClient = createSupabaseAdminClient()

  // Idempotency: record the event before processing.
  // UNIQUE(provider, event_id) catches duplicates — Stripe retries on non-2xx.
  const { error: insertError } = await adminClient.from('webhook_events').insert({
    provider: 'stripe',
    event_id: event.id,
    event_type: event.type,
    payload: event as unknown as Record<string, unknown>,
    processed: false,
  })

  if (insertError) {
    if (insertError.code === '23505') {
      // Already recorded. If a prior attempt PROCESSED it, this is a true duplicate —
      // ack and stop. If it's still unprocessed (a previous attempt failed), fall
      // through and reprocess so transient failures self-heal on Stripe's retry
      // (handlers are idempotent). Without this, a failed event stays stuck forever
      // because every retry is treated as a duplicate.
      const { data: existing } = await adminClient
        .from('webhook_events')
        .select('processed')
        .eq('provider', 'stripe')
        .eq('event_id', event.id)
        .maybeSingle()
      if ((existing as { processed: boolean } | null)?.processed) {
        logger.info('stripe_webhook_duplicate', { eventId: event.id, eventType: event.type })
        return NextResponse.json({ received: true })
      }
      logger.info('stripe_webhook_reprocessing', { eventId: event.id, eventType: event.type })
      // fall through to (re)process below
    } else {
      logger.error('stripe_webhook_event_insert_failed', {
        eventId: event.id,
        error: insertError.message,
      })
      return NextResponse.json({ error: 'Failed to record event' }, { status: 500 })
    }
  }

  let processingError: string | null = null
  try {
    await dispatchStripeEvent(event, adminClient)
  } catch (err) {
    processingError = err instanceof Error ? err.message : 'Processing failed'
    logger.error('stripe_webhook_processing_failed', {
      eventId: event.id,
      eventType: event.type,
      error: processingError,
    })
  }

  await adminClient
    .from('webhook_events')
    .update({
      processed: !processingError,
      processed_at: processingError ? null : new Date().toISOString(),
      error: processingError,
    })
    .eq('event_id', event.id)
    .eq('provider', 'stripe')

  if (processingError) {
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

async function dispatchStripeEvent(event: Stripe.Event, adminClient: AdminClient): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, adminClient)
      break
    case 'checkout.session.expired':
      await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session, adminClient)
      break
    case 'payment_intent.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.PaymentIntent, adminClient)
      break
    case 'charge.refunded':
      await handleChargeRefunded(event.data.object as Stripe.Charge, adminClient)
      break
    // ─── Subscriptions (SaaS billing) ───────────────────────────────────────
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await syncSubscriptionFromStripe(event.data.object as Stripe.Subscription, adminClient)
      break
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, adminClient)
      break
    case 'invoice.payment_succeeded':
      await handleInvoicePaid(event.data.object as Stripe.Invoice, adminClient)
      break
    case 'invoice.payment_failed':
      await handleInvoiceFailed(event.data.object as Stripe.Invoice, adminClient)
      break
    // ─── Stripe Connect (per-school connected accounts) ─────────────────────
    case 'account.updated':
      await handleConnectAccountUpdated(event.data.object as Stripe.Account, adminClient)
      break
    default:
      logger.debug('stripe_webhook_unhandled', { eventType: event.type })
  }
}

/**
 * account.updated — a school's Connect (Standard) account changed. Keep our
 * charges_enabled / details_submitted flags in sync so the app knows when the
 * school can accept parent payments. Matched by the connected account id.
 */
async function handleConnectAccountUpdated(
  account: Stripe.Account,
  adminClient: AdminClient,
): Promise<void> {
  const { error } = await adminClient
    .from('schools')
    .update({
      stripe_connect_charges_enabled: account.charges_enabled ?? false,
      stripe_connect_details_submitted: account.details_submitted ?? false,
    })
    .eq('stripe_connect_account_id', account.id)
  if (error) {
    logger.error('connect_account_updated_sync_failed', {
      accountId: account.id,
      error: error.message,
    })
    throw new Error(error.message)
  }
  logger.info('connect_account_updated', {
    accountId: account.id,
    chargesEnabled: account.charges_enabled ?? false,
  })
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  adminClient: AdminClient,
): Promise<void> {
  // SMS credit top-up (one-off) — a different flow from order/subscription checkout.
  if (isSmsTopupSession(session)) {
    await applySmsTopup(session, adminClient)
    return
  }

  // Fees invoice / late-collection payment — a different subject from activity orders
  // (order_items are hard-coupled to activities, so these use their own payment rows).
  if (session.metadata?.kind === 'invoice') {
    await handleInvoicePayment(session, adminClient)
    return
  }
  if (session.metadata?.kind === 'late_fee') {
    await handleLateFeePayment(session, adminClient)
    return
  }

  const orderId = session.metadata?.order_id
  if (!orderId) {
    logger.error('stripe_checkout_completed_no_order_id', { sessionId: session.id })
    return
  }

  // §11.3: only mark paid when Stripe confirms payment_status is 'paid'.
  // For subscriptions or deferred-payment sessions this may be 'unpaid' — do not advance state.
  if (session.payment_status !== 'paid') {
    logger.info('stripe_checkout_completed_not_paid', {
      orderId,
      sessionId: session.id,
      paymentStatus: session.payment_status,
    })
    return
  }

  // FR-PAY-003 / §11.2 step 6: verify currency and amount before changing state.
  // Mismatch indicates a Stripe configuration error or metadata forgery — abort and trigger retry.
  if (session.currency?.toLowerCase() !== 'eur') {
    logger.error('stripe_checkout_wrong_currency', {
      orderId,
      sessionId: session.id,
      currency: session.currency,
    })
    throw new Error(`Expected EUR currency, got ${session.currency ?? 'null'}`)
  }

  const { data: orderRow, error: fetchError } = await adminClient
    .from('orders')
    .select('total_cents, amount_paid_cents, status, payment_link_id')
    .eq('id', orderId)
    .single()

  if (fetchError || !orderRow) {
    logger.error('stripe_checkout_order_fetch_failed', {
      orderId,
      sessionId: session.id,
      error: fetchError?.message ?? 'Not found',
    })
    throw new Error(`Order ${orderId} not found for amount verification`)
  }

  type OrderAmountRow = {
    total_cents: number
    amount_paid_cents: number
    status: string
    payment_link_id: string | null
  }
  const {
    total_cents,
    amount_paid_cents,
    status: currentStatus,
    payment_link_id,
  } = orderRow as OrderAmountRow

  // Monotonic state machine: transition to paid only if not already in a terminal paid state.
  // NEVER downgrade from paid, partially_refunded, or fully_refunded.
  if (
    currentStatus === 'paid' ||
    currentStatus === 'partially_refunded' ||
    currentStatus === 'fully_refunded'
  ) {
    logger.info('stripe_checkout_order_already_terminal', {
      orderId,
      sessionId: session.id,
      currentStatus,
    })
    return
  }

  // §11.2: Validate the session amount is positive and does not exceed the remaining balance.
  // This guards against Stripe configuration errors or metadata manipulation.
  const sessionAmountCents = session.amount_total ?? 0
  if (sessionAmountCents <= 0) {
    throw new Error(`Invalid session amount for order ${orderId}: ${sessionAmountCents}`)
  }

  const remainingCents = total_cents - amount_paid_cents
  if (sessionAmountCents > remainingCents) {
    logger.error('stripe_checkout_amount_exceeds_balance', {
      orderId,
      sessionId: session.id,
      sessionAmount: sessionAmountCents,
      remainingBalance: remainingCents,
    })
    throw new Error(
      `Payment of ${sessionAmountCents} exceeds remaining balance ${remainingCents} for order ${orderId}`,
    )
  }

  const newAmountPaid = amount_paid_cents + sessionAmountCents
  const newStatus = newAmountPaid >= total_cents ? 'paid' : 'partially_paid'

  const { error: orderError } = await adminClient
    .from('orders')
    .update({ status: newStatus, amount_paid_cents: newAmountPaid })
    .eq('id', orderId)
    .not('status', 'in', '("paid","partially_refunded","fully_refunded")')

  if (orderError) {
    logger.error('stripe_order_update_failed', {
      orderId,
      sessionId: session.id,
      newStatus,
      error: orderError.message,
    })
    throw new Error(orderError.message)
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : (session.payment_intent?.id ?? null)

  // Insert a new payment record for each completed checkout session.
  // The UNIQUE(order_id, provider_checkout_session_id) constraint on payments prevents
  // duplicate rows if Stripe retries the webhook for the same session.
  const { error: paymentError } = await adminClient.from('payments').insert({
    order_id: orderId,
    provider: 'stripe',
    provider_checkout_session_id: session.id,
    provider_payment_intent_id: paymentIntentId,
    amount_cents: sessionAmountCents,
    currency: (session.currency ?? 'eur').toUpperCase(),
    status: 'paid',
    paid_at: new Date().toISOString(),
  })

  if (paymentError) {
    logger.error('stripe_payment_record_failed', {
      orderId,
      sessionId: session.id,
      error: paymentError.message,
    })
    throw new Error(paymentError.message)
  }

  logger.info('stripe_order_payment_recorded', {
    orderId,
    sessionId: session.id,
    newStatus,
    newAmountPaid,
  })

  if (newStatus === 'paid') {
    await sendOrderEmails(orderId, adminClient)
    if (payment_link_id) {
      await incrementPaymentLinkCompletedOrderCount(payment_link_id)
    }
  } else {
    // partially_paid: deposit received — notify payer
    await sendDepositEmail(orderId, adminClient, sessionAmountCents, newAmountPaid, total_cents)
  }
}

/**
 * Validate a completed fees/late-fee checkout session and return the paid amount,
 * or null when it should be ignored (not paid, wrong currency, no amount).
 */
function paidAmountFromSession(session: Stripe.Checkout.Session): number | null {
  if (session.payment_status !== 'paid') return null
  if (session.currency?.toLowerCase() !== 'eur') {
    throw new Error(`Expected EUR currency, got ${session.currency ?? 'null'}`)
  }
  const amount = session.amount_total ?? 0
  return amount > 0 ? amount : null
}

function sessionPaymentIntentId(session: Stripe.Checkout.Session): string | null {
  return typeof session.payment_intent === 'string'
    ? session.payment_intent
    : (session.payment_intent?.id ?? null)
}

/** Parent paid a fees invoice online — mark it (part-)paid and record the payment. */
async function handleInvoicePayment(
  session: Stripe.Checkout.Session,
  adminClient: AdminClient,
): Promise<void> {
  const invoiceId = session.metadata?.invoice_id
  if (!invoiceId) {
    logger.error('stripe_invoice_payment_no_id', { sessionId: session.id })
    return
  }
  const amount = paidAmountFromSession(session)
  if (amount === null) return

  const { data: invRow, error: fetchError } = await adminClient
    .from('invoices')
    .select('net_parent_cents, amount_paid_cents, status')
    .eq('id', invoiceId)
    .single()
  if (fetchError || !invRow) {
    throw new Error(`Invoice ${invoiceId} not found for payment`)
  }
  const inv = invRow as { net_parent_cents: number; amount_paid_cents: number; status: string }

  // Only issued/part-paid invoices advance; paid/void/draft are left alone (idempotent).
  if (inv.status === 'issued' || inv.status === 'part_paid') {
    const newPaid = inv.amount_paid_cents + amount
    const newStatus = newPaid >= inv.net_parent_cents ? 'paid' : 'part_paid'
    const { error: updErr } = await adminClient
      .from('invoices')
      .update({ amount_paid_cents: newPaid, status: newStatus })
      .eq('id', invoiceId)
      .in('status', ['issued', 'part_paid'])
    if (updErr) throw new Error(updErr.message)
  }

  // Idempotent via uq_payments_invoice_session; a retry hits 23505 and is ignored.
  const { error: payErr } = await adminClient.from('payments').insert({
    invoice_id: invoiceId,
    provider: 'stripe',
    provider_checkout_session_id: session.id,
    provider_payment_intent_id: sessionPaymentIntentId(session),
    amount_cents: amount,
    currency: (session.currency ?? 'eur').toUpperCase(),
    status: 'paid',
    paid_at: new Date().toISOString(),
  })
  if (payErr && payErr.code !== '23505') throw new Error(payErr.message)

  logger.info('stripe_invoice_payment_recorded', { invoiceId, sessionId: session.id, amount })
}

/** Parent paid a late-collection fee online — mark it paid and record the payment. */
async function handleLateFeePayment(
  session: Stripe.Checkout.Session,
  adminClient: AdminClient,
): Promise<void> {
  const lateId = session.metadata?.late_collection_id
  if (!lateId) {
    logger.error('stripe_latefee_payment_no_id', { sessionId: session.id })
    return
  }
  const amount = paidAmountFromSession(session)
  if (amount === null) return

  const { data: lcRow, error: fetchError } = await adminClient
    .from('late_collections')
    .select('fee_cents, amount_paid_cents')
    .eq('id', lateId)
    .single()
  if (fetchError || !lcRow) {
    throw new Error(`Late collection ${lateId} not found for payment`)
  }
  const lc = lcRow as { fee_cents: number; amount_paid_cents: number }
  const newPaid = lc.amount_paid_cents + amount
  const fullyPaid = newPaid >= lc.fee_cents

  const { error: updErr } = await adminClient
    .from('late_collections')
    .update({
      amount_paid_cents: newPaid,
      paid_at: fullyPaid ? new Date().toISOString() : null,
    })
    .eq('id', lateId)
  if (updErr) throw new Error(updErr.message)

  const { error: payErr } = await adminClient.from('payments').insert({
    late_collection_id: lateId,
    provider: 'stripe',
    provider_checkout_session_id: session.id,
    provider_payment_intent_id: sessionPaymentIntentId(session),
    amount_cents: amount,
    currency: (session.currency ?? 'eur').toUpperCase(),
    status: 'paid',
    paid_at: new Date().toISOString(),
  })
  if (payErr && payErr.code !== '23505') throw new Error(payErr.message)

  logger.info('stripe_latefee_payment_recorded', { lateId, sessionId: session.id, amount })
}

async function handleCheckoutExpired(
  session: Stripe.Checkout.Session,
  adminClient: AdminClient,
): Promise<void> {
  const orderId = session.metadata?.order_id
  if (!orderId) return

  // partially_paid orders keep their status if a follow-up session expires —
  // the order itself is still partially paid and awaits a new checkout session.
  const { error } = await adminClient
    .from('orders')
    .update({ status: 'expired' })
    .eq('id', orderId)
    .not('status', 'in', '("paid","partially_paid","partially_refunded","fully_refunded")')

  if (error) {
    logger.error('stripe_order_expired_update_failed', {
      orderId,
      sessionId: session.id,
      error: error.message,
    })
    throw new Error(error.message)
  }

  logger.info('stripe_order_expired', { orderId, sessionId: session.id })
}

async function handleChargeRefunded(
  charge: Stripe.Charge,
  adminClient: AdminClient,
): Promise<void> {
  const paymentIntentId =
    typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : (charge.payment_intent?.id ?? null)

  if (!paymentIntentId) {
    logger.warn('stripe_charge_refunded_no_payment_intent', { chargeId: charge.id })
    return
  }

  const { data: paymentRow, error: paymentFetchError } = await adminClient
    .from('payments')
    .select('id, order_id, amount_cents')
    .eq('provider_payment_intent_id', paymentIntentId)
    .single()

  if (paymentFetchError || !paymentRow) {
    logger.error('stripe_charge_refunded_payment_not_found', {
      chargeId: charge.id,
      paymentIntentId,
    })
    return
  }

  type PaymentRecord = { id: string; order_id: string; amount_cents: number }
  const { id: paymentId, order_id: orderId } = paymentRow as PaymentRecord

  // Fetch order fields needed for status transitions, audit logging, and email
  type OrderRefundRecord = {
    school_id: string
    order_reference: string
    status: string
    total_cents: number
    amount_paid_cents: number
  }
  const { data: orderRow } = await adminClient
    .from('orders')
    .select('school_id, order_reference, status, total_cents, amount_paid_cents')
    .eq('id', orderId)
    .single()

  if (!orderRow) {
    logger.error('stripe_charge_refunded_order_not_found', { orderId, chargeId: charge.id })
    return
  }

  const {
    school_id: schoolId,
    order_reference: orderReference,
    status: currentStatus,
    total_cents: totalCents,
    amount_paid_cents: currentAmountPaid,
  } = orderRow as OrderRefundRecord

  // Track succeeded refunds so we can send notice emails after the order status update
  const succeededRefunds: {
    stripeRefundId: string
    amountCents: number
    refundReference: string
  }[] = []

  // Update local refund rows by provider_refund_id
  for (const stripeRefund of charge.refunds?.data ?? []) {
    const { error: updateError } = await adminClient
      .from('refunds')
      .update({ status: stripeRefund.status as string, updated_at: new Date().toISOString() })
      .eq('provider_refund_id', stripeRefund.id)

    if (updateError) {
      logger.error('stripe_refund_status_update_failed', {
        stripeRefundId: stripeRefund.id,
        status: stripeRefund.status,
        error: updateError.message,
      })
    }

    if (stripeRefund.status === 'succeeded') {
      await adminClient.from('audit_logs').insert({
        school_id: schoolId,
        actor_id: null,
        actor_email: 'stripe-webhook',
        action: 'refund.completed',
        resource_type: 'refund',
        resource_id: stripeRefund.id,
        metadata: {
          order_id: orderId,
          payment_id: paymentId,
          amount_cents: stripeRefund.amount,
          stripe_refund_id: stripeRefund.id,
        },
        correlation_id: createCorrelationId(),
      })

      // Fetch local refund_reference to include in the notice email
      const { data: localRefundRow } = await adminClient
        .from('refunds')
        .select('refund_reference')
        .eq('provider_refund_id', stripeRefund.id)
        .single()

      succeededRefunds.push({
        stripeRefundId: stripeRefund.id,
        amountCents: stripeRefund.amount,
        refundReference:
          (localRefundRow as { refund_reference: string } | null)?.refund_reference ??
          stripeRefund.id,
      })
    }
  }

  // Update order status and amount_paid_cents based on the refund amount.
  // charge.amount_refunded is the cumulative total refunded on this charge.
  const amountRefunded = charge.amount_refunded ?? 0

  if (currentStatus === 'partially_paid') {
    // Deposit was refunded before the order was fully paid.
    // Decrement amount_paid_cents; if zeroed out revert to pending_payment.
    // Use currentAmountPaid here (not totalCents) because the charge covers only the
    // deposit amount, not the full order total.
    const newAmountPaid = Math.max(0, currentAmountPaid - amountRefunded)
    const newStatus = newAmountPaid <= 0 ? 'pending_payment' : 'partially_paid'
    const { error: partialPaidUpdateError } = await adminClient
      .from('orders')
      .update({ status: newStatus, amount_paid_cents: newAmountPaid })
      .eq('id', orderId)
      .eq('status', 'partially_paid')
    if (partialPaidUpdateError) {
      logger.error('stripe_refund_order_update_failed', {
        orderId,
        newStatus,
        error: partialPaidUpdateError.message,
      })
      throw new Error(partialPaidUpdateError.message)
    }
  } else if (amountRefunded >= totalCents) {
    const { error: fullRefundUpdateError } = await adminClient
      .from('orders')
      .update({ status: 'fully_refunded', amount_paid_cents: 0 })
      .eq('id', orderId)
      .in('status', ['paid', 'partially_refunded'])
    if (fullRefundUpdateError) {
      logger.error('stripe_refund_order_update_failed', {
        orderId,
        newStatus: 'fully_refunded',
        error: fullRefundUpdateError.message,
      })
      throw new Error(fullRefundUpdateError.message)
    }
  } else if (amountRefunded > 0) {
    // charge.amount_refunded is cumulative — use totalCents as the baseline so that
    // multiple incremental refunds produce the correct amount_paid_cents even when
    // currentAmountPaid was already decremented by a prior refund event.
    const { error: partialRefundUpdateError } = await adminClient
      .from('orders')
      .update({
        status: 'partially_refunded',
        amount_paid_cents: Math.max(0, totalCents - amountRefunded),
      })
      .eq('id', orderId)
      .in('status', ['paid', 'partially_refunded'])
    if (partialRefundUpdateError) {
      logger.error('stripe_refund_order_update_failed', {
        orderId,
        newStatus: 'partially_refunded',
        error: partialRefundUpdateError.message,
      })
      throw new Error(partialRefundUpdateError.message)
    }
  }

  logger.info('stripe_charge_refunded', {
    orderId,
    chargeId: charge.id,
    amountRefunded,
    previousStatus: currentStatus,
  })

  // §12.1: Send refund notice email to payer for each succeeded refund.
  // sendRefundNoticeEmail re-fetches amount_paid_cents so it reflects the post-update balance.
  for (const refund of succeededRefunds) {
    await sendRefundNoticeEmail({
      orderId,
      orderReference,
      refundReference: refund.refundReference,
      refundAmountCents: refund.amountCents,
      refundedAt: new Date().toISOString(),
      adminClient,
    })
  }
}

async function handlePaymentFailed(
  intent: Stripe.PaymentIntent,
  adminClient: AdminClient,
): Promise<void> {
  const orderId = intent.metadata?.order_id
  if (!orderId) return

  // §11.3: log failure reason category without exposing sensitive card details.
  const failureCode = intent.last_payment_error?.code ?? 'unknown'

  // partially_paid orders keep their status if a follow-up payment fails —
  // the order is still partially paid and the parent can retry.
  const { error } = await adminClient
    .from('orders')
    .update({ status: 'payment_failed' })
    .eq('id', orderId)
    .not('status', 'in', '("paid","partially_paid","partially_refunded","fully_refunded")')

  if (error) {
    logger.error('stripe_payment_failed_update_failed', {
      orderId,
      paymentIntentId: intent.id,
      error: error.message,
    })
    throw new Error(error.message)
  }

  logger.info('stripe_payment_failed', { orderId, paymentIntentId: intent.id, failureCode })
}
