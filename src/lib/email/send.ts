import { getResend } from './client'
import { buildEmailFrom } from './from'
import {
  buildPayerReceiptEmail,
  buildSchoolNotificationEmail,
  buildDepositReceiptEmail,
  buildRefundNoticeEmail,
} from './templates'
import type { OrderEmailItem } from './templates'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/logging'
import type { OrderRow, OrderItemRow, PaymentRow, ProfileRow, SchoolRow } from '@/types/database'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

type OrderForEmail = Pick<
  OrderRow,
  | 'id'
  | 'school_id'
  | 'order_reference'
  | 'payer_profile_id'
  | 'guest_payer_name'
  | 'guest_payer_email'
  | 'total_cents'
  | 'source'
> & {
  order_items: Pick<
    OrderItemRow,
    | 'student_name_snapshot'
    | 'class_name_snapshot'
    | 'teacher_name_snapshot'
    | 'activity_name_snapshot'
    | 'programme_name_snapshot'
    | 'unit_amount_cents'
    | 'verification_status'
  >[]
  payments: Pick<PaymentRow, 'payment_reference' | 'paid_at'>[]
}

// ─── Data gathering ───────────────────────────────────────────────────────────

async function gatherOrderData(
  orderId: string,
  adminClient: AdminClient,
): Promise<{
  order: OrderForEmail
  payerName: string
  payerEmail: string | null
  schoolName: string
  schoolAdminEmail: string
  paymentReference: string
  paidAt: string
  items: OrderEmailItem[]
} | null> {
  const { data: orderData, error: orderError } = await adminClient
    .from('orders')
    .select(
      'id, school_id, order_reference, payer_profile_id, guest_payer_name, guest_payer_email, total_cents, source, order_items(student_name_snapshot, class_name_snapshot, teacher_name_snapshot, activity_name_snapshot, programme_name_snapshot, unit_amount_cents, verification_status), payments(payment_reference, paid_at)',
    )
    .eq('id', orderId)
    .single()

  if (orderError || !orderData) {
    logger.error('email_order_fetch_failed', { orderId, error: orderError?.message })
    return null
  }

  const order = orderData as unknown as OrderForEmail

  // Payment must exist for receipt emails
  const payment = order.payments[0]
  if (!payment?.payment_reference || !payment?.paid_at) {
    logger.warn('email_no_payment_record', { orderId })
    return null
  }

  // Fetch school name and profile in parallel
  const [schoolResult, profileResult] = await Promise.all([
    adminClient.from('schools').select('name').eq('id', order.school_id).single(),
    order.payer_profile_id
      ? adminClient
          .from('profiles')
          .select('email, first_name, last_name')
          .eq('id', order.payer_profile_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
  ])

  const schoolName = (schoolResult.data as Pick<SchoolRow, 'name'> | null)?.name ?? 'your school'

  // Multi-tenant: the school copy goes to THIS school's admin, not a global address.
  const schoolAdminEmail = await resolveSchoolAdminEmail(order.school_id, adminClient)

  let payerName = order.guest_payer_name ?? 'Parent'
  let payerEmail: string | null = order.guest_payer_email

  if (profileResult.data) {
    const profile = profileResult.data as Pick<ProfileRow, 'email' | 'first_name' | 'last_name'>
    payerName = `${profile.first_name} ${profile.last_name}`
    payerEmail = profile.email
  }

  // §12.1: include verification_status so school notification can show manual-review indicator
  const items: OrderEmailItem[] = order.order_items.map((item) => ({
    studentName: item.student_name_snapshot,
    className: item.class_name_snapshot,
    ...(item.teacher_name_snapshot ? { teacherName: item.teacher_name_snapshot } : {}),
    activityName: item.activity_name_snapshot ?? item.programme_name_snapshot ?? '',
    amountCents: item.unit_amount_cents,
    ...(item.verification_status ? { verificationStatus: item.verification_status } : {}),
  }))

  return {
    order,
    payerName,
    payerEmail,
    schoolName,
    schoolAdminEmail,
    paymentReference: payment.payment_reference,
    paidAt: payment.paid_at,
    items,
  }
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

async function countPriorAttempts(
  orderId: string,
  type: string,
  adminClient: AdminClient,
): Promise<number> {
  const { count } = await adminClient
    .from('email_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', orderId)
    .eq('type', type)
  return count ?? 0
}

/**
 * Resolves which address should receive the school's copy of a payment
 * notification, for the given school (tenant). Multi-tenant correctness: each
 * school's copy must go to THAT school's admin, not a single global address.
 *
 * Strategy (per product decision): use the school's owner/first admin login
 * email — the earliest school_admin/super_admin assignment for the school.
 * Falls back to the platform-wide SCHOOL_NOTIFICATION_EMAIL when none is found.
 */
export async function resolveSchoolAdminEmail(
  schoolId: string,
  adminClient: AdminClient,
): Promise<string> {
  const fallback = serverEnv.schoolNotificationEmail

  const { data: roleRows } = await adminClient
    .from('roles')
    .select('id')
    .in('name', ['school_admin', 'super_admin'])
  const roleIds = (roleRows as { id: string }[] | null)?.map((r) => r.id) ?? []
  if (roleIds.length === 0) return fallback

  // Earliest admin assignment for this school = its owner.
  const { data: urRows } = await adminClient
    .from('user_roles')
    .select('user_id, created_at')
    .eq('school_id', schoolId)
    .in('role_id', roleIds)
    .order('created_at', { ascending: true })
    .limit(1)
  const userId = (urRows as { user_id: string }[] | null)?.[0]?.user_id
  if (!userId) return fallback

  const { data: profile } = await adminClient
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .maybeSingle()
  const email = (profile as { email: string | null } | null)?.email
  return email && email.length > 0 ? email : fallback
}

// ─── Individual send helpers ──────────────────────────────────────────────────

async function sendPayerReceipt(
  orderId: string,
  adminClient: AdminClient,
  gathered: NonNullable<Awaited<ReturnType<typeof gatherOrderData>>>,
): Promise<void> {
  const { order, payerName, payerEmail, schoolName, paymentReference, paidAt, items } = gathered

  if (!payerEmail) {
    logger.warn('email_payer_receipt_no_email', { orderId })
    await adminClient.from('email_notifications').insert({
      order_id: orderId,
      type: 'payer_receipt' as const,
      recipient_email: '',
      subject: `${schoolName} payment receipt – ${order.order_reference}`,
      status: 'skipped' as const,
      failure_details: 'No payer email address on record',
      last_attempted_at: new Date().toISOString(),
    })
    return
  }

  const { subject, html, text } = buildPayerReceiptEmail({
    schoolName,
    payerName,
    orderReference: order.order_reference,
    paymentReference,
    paidAt,
    totalCents: order.total_cents,
    items,
  })

  // §12.2: create email_notifications row BEFORE sending so the attempt is always recorded
  // FR-EML-004: retry_count tracks how many prior attempts existed for this order+type
  const retryCount = await countPriorAttempts(orderId, 'payer_receipt', adminClient)

  let notifId: string | null = null
  const { data: notifRow, error: notifInsertError } = await adminClient
    .from('email_notifications')
    .insert({
      order_id: orderId,
      type: 'payer_receipt' as const,
      recipient_email: payerEmail,
      subject,
      status: 'pending' as const,
      retry_count: retryCount,
      last_attempted_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (notifInsertError) {
    logger.error('email_notification_pre_insert_failed', {
      orderId,
      type: 'payer_receipt',
      error: notifInsertError.message,
    })
  } else {
    notifId = (notifRow as { id: string } | null)?.id ?? null
  }

  const resend = getResend()
  const { data, error } = await resend.emails.send({
    from: buildEmailFrom(schoolName),
    to: payerEmail,
    subject,
    html,
    text,
  })

  if (notifId) {
    await adminClient
      .from('email_notifications')
      .update({
        status: error ? ('failed' as const) : ('sent' as const),
        provider_message_id: error ? null : (data?.id ?? null),
        failure_details: error ? error.message : null,
        sent_at: error ? null : new Date().toISOString(),
      })
      .eq('id', notifId)
  } else {
    // pre-insert failed; record the outcome as a new row
    await adminClient.from('email_notifications').insert({
      order_id: orderId,
      type: 'payer_receipt' as const,
      recipient_email: payerEmail,
      subject,
      status: error ? ('failed' as const) : ('sent' as const),
      provider_message_id: error ? null : (data?.id ?? null),
      failure_details: error ? error.message : null,
      retry_count: retryCount,
      last_attempted_at: new Date().toISOString(),
      sent_at: error ? null : new Date().toISOString(),
    })
  }

  if (error) {
    logger.error('email_payer_receipt_failed', { orderId, error: error.message })
  } else {
    logger.info('email_payer_receipt_sent', { orderId, messageId: data?.id })
  }
}

async function sendSchoolNotification(
  orderId: string,
  adminClient: AdminClient,
  gathered: NonNullable<Awaited<ReturnType<typeof gatherOrderData>>>,
): Promise<void> {
  const {
    order,
    payerName,
    payerEmail,
    schoolName,
    schoolAdminEmail,
    paymentReference,
    paidAt,
    items,
  } = gathered

  const adminOrderUrl = `${serverEnv.appUrl}/admin/orders/${orderId}`

  const { subject, html, text } = buildSchoolNotificationEmail({
    schoolName,
    payerName,
    payerEmail: payerEmail ?? '(no email on record)',
    orderReference: order.order_reference,
    paymentReference,
    paidAt,
    totalCents: order.total_cents,
    source: order.source,
    items,
    adminOrderUrl,
  })

  // §12.2: create email_notifications row BEFORE sending
  // FR-EML-004: retry_count tracks how many prior attempts existed for this order+type
  const retryCount = await countPriorAttempts(orderId, 'school_notification', adminClient)

  let notifId: string | null = null
  const { data: notifRow, error: notifInsertError } = await adminClient
    .from('email_notifications')
    .insert({
      order_id: orderId,
      type: 'school_notification' as const,
      recipient_email: schoolAdminEmail,
      subject,
      status: 'pending' as const,
      retry_count: retryCount,
      last_attempted_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (notifInsertError) {
    logger.error('email_notification_pre_insert_failed', {
      orderId,
      type: 'school_notification',
      error: notifInsertError.message,
    })
  } else {
    notifId = (notifRow as { id: string } | null)?.id ?? null
  }

  const resend = getResend()
  const { data, error } = await resend.emails.send({
    from: buildEmailFrom(schoolName),
    to: schoolAdminEmail,
    subject,
    html,
    text,
  })

  if (notifId) {
    await adminClient
      .from('email_notifications')
      .update({
        status: error ? ('failed' as const) : ('sent' as const),
        provider_message_id: error ? null : (data?.id ?? null),
        failure_details: error ? error.message : null,
        sent_at: error ? null : new Date().toISOString(),
      })
      .eq('id', notifId)
  } else {
    // pre-insert failed; record the outcome as a new row
    await adminClient.from('email_notifications').insert({
      order_id: orderId,
      type: 'school_notification' as const,
      recipient_email: schoolAdminEmail,
      subject,
      status: error ? ('failed' as const) : ('sent' as const),
      provider_message_id: error ? null : (data?.id ?? null),
      failure_details: error ? error.message : null,
      retry_count: retryCount,
      last_attempted_at: new Date().toISOString(),
      sent_at: error ? null : new Date().toISOString(),
    })
  }

  if (error) {
    logger.error('email_school_notification_failed', { orderId, error: error.message })
  } else {
    logger.info('email_school_notification_sent', { orderId, messageId: data?.id })
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Send both payer receipt and school notification emails for a paid order.
 * Called from the Stripe webhook handler after marking the order as paid.
 * Never throws — email failure must not affect payment state or webhook response.
 */
export async function sendOrderEmails(orderId: string, adminClient: AdminClient): Promise<void> {
  try {
    const gathered = await gatherOrderData(orderId, adminClient)
    if (!gathered) return

    await Promise.allSettled([
      sendPayerReceipt(orderId, adminClient, gathered),
      sendSchoolNotification(orderId, adminClient, gathered),
    ])
  } catch (err) {
    logger.error('email_send_order_emails_failed', {
      orderId,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
  }
}

/**
 * Send a deposit-received email to the payer when an order moves to partially_paid.
 * Fetches the most recently inserted payment row to get the payment reference.
 * Never throws — email failure must not affect payment state or webhook response.
 */
export async function sendDepositEmail(
  orderId: string,
  adminClient: AdminClient,
  depositCents: number,
  totalPaidCents: number,
  totalCents: number,
): Promise<void> {
  try {
    const { data: orderData, error: orderError } = await adminClient
      .from('orders')
      .select(
        'id, school_id, order_reference, payer_profile_id, guest_payer_name, guest_payer_email, total_cents, source, order_items(student_name_snapshot, class_name_snapshot, teacher_name_snapshot, activity_name_snapshot, programme_name_snapshot, unit_amount_cents), payments(payment_reference, paid_at)',
      )
      .eq('id', orderId)
      .single()

    if (orderError || !orderData) {
      logger.error('email_deposit_order_fetch_failed', { orderId, error: orderError?.message })
      return
    }

    const order = orderData as unknown as OrderForEmail

    // Pick the most recently paid payment — this is the deposit just recorded
    const latestPayment = (
      order.payments as (Pick<PaymentRow, 'payment_reference' | 'paid_at'> & { paid_at: string })[]
    )
      .slice()
      .sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime())[0]

    if (!latestPayment?.payment_reference || !latestPayment?.paid_at) {
      logger.warn('email_deposit_no_payment_record', { orderId })
      return
    }

    const [schoolResult, profileResult] = await Promise.all([
      adminClient.from('schools').select('name').eq('id', order.school_id).single(),
      order.payer_profile_id
        ? adminClient
            .from('profiles')
            .select('email, first_name, last_name')
            .eq('id', order.payer_profile_id)
            .single()
        : Promise.resolve({ data: null, error: null }),
    ])

    const schoolName = (schoolResult.data as Pick<SchoolRow, 'name'> | null)?.name ?? 'your school'

    let payerName = order.guest_payer_name ?? 'Parent'
    let payerEmail: string | null = order.guest_payer_email

    if (profileResult.data) {
      const profile = profileResult.data as Pick<ProfileRow, 'email' | 'first_name' | 'last_name'>
      payerName = `${profile.first_name} ${profile.last_name}`
      payerEmail = profile.email
    }

    const items: OrderEmailItem[] = order.order_items.map((item) => ({
      studentName: item.student_name_snapshot,
      className: item.class_name_snapshot,
      ...(item.teacher_name_snapshot ? { teacherName: item.teacher_name_snapshot } : {}),
      activityName: item.activity_name_snapshot ?? item.programme_name_snapshot ?? '',
      amountCents: item.unit_amount_cents,
    }))

    if (!payerEmail) {
      logger.warn('email_deposit_receipt_no_email', { orderId })
      await adminClient.from('email_notifications').insert({
        order_id: orderId,
        type: 'deposit_receipt' as const,
        recipient_email: '',
        subject: `${schoolName} deposit received – ${order.order_reference}`,
        status: 'skipped' as const,
        failure_details: 'No payer email address on record',
        last_attempted_at: new Date().toISOString(),
      })
      return
    }

    const { subject, html, text } = buildDepositReceiptEmail({
      schoolName,
      payerName,
      orderReference: order.order_reference,
      paymentReference: latestPayment.payment_reference,
      paidAt: latestPayment.paid_at,
      depositCents,
      totalCents,
      remainingCents: totalCents - totalPaidCents,
      items,
    })

    let notifId: string | null = null
    const { data: notifRow, error: notifInsertError } = await adminClient
      .from('email_notifications')
      .insert({
        order_id: orderId,
        type: 'deposit_receipt' as const,
        recipient_email: payerEmail,
        subject,
        status: 'pending' as const,
        last_attempted_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (notifInsertError) {
      logger.error('email_notification_pre_insert_failed', {
        orderId,
        type: 'deposit_receipt',
        error: notifInsertError.message,
      })
    } else {
      notifId = (notifRow as { id: string } | null)?.id ?? null
    }

    const resend = getResend()
    const { data, error } = await resend.emails.send({
      from: buildEmailFrom(schoolName),
      to: payerEmail,
      subject,
      html,
      text,
    })

    if (notifId) {
      await adminClient
        .from('email_notifications')
        .update({
          status: error ? ('failed' as const) : ('sent' as const),
          provider_message_id: error ? null : (data?.id ?? null),
          failure_details: error ? error.message : null,
          sent_at: error ? null : new Date().toISOString(),
        })
        .eq('id', notifId)
    } else {
      await adminClient.from('email_notifications').insert({
        order_id: orderId,
        type: 'deposit_receipt' as const,
        recipient_email: payerEmail,
        subject,
        status: error ? ('failed' as const) : ('sent' as const),
        provider_message_id: error ? null : (data?.id ?? null),
        failure_details: error ? error.message : null,
        last_attempted_at: new Date().toISOString(),
        sent_at: error ? null : new Date().toISOString(),
      })
    }

    if (error) {
      logger.error('email_deposit_receipt_failed', { orderId, error: error.message })
    } else {
      logger.info('email_deposit_receipt_sent', { orderId, messageId: data?.id })
    }
  } catch (err) {
    logger.error('email_send_deposit_email_failed', {
      orderId,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
  }
}

/**
 * Send a refund notice to the payer when a Stripe refund completes (spec §12.1).
 * Called from the webhook handler for each succeeded refund on a charge.
 * Never throws — email failure must not affect refund state or webhook response.
 */
export async function sendRefundNoticeEmail(params: {
  orderId: string
  orderReference: string
  refundReference: string
  refundAmountCents: number
  refundedAt: string
  adminClient: AdminClient
}): Promise<void> {
  const { orderId, orderReference, refundReference, refundAmountCents, refundedAt, adminClient } =
    params
  try {
    // Fetch the minimum order data needed for the refund notice
    const { data: orderData } = await adminClient
      .from('orders')
      .select(
        'school_id, payer_profile_id, guest_payer_name, guest_payer_email, total_cents, amount_paid_cents',
      )
      .eq('id', orderId)
      .single()

    if (!orderData) {
      logger.error('email_refund_notice_order_not_found', { orderId })
      return
    }

    type RefundOrderRow = {
      school_id: string
      payer_profile_id: string | null
      guest_payer_name: string | null
      guest_payer_email: string | null
      total_cents: number
      amount_paid_cents: number
    }
    const order = orderData as RefundOrderRow

    const [schoolResult, profileResult] = await Promise.all([
      adminClient.from('schools').select('name').eq('id', order.school_id).single(),
      order.payer_profile_id
        ? adminClient
            .from('profiles')
            .select('email, first_name, last_name')
            .eq('id', order.payer_profile_id)
            .single()
        : Promise.resolve({ data: null, error: null }),
    ])

    const schoolName = (schoolResult.data as Pick<SchoolRow, 'name'> | null)?.name ?? 'your school'
    let payerName = order.guest_payer_name ?? 'Parent'
    let payerEmail: string | null = order.guest_payer_email

    if (profileResult.data) {
      const profile = profileResult.data as Pick<ProfileRow, 'email' | 'first_name' | 'last_name'>
      payerName = `${profile.first_name} ${profile.last_name}`
      payerEmail = profile.email
    }

    if (!payerEmail) {
      logger.warn('email_refund_notice_no_email', { orderId })
      await adminClient.from('email_notifications').insert({
        order_id: orderId,
        type: 'refund_notice' as const,
        recipient_email: '',
        subject: `${schoolName} refund processed – ${orderReference}`,
        status: 'skipped' as const,
        failure_details: 'No payer email address on record',
        last_attempted_at: new Date().toISOString(),
      })
      return
    }

    const { subject, html, text } = buildRefundNoticeEmail({
      schoolName,
      payerName,
      orderReference,
      refundReference,
      refundedAt,
      refundAmountCents,
      remainingPaidCents: order.amount_paid_cents,
      totalCents: order.total_cents,
    })

    const retryCount = await countPriorAttempts(orderId, 'refund_notice', adminClient)

    let notifId: string | null = null
    const { data: notifRow, error: notifInsertError } = await adminClient
      .from('email_notifications')
      .insert({
        order_id: orderId,
        type: 'refund_notice' as const,
        recipient_email: payerEmail,
        subject,
        status: 'pending' as const,
        retry_count: retryCount,
        last_attempted_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (notifInsertError) {
      logger.error('email_notification_pre_insert_failed', {
        orderId,
        type: 'refund_notice',
        error: notifInsertError.message,
      })
    } else {
      notifId = (notifRow as { id: string } | null)?.id ?? null
    }

    const resend = getResend()
    const { data, error } = await resend.emails.send({
      from: buildEmailFrom(schoolName),
      to: payerEmail,
      subject,
      html,
      text,
    })

    if (notifId) {
      await adminClient
        .from('email_notifications')
        .update({
          status: error ? ('failed' as const) : ('sent' as const),
          provider_message_id: error ? null : (data?.id ?? null),
          failure_details: error ? error.message : null,
          sent_at: error ? null : new Date().toISOString(),
        })
        .eq('id', notifId)
    } else {
      await adminClient.from('email_notifications').insert({
        order_id: orderId,
        type: 'refund_notice' as const,
        recipient_email: payerEmail,
        subject,
        status: error ? ('failed' as const) : ('sent' as const),
        provider_message_id: error ? null : (data?.id ?? null),
        failure_details: error ? error.message : null,
        retry_count: retryCount,
        last_attempted_at: new Date().toISOString(),
        sent_at: error ? null : new Date().toISOString(),
      })
    }

    if (error) {
      logger.error('email_refund_notice_failed', { orderId, error: error.message })
    } else {
      logger.info('email_refund_notice_sent', { orderId, messageId: data?.id })
    }
  } catch (err) {
    logger.error('email_send_refund_notice_failed', {
      orderId,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
  }
}

/**
 * Resend a single email type for a given order.
 * Called from the admin resend action. Returns an error string on failure.
 */
export async function resendSingleEmail(
  orderId: string,
  type: 'payer_receipt' | 'school_notification',
  adminClient: AdminClient,
): Promise<{ error?: string }> {
  const gathered = await gatherOrderData(orderId, adminClient)
  if (!gathered) return { error: 'Order data not found or payment not recorded.' }

  try {
    if (type === 'payer_receipt') {
      await sendPayerReceipt(orderId, adminClient, gathered)
    } else {
      await sendSchoolNotification(orderId, adminClient, gathered)
    }
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Send failed.' }
  }
}
