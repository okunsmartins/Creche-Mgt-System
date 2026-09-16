import { type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth/guards'
import { schoolHasProAccess } from '@/lib/subscriptions/access'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { buildCsv, csvResponse, csvEuros, csvDate } from '@/lib/reports/utils'
import { createCorrelationId } from '@/lib/utils'
import type { RefundRow } from '@/types/database'

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

  const adminClient = createSupabaseAdminClient()

  type RefundWithContext = Pick<
    RefundRow,
    'refund_reference' | 'amount_cents' | 'reason' | 'status' | 'provider_refund_id' | 'created_at'
  > & {
    orders: {
      order_reference: string
      guest_payer_name: string | null
      guest_payer_email: string | null
    }
    payments: { payment_reference: string }
    profiles: { first_name: string; last_name: string; email: string } | null
  }

  let query = adminClient
    .from('refunds')
    .select(
      'refund_reference, amount_cents, reason, status, provider_refund_id, created_at, orders!inner(order_reference, guest_payer_name, guest_payer_email, school_id), payments(payment_reference), profiles(first_name, last_name, email)',
    )
    .eq('orders.school_id', admin.schoolId)
    .order('created_at', { ascending: false })
    .limit(2000)

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return new Response('Failed to fetch data', { status: 500 })

  const refunds = (data as unknown as RefundWithContext[]) ?? []

  const headers = [
    'Refund Reference',
    'Date',
    'Order Reference',
    'Payment Reference',
    'Payer',
    'Amount EUR',
    'Reason',
    'Status',
    'Stripe Refund ID',
    'Initiated By',
  ]

  const rows = refunds.map((r) => {
    const initiator = r.profiles
      ? `${r.profiles.first_name} ${r.profiles.last_name} (${r.profiles.email})`
      : 'System'
    const payer = r.orders.guest_payer_name ?? r.orders.guest_payer_email ?? '—'

    return [
      r.refund_reference,
      csvDate(r.created_at),
      r.orders.order_reference,
      r.payments?.payment_reference ?? '',
      payer,
      csvEuros(r.amount_cents),
      r.reason ?? '',
      r.status,
      r.provider_refund_id ?? '',
      initiator,
    ]
  })

  await adminClient.from('audit_logs').insert({
    school_id: admin.schoolId,
    actor_id: admin.id,
    actor_email: admin.email,
    action: 'report.exported',
    resource_type: 'report',
    resource_id: 'refund_report',
    metadata: { filters: { status }, row_count: rows.length },
    correlation_id: createCorrelationId(),
  })

  const csv = buildCsv(headers, rows)
  const filename = `refund-report-${new Date().toISOString().slice(0, 10)}.csv`
  return csvResponse(filename, csv)
}
