import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle } from 'lucide-react'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import { CheckoutButton } from '@/components/stripe/CheckoutButton'
import { createGuestCheckoutSessionAction } from '@/lib/stripe/actions'
import { createGuestRevolutOrderAction } from '@/lib/revolut/actions'
import { isRevolutConfigured } from '@/lib/revolut/client'
import { schoolHasOwnRevolut } from '@/lib/revolut/perSchool'
import type { OrderRow, OrderItemRow } from '@/types/database'

export const metadata: Metadata = { title: 'Order Confirmed' }

type OrderDetail = Pick<
  OrderRow,
  | 'id'
  | 'school_id'
  | 'order_reference'
  | 'guest_payer_name'
  | 'guest_payer_email'
  | 'total_cents'
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

export default async function GuestConfirmationPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  const adminClient = createSupabaseAdminClient()

  const { data: orderData } = await adminClient
    .from('orders')
    .select(
      'id, school_id, order_reference, guest_payer_name, guest_payer_email, total_cents, status, source, created_at, order_items(id, student_name_snapshot, class_name_snapshot, activity_name_snapshot, programme_name_snapshot, unit_amount_cents, item_reference, verification_status)',
    )
    .eq('id', orderId)
    .is('payer_profile_id', null) // Guest orders only — registered parent orders use /parent/payments/:id
    .single()

  if (!orderData) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <h1 className="mb-4 text-2xl font-bold text-text-primary">Order not found</h1>
        <p className="mb-6 text-text-secondary">
          This order could not be found. If you believe this is an error, please contact the school.
        </p>
        <Link href="/activities" className="text-primary hover:underline">
          View activities
        </Link>
      </div>
    )
  }

  type OrderWithItems = OrderDetail & {
    order_items: OrderItemDetail[]
  }

  const order = orderData as OrderWithItems

  const isManual = order.source === 'guest_manual'

  // Revolut is offered when the platform key is set OR this order's school has
  // connected its own Revolut account (per-school Connect model).
  const revolutEnabled =
    isRevolutConfigured() || (order.school_id ? await schoolHasOwnRevolut(order.school_id) : false)

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex items-start gap-4">
        <CheckCircle className="mt-0.5 h-8 w-8 shrink-0 text-success" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Order received</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Thank you, {order.guest_payer_name}. Your order has been recorded.
          </p>
        </div>
      </div>

      <div className="card divide-y divide-border overflow-hidden p-0">
        {/* Order summary */}
        <div className="p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
            Order summary
          </h2>
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
              <dt className="text-text-secondary">Email</dt>
              <dd className="text-text-primary">{order.guest_payer_email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-secondary">Total</dt>
              <dd className="font-bold text-text-primary">{formatCurrency(order.total_cents)}</dd>
            </div>
          </dl>
        </div>

        {/* Order items */}
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

        {/* Status / next steps */}
        <div className="bg-surface p-5">
          {isManual ? (
            <div className="space-y-1 text-sm">
              <p className="font-medium text-amber-700">Manual reconciliation required</p>
              <p className="text-text-secondary">
                Your payment has been recorded but requires manual review by the school. Please
                bring a copy of this reference to the school office.
              </p>
            </div>
          ) : order.status === 'paid' ? (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
              <p className="font-medium text-success">Payment confirmed</p>
            </div>
          ) : ['draft', 'pending_payment', 'payment_failed'].includes(order.status) ? (
            <div className="space-y-3">
              {order.status === 'payment_failed' && (
                <p className="text-sm font-medium text-error">
                  The previous payment attempt failed. Please try again.
                </p>
              )}
              <CheckoutButton
                orderId={order.id}
                action={createGuestCheckoutSessionAction}
                revolutAction={createGuestRevolutOrderAction}
                revolutEnabled={revolutEnabled}
              />
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              <p className="font-medium text-text-primary">
                {order.status === 'expired' ? 'Order expired' : 'Order status updated'}
              </p>
              <p className="text-text-secondary">
                Please contact the school if you have any questions about this order.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 text-center">
        <Link href="/activities" className="text-sm text-primary hover:underline">
          Return to activities
        </Link>
      </div>
    </div>
  )
}
