import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { schoolHasProAccess } from '@/lib/subscriptions/access'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/Badge'
import { ExportCsvLink } from '@/components/reports/ExportCsvLink'
import { PrintButton } from '@/components/ui/PrintButton'
import type { OrderRow, PaymentRow, RefundRow } from '@/types/database'

export const metadata: Metadata = { title: 'Reports' }

const SOURCE_LABEL: Record<string, string> = {
  registered_parent: 'Parent',
  guest_code: 'Guest (code)',
  guest_manual: 'Guest (manual)',
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; source?: string; from?: string; to?: string }>
}) {
  const admin = await requireAdmin()
  const isPro = await schoolHasProAccess(admin.schoolId!)
  const filters = await searchParams
  const { status = '', source = '', from = '', to = '' } = filters

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
    payments: Pick<PaymentRow, 'payment_reference' | 'paid_at' | 'amount_cents'>[]
    refunds: Pick<RefundRow, 'amount_cents' | 'status'>[]
  }

  type ActivitySummary = {
    id: string
    name: string
    amount_cents: number
    publication_status: string
    order_items: { id: string; unit_amount_cents: number; orders: { status: string } }[]
  }

  let ledgerQuery = adminClient
    .from('orders')
    .select(
      'id, order_reference, guest_payer_name, guest_payer_email, payer_profile_id, total_cents, status, source, created_at, payments(payment_reference, paid_at, amount_cents), refunds(amount_cents, status)',
    )
    .eq('school_id', admin.schoolId!)
    .order('created_at', { ascending: false })
    .limit(100)

  if (status) ledgerQuery = ledgerQuery.eq('status', status)
  if (source) ledgerQuery = ledgerQuery.eq('source', source)
  if (from) ledgerQuery = ledgerQuery.gte('created_at', from)
  if (to) ledgerQuery = ledgerQuery.lte('created_at', `${to}T23:59:59Z`)

  const [ledgerResult, activityResult, refundResult] = await Promise.all([
    ledgerQuery,
    adminClient
      .from('activities')
      .select(
        'id, name, amount_cents, publication_status, order_items(id, unit_amount_cents, orders!inner(status, school_id))',
      )
      .eq('school_id', admin.schoolId!)
      .in('publication_status', ['published', 'archived'])
      .order('name')
      .limit(50),
    adminClient
      .from('refunds')
      .select(
        'refund_reference, amount_cents, reason, status, created_at, orders!inner(order_reference, guest_payer_name, school_id)',
      )
      .eq('orders.school_id', admin.schoolId!)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const orders = (ledgerResult.data as unknown as OrderLedger[]) ?? []
  const activities = (activityResult.data as unknown as ActivitySummary[]) ?? []
  const refunds =
    (refundResult.data as unknown as {
      refund_reference: string
      amount_cents: number
      reason: string | null
      status: string
      created_at: string
      orders: { order_reference: string; guest_payer_name: string | null }
    }[]) ?? []

  const paidOrders = orders.filter((o) =>
    ['paid', 'partially_refunded', 'fully_refunded'].includes(o.status),
  )
  const grossCents = paidOrders.reduce((s, o) => s + o.total_cents, 0)
  const refundedCents = orders.reduce(
    (s, o) =>
      s +
      o.refunds.filter((r) => r.status === 'succeeded').reduce((rs, r) => rs + r.amount_cents, 0),
    0,
  )
  const netCents = grossCents - refundedCents

  const exportParams = new URLSearchParams()
  if (status) exportParams.set('status', status)
  if (source) exportParams.set('source', source)
  if (from) exportParams.set('from', from)
  if (to) exportParams.set('to', to)
  const exportQuery = exportParams.toString()

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-text-primary">Reports</h1>
        <PrintButton label="Print report" />
      </div>

      {/* Summary totals (FR-ADM-001 / AT-015) */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-text-primary">Summary</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Gross collected', value: formatCurrency(grossCents), color: 'text-success' },
            { label: 'Refunded', value: formatCurrency(refundedCents), color: 'text-error' },
            { label: 'Net collected', value: formatCurrency(netCents), color: 'text-primary' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg border border-border bg-surface p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
              <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Payment ledger (FR-ADM-003 / AT-015 / AT-016) */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-text-primary">Payment Ledger</h2>
          <ExportCsvLink
            href={`/api/admin/reports/payments${exportQuery ? `?${exportQuery}` : ''}`}
            isPro={isPro}
          />
        </div>

        <form method="GET" className="mb-4 flex flex-wrap gap-3">
          <select
            name="status"
            defaultValue={status}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary"
          >
            <option value="">All statuses</option>
            <option value="paid">Paid</option>
            <option value="partially_refunded">Part Refunded</option>
            <option value="fully_refunded">Fully Refunded</option>
            <option value="pending_payment">Pending</option>
            <option value="payment_failed">Failed</option>
            <option value="expired">Expired</option>
          </select>
          <select
            name="source"
            defaultValue={source}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary"
          >
            <option value="">All sources</option>
            <option value="registered_parent">Registered Parent</option>
            <option value="guest_code">Guest (code)</option>
            <option value="guest_manual">Guest (manual)</option>
          </select>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary"
            suppressHydrationWarning
          />
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary"
            suppressHydrationWarning
          />
          <button
            type="submit"
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90"
          >
            Filter
          </button>
          <a
            href="/admin/reports"
            className="rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-surface"
          >
            Clear
          </a>
        </form>

        {orders.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface py-10 text-center">
            <p className="text-sm text-text-muted">No orders match the current filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface">
                <tr>
                  {[
                    'Reference',
                    'Date',
                    'Payer',
                    'Source',
                    'Total',
                    'Refunded',
                    'Net',
                    'Status',
                  ].map((h) => (
                    <th
                      key={h}
                      className={`px-4 py-3 font-medium text-text-muted ${['Total', 'Refunded', 'Net'].includes(h) ? 'text-right' : 'text-left'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((o) => {
                  const refundedTotal = o.refunds
                    .filter((r) => r.status === 'succeeded')
                    .reduce((s, r) => s + r.amount_cents, 0)
                  const payerName =
                    o.guest_payer_name ?? (o.payer_profile_id ? 'Registered parent' : '—')
                  return (
                    <tr key={o.id} className="hover:bg-surface/50">
                      <td className="px-4 py-3 font-mono text-xs">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="text-primary hover:underline"
                        >
                          {o.order_reference}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{formatDate(o.created_at)}</td>
                      <td className="px-4 py-3 text-text-primary">{payerName}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {SOURCE_LABEL[o.source] ?? o.source}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-text-primary">
                        {formatCurrency(o.total_cents)}
                      </td>
                      <td className="px-4 py-3 text-right text-error">
                        {refundedTotal > 0 ? formatCurrency(refundedTotal) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-text-primary">
                        {formatCurrency(o.total_cents - refundedTotal)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={o.status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Activity report (FR-ADM-003) */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">Activity Report</h2>
          <ExportCsvLink href="/api/admin/reports/activities" isPro={isPro} />
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface">
              <tr>
                {['Activity', 'Price', 'Paid', 'Gross', 'Refunded', 'Net', 'Status'].map((h) => (
                  <th
                    key={h}
                    className={`px-4 py-3 font-medium text-text-muted ${['Price', 'Paid', 'Gross', 'Refunded', 'Net'].includes(h) ? 'text-right' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activities.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                    No activities found.
                  </td>
                </tr>
              )}
              {activities.map((a) => {
                const paidItems = a.order_items.filter((i) =>
                  ['paid', 'partially_refunded', 'fully_refunded'].includes(i.orders.status),
                )
                const refundedItems = a.order_items.filter(
                  (i) => i.orders.status === 'fully_refunded',
                )
                const grossCentsAct = paidItems.reduce((s, i) => s + i.unit_amount_cents, 0)
                const refundedCentsAct = refundedItems.reduce((s, i) => s + i.unit_amount_cents, 0)
                return (
                  <tr key={a.id} className="hover:bg-surface/50">
                    <td className="px-4 py-3 font-medium text-text-primary">{a.name}</td>
                    <td className="px-4 py-3 text-right text-text-secondary">
                      {formatCurrency(a.amount_cents)}
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary">{paidItems.length}</td>
                    <td className="px-4 py-3 text-right font-medium text-text-primary">
                      {formatCurrency(grossCentsAct)}
                    </td>
                    <td className="px-4 py-3 text-right text-error">
                      {refundedCentsAct > 0 ? formatCurrency(refundedCentsAct) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-text-primary">
                      {formatCurrency(grossCentsAct - refundedCentsAct)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={a.publication_status} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Refunds (FR-ADM-003) */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">Refunds</h2>
          <ExportCsvLink href="/api/admin/reports/refunds" isPro={isPro} />
        </div>
        {refunds.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface py-8 text-center">
            <p className="text-sm text-text-muted">No refunds recorded.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface">
                <tr>
                  {['Ref', 'Date', 'Order', 'Payer', 'Amount', 'Reason', 'Status'].map((h) => (
                    <th
                      key={h}
                      className={`px-4 py-3 font-medium text-text-muted ${h === 'Amount' ? 'text-right' : 'text-left'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {refunds.map((r) => (
                  <tr key={r.refund_reference} className="hover:bg-surface/50">
                    <td className="px-4 py-3 font-mono text-xs text-text-muted">
                      {r.refund_reference}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{formatDate(r.created_at)}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {r.orders?.order_reference ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {r.orders?.guest_payer_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-text-primary">
                      {formatCurrency(r.amount_cents)}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-secondary">{r.reason ?? '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
