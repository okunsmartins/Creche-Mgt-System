import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { schoolHasProAccess } from '@/lib/subscriptions/access'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/Badge'
import { ExportCsvLink } from '@/components/reports/ExportCsvLink'
import type { PaymentRow, OrderRow } from '@/types/database'

export const metadata: Metadata = { title: 'Payments' }

const PAGE_SIZE = 25

type PaymentRecord = Pick<
  PaymentRow,
  | 'id'
  | 'payment_reference'
  | 'amount_cents'
  | 'refunded_amount_cents'
  | 'currency'
  | 'status'
  | 'provider'
  | 'paid_at'
  | 'created_at'
> & {
  orders: Pick<
    OrderRow,
    | 'id'
    | 'order_reference'
    | 'guest_payer_name'
    | 'guest_payer_email'
    | 'payer_profile_id'
    | 'source'
  > | null
}

const PROVIDER_LABEL: Record<string, string> = {
  stripe: 'Stripe',
  revolut: 'Revolut',
}

const STATUS_TABS = [
  { label: 'All', value: '' },
  { label: 'Paid', value: 'paid' },
  { label: 'Partially refunded', value: 'partially_refunded' },
  { label: 'Fully refunded', value: 'refunded' },
]

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; from?: string; to?: string; page?: string }>
}) {
  const admin = await requireAdmin()

  if (!admin.schoolId) {
    return <p className="text-error">No school is associated with your account.</p>
  }

  const isPro = await schoolHasProAccess(admin.schoolId)
  const { status = '', from = '', to = '', page: pageParam = '1' } = await searchParams
  const page = Math.max(1, parseInt(pageParam, 10) || 1)
  const offset = (page - 1) * PAGE_SIZE

  const adminClient = createSupabaseAdminClient()

  let query = adminClient
    .from('payments')
    .select(
      'id, payment_reference, amount_cents, refunded_amount_cents, currency, status, provider, paid_at, created_at, orders!inner(id, order_reference, guest_payer_name, guest_payer_email, payer_profile_id, source, school_id)',
      { count: 'exact' },
    )
    .eq('orders.school_id', admin.schoolId)
    .order('paid_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (status) query = query.eq('status', status)
  if (from) query = query.gte('paid_at', from)
  if (to) query = query.lte('paid_at', `${to}T23:59:59`)

  const { data, count } = await query
  const payments = (data as unknown as PaymentRecord[]) ?? []
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  // Summary totals — always all statuses, but respects the date range filter.
  // NOTE: Supabase query builder is immutable — each chained call returns a new
  // object, so we must reassign (let, not const) or the filter is silently dropped.
  let summaryQuery = adminClient
    .from('payments')
    .select('amount_cents, refunded_amount_cents, orders!inner(school_id)')
    .eq('orders.school_id', admin.schoolId)

  if (from) summaryQuery = summaryQuery.gte('paid_at', from)
  if (to) summaryQuery = summaryQuery.lte('paid_at', `${to}T23:59:59`)

  const { data: summaryData } = await summaryQuery
  const allRows =
    (summaryData as unknown as { amount_cents: number; refunded_amount_cents: number }[]) ?? []

  const gross = allRows.reduce((s, r) => s + r.amount_cents, 0)
  const refunded = allRows.reduce((s, r) => s + r.refunded_amount_cents, 0)
  const net = gross - refunded

  const buildHref = (p: number, s: string) => {
    const params = new URLSearchParams()
    if (s) params.set('status', s)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (p > 1) params.set('page', String(p))
    const q = params.toString()
    return `/admin/payments${q ? `?${q}` : ''}`
  }

  const csvParams = new URLSearchParams()
  if (status) csvParams.set('status', status)
  if (from) csvParams.set('from', from)
  if (to) csvParams.set('to', to)
  const csvHref = `/api/admin/reports/payments${csvParams.toString() ? `?${csvParams}` : ''}`

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Payments</h1>
        <span className="text-sm text-text-muted">{count ?? 0} total</span>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Gross collected
          </p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{formatCurrency(gross)}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Total refunded
          </p>
          <p className="mt-1 text-2xl font-bold text-error">{formatCurrency(refunded)}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Net received
          </p>
          <p className="mt-1 text-2xl font-bold text-primary">{formatCurrency(net)}</p>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted" htmlFor="from">
            From
          </label>
          <input
            id="from"
            type="date"
            name="from"
            defaultValue={from}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary"
            suppressHydrationWarning
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted" htmlFor="to">
            To
          </label>
          <input
            id="to"
            type="date"
            name="to"
            defaultValue={to}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary"
            suppressHydrationWarning
          />
        </div>
        {status && <input type="hidden" name="status" value={status} />}
        <button
          type="submit"
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90"
        >
          Filter
        </button>
        <Link
          href="/admin/payments"
          className="rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-surface"
        >
          Clear
        </Link>
        <span className="ml-auto">
          <ExportCsvLink href={csvHref} isPro={isPro} />
        </span>
      </form>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-4">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={buildHref(1, tab.value)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              status === tab.value
                ? 'bg-primary text-white'
                : 'bg-surface text-text-secondary hover:bg-surface/80'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {payments.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface py-16 text-center">
          <p className="text-text-muted">No payments found.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">Payment ref</th>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">Order ref</th>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">Payer</th>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">Provider</th>
                  <th className="px-4 py-3 text-right font-medium text-text-muted">Amount</th>
                  <th className="px-4 py-3 text-right font-medium text-text-muted">Refunded</th>
                  <th className="px-4 py-3 text-right font-medium text-text-muted">Net</th>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">Paid at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((p) => {
                  const order = p.orders
                  const payerName =
                    order?.guest_payer_name ?? (order?.payer_profile_id ? 'Registered parent' : '—')
                  const payerEmail = order?.guest_payer_email ?? ''
                  const net = p.amount_cents - p.refunded_amount_cents

                  return (
                    <tr key={p.id} className="hover:bg-surface/50">
                      <td className="px-4 py-3 font-mono text-xs text-text-muted">
                        {p.payment_reference}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {order ? (
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="text-primary hover:underline"
                          >
                            {order.order_reference}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-text-primary">{payerName}</p>
                        {payerEmail && <p className="text-xs text-text-muted">{payerEmail}</p>}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {PROVIDER_LABEL[p.provider] ?? p.provider}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-text-primary">
                        {formatCurrency(p.amount_cents)}
                      </td>
                      <td className="px-4 py-3 text-right text-error">
                        {p.refunded_amount_cents > 0
                          ? formatCurrency(p.refunded_amount_cents)
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-text-primary">
                        {formatCurrency(net)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {p.paid_at ? formatDate(p.paid_at) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={buildHref(page - 1, status)}
                    className="rounded-md border border-border px-3 py-1.5 hover:bg-surface"
                  >
                    Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={buildHref(page + 1, status)}
                    className="rounded-md border border-border px-3 py-1.5 hover:bg-surface"
                  >
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
