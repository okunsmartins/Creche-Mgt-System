import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { sendOrderEmails, sendDepositEmail } from '@/lib/email/send'
import { verifyRevolutSignature } from '@/lib/revolut/signature'
import { revolutGet } from '@/lib/revolut/client'
import {
  schoolIdFromExtRef,
  resolveRevolutWebhookSecret,
  resolveRevolutApiKey,
} from '@/lib/revolut/perSchool'

// Excluded from auth middleware (see middleware.ts matcher). Raw body is read
// BEFORE any JSON parse — required for HMAC signature verification.
//
// Revolut webhook body: { event, order_id, merchant_order_ext_ref?, timestamp? }.
// The body carries NO amount, so ORDER_COMPLETED re-fetches the order from the
// Merchant API to verify the confirmed amount/state before marking paid.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text()

  // Parse BEFORE verifying so we can resolve WHICH secret to verify against
  // (per-school Revolut). The payload is never acted on until the signature
  // checks out, so parsing first is safe.
  let payload: { event?: string; order_id?: string; merchant_order_ext_ref?: string }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventType = payload.event
  const revolutOrderId = payload.order_id
  if (!eventType || !revolutOrderId) {
    logger.warn('revolut_webhook_missing_fields', { hasEvent: !!eventType })
    return NextResponse.json({ error: 'Missing event or order_id' }, { status: 400 })
  }

  // Per-school Revolut: resolve the school from the ext ref, then use its OWN
  // webhook secret + API key (falling back to the platform credentials).
  const schoolId = await schoolIdFromExtRef(payload.merchant_order_ext_ref)
  const webhookSecret = await resolveRevolutWebhookSecret(schoolId)
  const revolutApiKey = await resolveRevolutApiKey(schoolId)

  if (!webhookSecret) {
    // Fail closed: without a signing secret we cannot trust any payload.
    logger.error('revolut_webhook_no_secret_configured')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }

  const valid = verifyRevolutSignature({
    rawBody,
    signatureHeader: request.headers.get('revolut-signature'),
    timestampHeader: request.headers.get('revolut-request-timestamp'),
    secret: webhookSecret,
  })
  if (!valid) {
    logger.warn('revolut_webhook_signature_invalid')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const adminClient = createSupabaseAdminClient()

  // Idempotency: Revolut payloads have no delivery id, so synthesise a stable
  // key per (order, event-type). Retries of the same event collide; distinct
  // lifecycle events (AUTHORISED vs COMPLETED) stay separate.
  const eventId = `${revolutOrderId}:${eventType}`
  const { error: insertError } = await adminClient.from('webhook_events').insert({
    provider: 'revolut',
    event_id: eventId,
    event_type: eventType,
    payload: payload as unknown as Record<string, unknown>,
    processed: false,
  })

  if (insertError) {
    if (insertError.code === '23505') {
      // Already recorded. Ack a genuinely-processed duplicate; otherwise fall
      // through to reprocess (self-heal — handlers are idempotent).
      const { data: existing } = await adminClient
        .from('webhook_events')
        .select('processed')
        .eq('provider', 'revolut')
        .eq('event_id', eventId)
        .maybeSingle()
      if ((existing as { processed: boolean } | null)?.processed) {
        logger.info('revolut_webhook_duplicate', { eventId })
        return NextResponse.json({ received: true })
      }
      logger.info('revolut_webhook_reprocessing', { eventId })
    } else {
      logger.error('revolut_webhook_event_insert_failed', {
        eventId,
        error: insertError.message,
      })
      return NextResponse.json({ error: 'Failed to record event' }, { status: 500 })
    }
  }

  let processingError: string | null = null
  try {
    await dispatchRevolutEvent(eventType, revolutOrderId, adminClient, revolutApiKey)
  } catch (err) {
    processingError = err instanceof Error ? err.message : 'Processing failed'
    logger.error('revolut_webhook_processing_failed', { eventId, error: processingError })
  }

  await adminClient
    .from('webhook_events')
    .update({
      processed: !processingError,
      processed_at: processingError ? null : new Date().toISOString(),
      error: processingError,
    })
    .eq('provider', 'revolut')
    .eq('event_id', eventId)

  if (processingError) {
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
  return NextResponse.json({ received: true })
}

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

async function dispatchRevolutEvent(
  eventType: string,
  revolutOrderId: string,
  adminClient: AdminClient,
  apiKey: string,
): Promise<void> {
  switch (eventType) {
    case 'ORDER_COMPLETED':
      await handleOrderCompleted(revolutOrderId, adminClient, apiKey)
      break
    case 'ORDER_PAYMENT_DECLINED':
    case 'ORDER_PAYMENT_FAILED':
    case 'ORDER_CANCELLED':
      await handleOrderFailed(revolutOrderId, eventType, adminClient, apiKey)
      break
    default:
      logger.debug('revolut_webhook_unhandled', { eventType })
  }
}

/** Tolerant read of the Merchant API retrieve-order response. */
interface RetrievedRevolutOrder {
  id: string
  state?: string
  amount?: number
  currency?: string
  order_amount?: { value?: number; currency?: string }
  metadata?: Record<string, string> | null
  merchant_order_ext_ref?: string | null
}

function orderAmountCents(o: RetrievedRevolutOrder): number {
  if (typeof o.amount === 'number') return o.amount
  if (typeof o.order_amount?.value === 'number') return o.order_amount.value
  return 0
}

function orderCurrency(o: RetrievedRevolutOrder): string {
  return (o.currency ?? o.order_amount?.currency ?? '').toUpperCase()
}

async function handleOrderCompleted(
  revolutOrderId: string,
  adminClient: AdminClient,
  apiKey: string,
): Promise<void> {
  // Authoritative source of amount/state is the Merchant API, not the webhook
  // body — re-fetched on the SAME (school or platform) account that took payment.
  const order = await revolutGet<RetrievedRevolutOrder>(`/orders/${revolutOrderId}`, apiKey)

  if ((order.state ?? '').toLowerCase() !== 'completed') {
    logger.info('revolut_order_not_completed', { revolutOrderId, state: order.state })
    return
  }
  if (orderCurrency(order) !== 'EUR') {
    throw new Error(`Expected EUR, got ${orderCurrency(order) || 'null'} for ${revolutOrderId}`)
  }

  const paidCentsEarly = orderAmountCents(order)

  // Fees invoice / late-collection payment — a different subject from activity orders.
  const kind = order.metadata?.kind
  if (kind === 'invoice') {
    await applyRevolutInvoicePayment(order, revolutOrderId, paidCentsEarly, adminClient)
    return
  }
  if (kind === 'late_fee') {
    await applyRevolutLateFeePayment(order, revolutOrderId, paidCentsEarly, adminClient)
    return
  }

  const localOrderId = order.metadata?.order_id
  if (!localOrderId) {
    logger.error('revolut_order_no_local_id', { revolutOrderId })
    throw new Error(`No local order_id in metadata for Revolut order ${revolutOrderId}`)
  }

  const paidCents = orderAmountCents(order)
  if (paidCents <= 0) throw new Error(`Invalid amount ${paidCents} for order ${localOrderId}`)

  const { data: orderRow, error: fetchError } = await adminClient
    .from('orders')
    .select('total_cents, amount_paid_cents, status, payment_link_id')
    .eq('id', localOrderId)
    .single()

  if (fetchError || !orderRow) {
    throw new Error(`Order ${localOrderId} not found for amount verification`)
  }

  type OrderAmountRow = {
    total_cents: number
    amount_paid_cents: number
    status: string
    payment_link_id: string | null
  }
  const { total_cents, amount_paid_cents, status: currentStatus } = orderRow as OrderAmountRow

  // Monotonic: never downgrade a terminal paid/refunded state.
  if (
    currentStatus === 'paid' ||
    currentStatus === 'partially_refunded' ||
    currentStatus === 'fully_refunded'
  ) {
    logger.info('revolut_order_already_terminal', { localOrderId, currentStatus })
    return
  }

  const remainingCents = total_cents - amount_paid_cents
  if (paidCents > remainingCents) {
    logger.error('revolut_amount_exceeds_balance', {
      localOrderId,
      paidCents,
      remainingCents,
    })
    throw new Error(`Payment ${paidCents} exceeds remaining ${remainingCents} for ${localOrderId}`)
  }

  const newAmountPaid = amount_paid_cents + paidCents
  const newStatus = newAmountPaid >= total_cents ? 'paid' : 'partially_paid'

  const { error: orderError } = await adminClient
    .from('orders')
    .update({ status: newStatus, amount_paid_cents: newAmountPaid })
    .eq('id', localOrderId)
    .not('status', 'in', '("paid","partially_refunded","fully_refunded")')
  if (orderError) throw new Error(orderError.message)

  // One payment row per Revolut order; the partial unique index on
  // provider_order_id blocks duplicate inserts on webhook retry.
  const { error: paymentError } = await adminClient.from('payments').insert({
    order_id: localOrderId,
    provider: 'revolut',
    provider_order_id: revolutOrderId,
    amount_cents: paidCents,
    currency: 'EUR',
    status: 'paid',
    paid_at: new Date().toISOString(),
  })
  if (paymentError && paymentError.code !== '23505') {
    throw new Error(paymentError.message)
  }

  logger.info('revolut_order_payment_recorded', { localOrderId, revolutOrderId, newStatus })

  if (newStatus === 'paid') {
    await sendOrderEmails(localOrderId, adminClient)
  } else {
    await sendDepositEmail(localOrderId, adminClient, paidCents, newAmountPaid, total_cents)
  }
}

/** Parent paid a fees invoice via Revolut — mark it (part-)paid and record the payment. */
async function applyRevolutInvoicePayment(
  order: RetrievedRevolutOrder,
  revolutOrderId: string,
  paidCents: number,
  adminClient: AdminClient,
): Promise<void> {
  const invoiceId = order.metadata?.invoice_id
  if (!invoiceId) throw new Error(`No invoice_id in metadata for Revolut order ${revolutOrderId}`)
  if (paidCents <= 0) throw new Error(`Invalid amount ${paidCents} for invoice ${invoiceId}`)

  const { data: invRow, error: fetchError } = await adminClient
    .from('invoices')
    .select('net_parent_cents, amount_paid_cents, status')
    .eq('id', invoiceId)
    .single()
  if (fetchError || !invRow) throw new Error(`Invoice ${invoiceId} not found for payment`)
  const inv = invRow as { net_parent_cents: number; amount_paid_cents: number; status: string }

  if (inv.status === 'issued' || inv.status === 'part_paid') {
    const newPaid = inv.amount_paid_cents + paidCents
    const newStatus = newPaid >= inv.net_parent_cents ? 'paid' : 'part_paid'
    const { error: updErr } = await adminClient
      .from('invoices')
      .update({ amount_paid_cents: newPaid, status: newStatus })
      .eq('id', invoiceId)
      .in('status', ['issued', 'part_paid'])
    if (updErr) throw new Error(updErr.message)
  }

  const { error: payErr } = await adminClient.from('payments').insert({
    invoice_id: invoiceId,
    provider: 'revolut',
    provider_order_id: revolutOrderId,
    amount_cents: paidCents,
    currency: 'EUR',
    status: 'paid',
    paid_at: new Date().toISOString(),
  })
  if (payErr && payErr.code !== '23505') throw new Error(payErr.message)
  logger.info('revolut_invoice_payment_recorded', { invoiceId, revolutOrderId, paidCents })
}

/** Parent paid a late-collection fee via Revolut — mark it paid and record the payment. */
async function applyRevolutLateFeePayment(
  order: RetrievedRevolutOrder,
  revolutOrderId: string,
  paidCents: number,
  adminClient: AdminClient,
): Promise<void> {
  const lateId = order.metadata?.late_collection_id
  if (!lateId)
    throw new Error(`No late_collection_id in metadata for Revolut order ${revolutOrderId}`)
  if (paidCents <= 0) throw new Error(`Invalid amount ${paidCents} for late fee ${lateId}`)

  const { data: lcRow, error: fetchError } = await adminClient
    .from('late_collections')
    .select('fee_cents, amount_paid_cents')
    .eq('id', lateId)
    .single()
  if (fetchError || !lcRow) throw new Error(`Late collection ${lateId} not found for payment`)
  const lc = lcRow as { fee_cents: number; amount_paid_cents: number }
  const newPaid = lc.amount_paid_cents + paidCents
  const fullyPaid = newPaid >= lc.fee_cents

  const { error: updErr } = await adminClient
    .from('late_collections')
    .update({ amount_paid_cents: newPaid, paid_at: fullyPaid ? new Date().toISOString() : null })
    .eq('id', lateId)
  if (updErr) throw new Error(updErr.message)

  const { error: payErr } = await adminClient.from('payments').insert({
    late_collection_id: lateId,
    provider: 'revolut',
    provider_order_id: revolutOrderId,
    amount_cents: paidCents,
    currency: 'EUR',
    status: 'paid',
    paid_at: new Date().toISOString(),
  })
  if (payErr && payErr.code !== '23505') throw new Error(payErr.message)
  logger.info('revolut_latefee_payment_recorded', { lateId, revolutOrderId, paidCents })
}

async function handleOrderFailed(
  revolutOrderId: string,
  eventType: string,
  adminClient: AdminClient,
  apiKey: string,
): Promise<void> {
  // Look up the local order via the payment mapping if one exists; otherwise
  // fetch the Revolut order for its metadata. Prefer the API for reliability.
  let localOrderId: string | null = null
  try {
    const order = await revolutGet<RetrievedRevolutOrder>(`/orders/${revolutOrderId}`, apiKey)
    localOrderId = order.metadata?.order_id ?? null
  } catch (err) {
    logger.warn('revolut_failed_order_fetch_error', {
      revolutOrderId,
      error: err instanceof Error ? err.message : 'unknown',
    })
  }
  if (!localOrderId) return

  // partially_paid orders keep their status; only advance non-terminal ones to failed.
  const { error } = await adminClient
    .from('orders')
    .update({ status: 'payment_failed' })
    .eq('id', localOrderId)
    .not('status', 'in', '("paid","partially_paid","partially_refunded","fully_refunded")')
  if (error) throw new Error(error.message)

  logger.info('revolut_order_failed', { localOrderId, revolutOrderId, eventType })
}
