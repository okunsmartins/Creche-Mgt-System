import { type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth/guards'
import { schoolHasProAccess } from '@/lib/subscriptions/access'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { buildCsv, csvResponse, csvEuros, csvDate } from '@/lib/reports/utils'
import { createCorrelationId } from '@/lib/utils'
import type { OrderRow, PaymentRow } from '@/types/database'

// AT-016: CSV export with formula-injection protection
// AT-017: export action creates audit entry
export async function GET(request: NextRequest): Promise<Response> {
  let admin: Awaited<ReturnType<typeof requireAdmin>>
  try {
    admin = await requireAdmin()
  } catch {
    return new Response('Unauthorised', { status: 401 })
  }

  // Advanced reports (CSV export) is a Pro feature.
  if (!admin.schoolId || !(await schoolHasProAccess(admin.schoolId))) {
    return new Response('Upgrade to Pro to export reports.', { status: 403 })
  }

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status') ?? ''
  const source = searchParams.get('source') ?? ''
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''

  const adminClient = createSupabaseAdminClient()

  type OrderLedger = Pick<
    OrderRow,
    | 'id'
    | 'order_reference'
    | 'guest_payer_name'
    | 'guest_payer_email'
    | 'payer_profile_id'
    | 'total_cents'
    | 'status'
    | 'source'
    | 'created_at'
  > & {
    payments: Pick<
      PaymentRow,
      | 'payment_reference'
      | 'provider_checkout_session_id'
      | 'provider_payment_intent_id'
      | 'paid_at'
      | 'amount_cents'
    >[]
    refunds: { amount_cents: number; status: string }[]
    email_notifications: { type: string; status: string }[]
  }

  let query = adminClient
    .from('orders')
    .select(
      'id, order_reference, guest_payer_name, guest_payer_email, payer_profile_id, total_cents, status, source, created_at, payments(payment_reference, provider_checkout_session_id, provider_payment_intent_id, paid_at, amount_cents), refunds(amount_cents, status), email_notifications(type, status)',
    )
    .eq('school_id', admin.schoolId)
    .order('created_at', { ascending: false })
    .limit(2000)

  if (status) query = query.eq('status', status)
  if (source) query = query.eq('source', source)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', `${to}T23:59:59Z`)

  const { data, error } = await query
  if (error) return new Response('Failed to fetch data', { status: 500 })

  const orders = (data as unknown as OrderLedger[]) ?? []

  const headers = [
    'Order Reference',
    'Date',
    'Payer',
    'Email',
    'Source',
    'Status',
    'Total EUR',
    'Refunded EUR',
    'Net EUR',
    'Payment Reference',
    'Stripe Session ID',
    'Stripe Intent ID',
    'Paid At',
    'Receipt Email',
    'School Email',
  ]

  const SOURCE_LABEL: Record<string, string> = {
    registered_parent: 'Registered Parent',
    guest_code: 'Guest (Code)',
    guest_manual: 'Guest (Manual)',
  }

  const rows = orders.map((o) => {
    const payment = o.payments[0]
    const refundedCents = o.refunds
      .filter((r) => r.status === 'succeeded')
      .reduce((s, r) => s + r.amount_cents, 0)
    const netCents = o.total_cents - refundedCents
    const receiptEmail =
      o.email_notifications.find((e) => e.type === 'payer_receipt')?.status ?? '—'
    const schoolEmail =
      o.email_notifications.find((e) => e.type === 'school_notification')?.status ?? '—'
    const payerName = o.guest_payer_name ?? (o.payer_profile_id ? 'Registered parent' : '—')

    return [
      o.order_reference,
      csvDate(o.created_at),
      payerName,
      o.guest_payer_email ?? '',
      SOURCE_LABEL[o.source] ?? o.source,
      o.status,
      csvEuros(o.total_cents),
      csvEuros(refundedCents),
      csvEuros(netCents),
      payment?.payment_reference ?? '',
      payment?.provider_checkout_session_id ?? '',
      payment?.provider_payment_intent_id ?? '',
      csvDate(payment?.paid_at ?? null),
      receiptEmail,
      schoolEmail,
    ]
  })

  // AT-017: audit the export
  await adminClient.from('audit_logs').insert({
    school_id: admin.schoolId,
    actor_id: admin.id,
    actor_email: admin.email,
    action: 'report.exported',
    resource_type: 'report',
    resource_id: 'payment_ledger',
    metadata: {
      filters: { status, source, from, to },
      row_count: rows.length,
    },
    correlation_id: createCorrelationId(),
  })

  const csv = buildCsv(headers, rows)
  const filename = `payment-ledger-${new Date().toISOString().slice(0, 10)}.csv`
  return csvResponse(filename, csv)
}
