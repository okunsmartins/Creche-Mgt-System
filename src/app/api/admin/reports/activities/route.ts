import { type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth/guards'
import { schoolHasProAccess } from '@/lib/subscriptions/access'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { buildCsv, csvResponse, csvEuros } from '@/lib/reports/utils'
import { createCorrelationId } from '@/lib/utils'

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
  const activityId = searchParams.get('activityId') ?? ''

  const adminClient = createSupabaseAdminClient()

  let actQuery = adminClient
    .from('activities')
    .select(
      'id, name, amount_cents, publication_status, order_items(id, unit_amount_cents, orders!inner(status, school_id))',
    )
    .eq('school_id', admin.schoolId)
    .order('name')

  if (activityId) actQuery = actQuery.eq('id', activityId)

  const { data, error } = await actQuery
  if (error) return new Response('Failed to fetch data', { status: 500 })

  type ActivityExportRow = {
    id: string
    name: string
    amount_cents: number
    publication_status: string
    order_items: {
      id: string
      unit_amount_cents: number
      orders: { status: string; school_id: string }
    }[]
  }

  const activities = (data as unknown as ActivityExportRow[]) ?? []

  const headers = [
    'Activity',
    'Price EUR',
    'Status',
    'Paid Items',
    'Refunded Items',
    'Gross EUR',
    'Refunds EUR',
    'Net EUR',
  ]

  const rows = activities.map((a) => {
    const paidItems = a.order_items.filter((i) =>
      ['paid', 'partially_refunded', 'fully_refunded'].includes(i.orders.status),
    )
    const refundedItems = a.order_items.filter((i) => ['fully_refunded'].includes(i.orders.status))
    const grossCents = paidItems.reduce((s, i) => s + i.unit_amount_cents, 0)
    const refundedCents = refundedItems.reduce((s, i) => s + i.unit_amount_cents, 0)

    return [
      a.name,
      csvEuros(a.amount_cents),
      a.publication_status,
      paidItems.length,
      refundedItems.length,
      csvEuros(grossCents),
      csvEuros(refundedCents),
      csvEuros(grossCents - refundedCents),
    ]
  })

  await adminClient.from('audit_logs').insert({
    school_id: admin.schoolId,
    actor_id: admin.id,
    actor_email: admin.email,
    action: 'report.exported',
    resource_type: 'report',
    resource_id: 'activity_report',
    metadata: { filters: { activityId }, row_count: rows.length },
    correlation_id: createCorrelationId(),
  })

  const csv = buildCsv(headers, rows)
  const filename = `activity-report-${new Date().toISOString().slice(0, 10)}.csv`
  return csvResponse(filename, csv)
}
