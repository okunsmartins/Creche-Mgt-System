import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/guards'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/Badge'
import { ResendEmailButton } from '@/components/email/ResendEmailButton'
import { RefundForm } from '@/components/refunds/RefundForm'
import type {
  OrderRow,
  OrderItemRow,
  PaymentRow,
  EmailNotificationRow,
  RefundRow,
} from '@/types/database'

export const metadata: Metadata = { title: 'Order Detail' }

const SOURCE_LABEL: Record<string, string> = {
  registered_parent: 'Registered parent',
  guest_code: 'Guest (pupil code)',
  guest_manual: 'Guest (manual entry)',
}

const EMAIL_TYPE_LABEL: Record<string, string> = {
  payer_receipt: 'Payer receipt',
  school_notification: 'School notification',
  deposit_receipt: 'Deposit receipt',
}

type OrderDetail = Pick<
  OrderRow,
  | 'id'
  | 'order_reference'
  | 'payer_profile_id'
  | 'guest_payer_name'
  | 'guest_payer_email'
  | 'total_cents'
  | 'amount_paid_cents'
  | 'status'
  | 'source'
  | 'created_at'
>

interface PageProps {
  params: Promise<{ orderId: string }>
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const admin = await requireAdmin()
  const { orderId } = await params

  const adminClient = createSupabaseAdminClient()

  const [orderResult, itemsResult, paymentResult, emailsResult, refundsResult] = await Promise.all([
    // Tenant scope is REQUIRED here: this uses the service-role client, which
    // bypasses RLS, so without it any admin could read another school's order
    // (payer name/email, pupil names, payments) just by knowing the id.
    // A non-matching id yields no row → notFound() below.
    adminClient
      .from('orders')
      .select(
        'id, order_reference, payer_profile_id, guest_payer_name, guest_payer_email, total_cents, amount_paid_cents, status, source, created_at',
      )
      .eq('id', orderId)
      .eq('school_id', admin.schoolId!)
      .maybeSingle(),
    adminClient
      .from('order_items')
      .select(
        'id, student_name_snapshot, class_name_snapshot, activity_name_snapshot, unit_amount_cents, item_reference, verification_status',
      )
      .eq('order_id', orderId)
      .order('created_at'),
    adminClient.from('payments').select('*').eq('order_id', orderId).order('paid_at'),
    adminClient
      .from('email_notifications')
      .select('id, type, recipient_email, subject, status, sent_at, failure_details, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false }),
    adminClient
      .from('refunds')
      .select(
        'id, payment_id, refund_reference, amount_cents, reason, status, provider_refund_id, created_at',
      )
      .eq('order_id', orderId)
      .order('created_at', { ascending: false }),
  ])

  const order = orderResult.data as OrderDetail | null
  if (!order) notFound()

  type ItemDetail = Pick<
    OrderItemRow,
    | 'id'
    | 'student_name_snapshot'
    | 'class_name_snapshot'
    | 'activity_name_snapshot'
    | 'unit_amount_cents'
    | 'item_reference'
    | 'verification_status'
  >
  const items = (itemsResult.data as ItemDetail[] | null) ?? []
  const payments = (paymentResult.data as PaymentRow[] | null) ?? []

  type EmailRow = Pick<
    EmailNotificationRow,
    | 'id'
    | 'type'
    | 'recipient_email'
    | 'subject'
    | 'status'
    | 'sent_at'
    | 'failure_details'
    | 'created_at'
  >
  const emails = (emailsResult.data as EmailRow[] | null) ?? []

  type RefundDetail = Pick<
    RefundRow,
    | 'id'
    | 'payment_id'
    | 'refund_reference'
    | 'amount_cents'
    | 'reason'
    | 'status'
    | 'provider_refund_id'
    | 'created_at'
  >
  const refunds = (refundsResult.data as RefundDetail[] | null) ?? []

  // Compute refunded totals per payment_id (pending/processing/succeeded only)
  const refundedByPaymentId = new Map<string, number>()
  for (const r of refunds) {
    if (['pending', 'processing', 'succeeded'].includes(r.status)) {
      refundedByPaymentId.set(
        r.payment_id,
        (refundedByPaymentId.get(r.payment_id) ?? 0) + r.amount_cents,
      )
    }
  }
  const payerName = order.guest_payer_name ?? (order.payer_profile_id ? 'Registered parent' : '—')
  const payerEmail = order.guest_payer_email ?? '—'
  const isPaid = order.status === 'paid'
  const isRefundable = order.status === 'paid' || order.status === 'partially_refunded'

  void admin

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-text-muted">
        <Link href="/admin/orders" className="hover:text-primary hover:underline">
          Orders
        </Link>
        {' / '}
        <span className="font-mono text-text-primary">{order.order_reference}</span>
      </nav>

      {/* Order header */}
      <div className="rounded-lg border border-border bg-surface p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-mono text-xl font-bold text-text-primary">
              {order.order_reference}
            </h1>
            <p className="mt-1 text-sm text-text-muted">{formatDate(order.created_at, true)}</p>
          </div>
          <StatusBadge status={order.status} />
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-text-muted">Payer</dt>
            <dd className="font-medium text-text-primary">{payerName}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Email</dt>
            <dd className="text-text-primary">{payerEmail}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Source</dt>
            <dd className="text-text-primary">{SOURCE_LABEL[order.source] ?? order.source}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Total</dt>
            <dd className="text-lg font-bold text-text-primary">
              {formatCurrency(order.total_cents)}
            </dd>
          </div>
        </dl>
      </div>

      {/* Order items */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-text-primary">Items</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-text-muted">Reference</th>
                <th className="px-4 py-3 text-left font-medium text-text-muted">Child</th>
                <th className="px-4 py-3 text-left font-medium text-text-muted">Class</th>
                <th className="px-4 py-3 text-left font-medium text-text-muted">Activity</th>
                <th className="px-4 py-3 text-left font-medium text-text-muted">Verification</th>
                <th className="px-4 py-3 text-right font-medium text-text-muted">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">
                    {item.item_reference}
                  </td>
                  <td className="px-4 py-3 font-medium text-text-primary">
                    {item.student_name_snapshot}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{item.class_name_snapshot}</td>
                  <td className="px-4 py-3 text-text-secondary">{item.activity_name_snapshot}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={item.verification_status} />
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-text-primary">
                    {formatCurrency(item.unit_amount_cents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Payments */}
      {payments.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-semibold text-text-primary">Payments</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">Reference</th>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">Date paid</th>
                  <th className="px-4 py-3 text-right font-medium text-text-muted">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-mono text-xs text-text-muted">
                      {p.payment_reference}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {p.paid_at ? formatDate(p.paid_at, true) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-text-primary">
                      {formatCurrency(p.amount_cents)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
              {payments.length > 1 && (
                <tfoot>
                  <tr className="bg-surface">
                    <td colSpan={2} className="px-4 py-2 text-xs text-text-muted">
                      {payments.length} instalments · {formatCurrency(order.amount_paid_cents)} paid
                      of {formatCurrency(order.total_cents)}
                      {order.amount_paid_cents < order.total_cents && (
                        <span className="ml-2 font-medium text-text-secondary">
                          ({formatCurrency(order.total_cents - order.amount_paid_cents)} remaining)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-text-primary">
                      {formatCurrency(order.amount_paid_cents)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      )}

      {/* Refunds */}
      {payments.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-semibold text-text-primary">Refunds</h2>

          {refunds.length > 0 && (
            <div className="mb-4 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-text-muted">Reference</th>
                    <th className="px-4 py-3 text-left font-medium text-text-muted">Date</th>
                    <th className="px-4 py-3 text-right font-medium text-text-muted">Amount</th>
                    <th className="px-4 py-3 text-left font-medium text-text-muted">Reason</th>
                    <th className="px-4 py-3 text-left font-medium text-text-muted">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {refunds.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-mono text-xs text-text-muted">
                        {r.refund_reference}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{formatDate(r.created_at)}</td>
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

          {isRefundable &&
            payments
              .filter((p) => p.status === 'paid')
              .map((p) => {
                const refunded = refundedByPaymentId.get(p.id) ?? 0
                const refundable = p.amount_cents - refunded
                if (refundable <= 0) return null
                return (
                  <div key={p.id} className="mb-4">
                    {payments.filter((pp) => pp.status === 'paid').length > 1 && (
                      <p className="mb-2 font-mono text-xs text-text-muted">
                        {p.payment_reference}
                      </p>
                    )}
                    <RefundForm
                      orderId={order.id}
                      paymentId={p.id}
                      paymentAmountCents={p.amount_cents}
                      alreadyRefundedCents={refunded}
                    />
                  </div>
                )
              })}

          {!isRefundable && refunds.length === 0 && (
            <p className="text-sm text-text-muted">No refunds for this order.</p>
          )}
        </section>
      )}

      {/* Email notifications */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">Emails</h2>
        </div>

        {isPaid && (
          <div className="mb-4 flex flex-wrap gap-3">
            <ResendEmailButton
              orderId={order.id}
              type="payer_receipt"
              label="Resend payer receipt"
            />
            <ResendEmailButton
              orderId={order.id}
              type="school_notification"
              label="Resend school notification"
            />
          </div>
        )}

        {emails.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface py-8 text-center">
            <p className="text-sm text-text-muted">No emails sent for this order.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">Recipient</th>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">Sent at</th>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {emails.map((email) => (
                  <tr key={email.id}>
                    <td className="px-4 py-3 text-text-primary">
                      {EMAIL_TYPE_LABEL[email.type] ?? email.type}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{email.recipient_email}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={email.status} />
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {email.sent_at ? formatDate(email.sent_at, true) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-error">{email.failure_details ?? ''}</td>
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
