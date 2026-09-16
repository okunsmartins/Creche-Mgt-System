import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/Badge'
import type { OrderRow } from '@/types/database'

export const metadata: Metadata = { title: 'Orders' }

const STATUS_TABS = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'draft' },
  { label: 'Pending', value: 'pending_payment' },
  { label: 'Paid', value: 'paid' },
  { label: 'Failed', value: 'payment_failed' },
  { label: 'Expired', value: 'expired' },
]

const SOURCE_LABEL: Record<string, string> = {
  registered_parent: 'Parent',
  guest_code: 'Guest (code)',
  guest_manual: 'Guest (manual)',
}

const PAGE_SIZE = 25

type OrderSummary = Pick<
  OrderRow,
  | 'id'
  | 'order_reference'
  | 'payer_profile_id'
  | 'guest_payer_name'
  | 'guest_payer_email'
  | 'total_cents'
  | 'status'
  | 'source'
  | 'created_at'
>

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const admin = await requireAdmin()
  const { status = '', page: pageParam = '1' } = await searchParams
  const page = Math.max(1, parseInt(pageParam, 10) || 1)
  const offset = (page - 1) * PAGE_SIZE

  const supabase = createSupabaseAdminClient()

  // Tenant scope is REQUIRED: this uses the service-role client, which bypasses
  // RLS, so without it every admin lists EVERY school's orders — including guest
  // payer names and emails.
  let query = supabase
    .from('orders')
    .select(
      'id, order_reference, payer_profile_id, guest_payer_name, guest_payer_email, total_cents, status, source, created_at',
      { count: 'exact' },
    )
    .eq('school_id', admin.schoolId!)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, count } = await query
  const orders = (data as OrderSummary[] | null) ?? []
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  const buildHref = (p: number, s: string) => {
    const params = new URLSearchParams()
    if (s) params.set('status', s)
    if (p > 1) params.set('page', String(p))
    const q = params.toString()
    return `/admin/orders${q ? `?${q}` : ''}`
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Orders</h1>
        <span className="text-sm text-text-muted">{count ?? 0} total</span>
      </div>

      {/* Status filter tabs */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-border pb-4">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={buildHref(1, tab.value)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              status === tab.value
                ? 'bg-primary text-white'
                : 'bg-surface text-text-secondary hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface py-16 text-center">
          <p className="text-text-muted">No orders found.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">Reference</th>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">Payer</th>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">Source</th>
                  <th className="px-4 py-3 text-right font-medium text-text-muted">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order) => {
                  const payerName =
                    order.guest_payer_name ?? (order.payer_profile_id ? 'Registered parent' : '—')
                  const payerEmail = order.guest_payer_email ?? ''

                  const href = `/admin/orders/${order.id}`
                  const cellClass = 'px-4 py-3'
                  const linkClass = "block after:absolute after:inset-0 after:content-['']"

                  return (
                    <tr key={order.id} className="relative hover:bg-surface/50">
                      <td className={`${cellClass} font-mono text-xs`}>
                        <Link href={href} className={`text-primary hover:underline ${linkClass}`}>
                          {order.order_reference}
                        </Link>
                      </td>
                      <td className={cellClass}>
                        <p className="font-medium text-text-primary">{payerName}</p>
                        {payerEmail && <p className="text-xs text-text-muted">{payerEmail}</p>}
                      </td>
                      <td className={`${cellClass} text-text-secondary`}>
                        {SOURCE_LABEL[order.source] ?? order.source}
                      </td>
                      <td className={`${cellClass} text-right font-medium text-text-primary`}>
                        {formatCurrency(order.total_cents)}
                      </td>
                      <td className={cellClass}>
                        <StatusBadge status={order.status} />
                      </td>
                      <td className={`${cellClass} text-text-secondary`}>
                        {formatDate(order.created_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
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
