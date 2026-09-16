import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle } from 'lucide-react'
import { requireVerifiedAuth } from '@/lib/auth/guards'
import { schoolHasProAccess } from '@/lib/subscriptions/access'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { isRevolutConfigured } from '@/lib/revolut/client'
import { schoolHasOwnRevolut } from '@/lib/revolut/perSchool'
import { formatCurrency, formatDate } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/Badge'
import { PayNowForm } from '@/components/stripe/PayNowForm'
import type { OrderRow, OrderItemRow } from '@/types/database'

export const metadata: Metadata = { title: 'Order Details' }

type OrderDetail = Pick<
  OrderRow,
  | 'id'
  | 'order_reference'
  | 'total_cents'
  | 'amount_paid_cents'
  | 'status'
  | 'source'
  | 'created_at'
>

type OrderItemDetail = Pick<
  OrderItemRow,
  | 'id'
  | 'student_name_snapshot'
  | 'class_name_snapshot'
  | 'activity_name_snapshot'
  | 'programme_name_snapshot'
  | 'unit_amount_cents'
  | 'item_reference'
  | 'verification_status'
>

export default async function ParentOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const user = await requireVerifiedAuth()
  const { orderId } = await params
  // Instalments are a Pro feature of the parent's school.
  const instalmentsEnabled = user.schoolId ? await schoolHasProAccess(user.schoolId) : false
  // Revolut is offered when the platform key is set OR this parent's school has
  // connected its own Revolut account (per-school Connect model).
  const revolutEnabled =
    isRevolutConfigured() || (user.schoolId ? await schoolHasOwnRevolut(user.schoolId) : false)

  // Use admin client: auth.uid() is null in Server Component contexts; the RLS
  // policies parents_read_own_orders and parents_read_own_order_items both use
  // auth.uid() and return 0 rows. Ownership is enforced by .eq('payer_profile_id', user.id).
  const adminClient = createSupabaseAdminClient()

  const { data: orderData } = await adminClient
    .from('orders')
    .select(
      'id, order_reference, total_cents, amount_paid_cents, status, source, created_at, order_items(id, student_name_snapshot, class_name_snapshot, activity_name_snapshot, programme_name_snapshot, unit_amount_cents, item_reference, verification_status)',
    )
    .eq('id', orderId)
    .eq('payer_profile_id', user.id)
    .single()

  if (!orderData) {
    return (
      <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
        <h1 className="mb-4 text-2xl font-bold text-text-primary">Order not found</h1>
        <Link href="/parent/payments" className="text-primary hover:underline">
          Back to payment history
        </Link>
      </div>
    )
  }

  type OrderWithItems = OrderDetail & { order_items: OrderItemDetail[] }
  const order = orderData as OrderWithItems

  const isNewOrder = order.status === 'draft'
  const isPayable = ['draft', 'pending_payment', 'payment_failed', 'partially_paid'].includes(
    order.status,
  )
  const remainingCents = order.total_cents - order.amount_paid_cents

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <Link href="/parent/payments" className="text-sm text-text-muted hover:underline">
          ← Back to payment history
        </Link>
      </div>

      {isNewOrder && (
        <div className="mb-6 flex items-start gap-3">
          <CheckCircle className="mt-0.5 h-6 w-6 shrink-0 text-success" aria-hidden="true" />
          <div>
            <p className="font-semibold text-text-primary">Order received</p>
            <p className="text-sm text-text-secondary">
              Your order has been recorded. Payment processing will be available shortly.
            </p>
          </div>
        </div>
      )}

      <div className="card divide-y divide-border overflow-hidden p-0">
        <div className="p-5">
          <h1 className="mb-3 text-lg font-bold text-text-primary">Order details</h1>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-secondary">Reference</dt>
              <dd className="font-mono font-medium text-text-primary">{order.order_reference}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-secondary">Date</dt>
              <dd className="text-text-primary">{formatDate(order.created_at, true)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-secondary">Total</dt>
              <dd className="font-bold text-text-primary">{formatCurrency(order.total_cents)}</dd>
            </div>
            {order.amount_paid_cents > 0 && (
              <>
                <div className="flex justify-between">
                  <dt className="text-text-secondary">Paid so far</dt>
                  <dd className="font-medium text-success">
                    {formatCurrency(order.amount_paid_cents)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-secondary">Balance due</dt>
                  <dd className="font-bold text-text-primary">{formatCurrency(remainingCents)}</dd>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <dt className="text-text-secondary">Status</dt>
              <dd>
                <StatusBadge status={order.status} />
              </dd>
            </div>
          </dl>
        </div>

        <div className="p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
            Items
          </h2>
          <ul className="space-y-3">
            {order.order_items.map((item) => (
              <li key={item.id} className="text-sm">
                <div className="flex justify-between">
                  <span className="font-medium text-text-primary">
                    {item.activity_name_snapshot ?? item.programme_name_snapshot ?? '—'}
                  </span>
                  <span className="text-text-primary">
                    {formatCurrency(item.unit_amount_cents)}
                  </span>
                </div>
                <p className="text-text-secondary">
                  {item.student_name_snapshot} — {item.class_name_snapshot}
                </p>
                <p className="text-xs text-text-muted">Ref: {item.item_reference}</p>
              </li>
            ))}
          </ul>
        </div>

        {order.status === 'paid' && (
          <div className="flex items-center gap-2 bg-surface p-5">
            <CheckCircle className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            <p className="text-sm font-medium text-success">Payment confirmed</p>
          </div>
        )}

        {isPayable && (
          <div className="space-y-3 bg-surface p-5">
            {order.status === 'payment_failed' && (
              <p className="text-sm font-medium text-error">
                The previous payment attempt failed. Please try again.
              </p>
            )}
            {order.status === 'partially_paid' && (
              <p className="text-sm text-text-secondary">
                You have paid {formatCurrency(order.amount_paid_cents)} so far. Pay the remaining
                balance {instalmentsEnabled ? 'in full or by instalment below' : 'below'}.
              </p>
            )}
            <PayNowForm
              orderId={order.id}
              totalCents={order.total_cents}
              amountPaidCents={order.amount_paid_cents}
              instalmentsEnabled={instalmentsEnabled}
              revolutEnabled={revolutEnabled}
            />
          </div>
        )}

        {(order.status === 'expired' || order.status === 'cancelled') && (
          <div className="bg-surface p-5">
            <p className="text-sm text-text-secondary">
              This order is no longer payable. Please contact the school if you need assistance.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
