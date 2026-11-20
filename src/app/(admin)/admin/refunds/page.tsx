import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { schoolHasProAccess } from '@/lib/subscriptions/access'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/Badge'
import { ExportCsvLink } from '@/components/reports/ExportCsvLink'
import { listFeeRefunds } from '@/lib/fees/refund-list'

export const metadata: Metadata = { title: 'Refunds' }

export default async function AdminRefundsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const admin = await requireAdmin()
  const isPro = await schoolHasProAccess(admin.schoolId!)
  const { status = '' } = await searchParams

  const adminClient = createSupabaseAdminClient()

  type RefundRow = {
    id: string
    refund_reference: string
    amount_cents: number
    reason: string | null
    status: string
    provider_refund_id: string | null
    created_at: string
    orders: {
      id: string
      order_reference: string
      guest_payer_name: string | null
      school_id: string
    }
    payments: { payment_reference: string } | null
    profiles: { first_name: string; last_name: string } | null
  }

  let query = adminClient
    .from('refunds')
    .select(
      'id, refund_reference, amount_cents, reason, status, provider_refund_id, created_at, orders!inner(id, order_reference, guest_payer_name, school_id), payments(payment_reference), profiles(first_name, last_name)',
    )
    .eq('orders.school_id', admin.schoolId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (status) query = query.eq('status', status)

  // Invoice / late-fee refunds are always completed when recorded, so they only show
  // under "All statuses" or "Succeeded".
  const showFeeRefunds = status === '' || status === 'succeeded'
  const [{ data }, feeRefunds] = await Promise.all([
    query,
    showFeeRefunds ? listFeeRefunds(adminClient, admin.schoolId!) : Promise.resolve([]),
  ])
  const refunds = (data as unknown as RefundRow[]) ?? []

  const totals = refunds.reduce(
    (acc, r) => {
      if (r.status === 'succeeded') acc.succeeded += r.amount_cents
      else if (r.status === 'pending' || r.status === 'processing') acc.pending += r.amount_cents
      return acc
    },
    { succeeded: 0, pending: 0 },
  )
  totals.succeeded += feeRefunds.reduce((s, r) => s + r.amountCents, 0)

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-text-primary">Refunds</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Total refunded
          </p>
          <p className="mt-1 text-2xl font-bold text-error">{formatCurrency(totals.succeeded)}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Pending / processing
          </p>
          <p className="mt-1 text-2xl font-bold text-text-primary">
            {formatCurrency(totals.pending)}
          </p>
        </div>
      </div>

      <form method="GET" className="flex flex-wrap gap-3">
        <select
          name="status"
          defaultValue={status}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="succeeded">Succeeded</option>
          <option value="cancelled">Cancelled</option>
          <option value="failed">Failed</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90"
        >
          Filter
        </button>
        <a
          href="/admin/refunds"
          className="rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-surface"
        >
          Clear
        </a>
        <span className="ml-auto">
          <ExportCsvLink href="/api/admin/reports/refunds" isPro={isPro} />
        </span>
      </form>

      {feeRefunds.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-text-primary">Fees &amp; late-fee refunds</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface">
                <tr>
                  {[
                    'Date',
                    'For',
                    'Child',
                    'Payment',
                    'Initiated by',
                    'Amount',
                    'Reason',
                    'Status',
                  ].map((h) => (
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
                {feeRefunds.map((r) => (
                  <tr key={r.id} className="hover:bg-surface/50">
                    <td className="px-4 py-3 text-text-secondary">{formatDate(r.createdAt)}</td>
                    <td className="px-4 py-3 text-text-secondary">{r.subjectLabel}</td>
                    <td className="px-4 py-3">
                      {r.studentId ? (
                        <Link
                          href={`/admin/fees/${r.studentId}`}
                          className="text-primary hover:underline"
                        >
                          {r.childName}
                        </Link>
                      ) : (
                        r.childName
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-text-muted">
                      {r.paymentReference ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{r.initiatedBy}</td>
                    <td className="px-4 py-3 text-right font-medium text-text-primary">
                      {formatCurrency(r.amountCents)}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-xs text-text-secondary">
                      {r.reason ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status="succeeded" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {feeRefunds.length > 0 && refunds.length > 0 && (
        <h2 className="text-base font-semibold text-text-primary">Order refunds</h2>
      )}
      {refunds.length === 0 ? (
        feeRefunds.length === 0 && (
          <div className="rounded-lg border border-border bg-surface py-12 text-center">
            <p className="text-sm text-text-muted">No refunds found.</p>
          </div>
        )
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface">
              <tr>
                {[
                  'Reference',
                  'Date',
                  'Order',
                  'Payer',
                  'Initiated by',
                  'Amount',
                  'Reason',
                  'Status',
                ].map((h) => (
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
                <tr key={r.id} className="hover:bg-surface/50">
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">
                    {r.refund_reference}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link
                      href={`/admin/orders/${r.orders?.id}`}
                      className="text-primary hover:underline"
                    >
                      {r.orders?.order_reference ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {r.orders?.guest_payer_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-text-primary">
                    {formatCurrency(r.amount_cents)}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-xs text-text-secondary">
                    {r.reason ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
