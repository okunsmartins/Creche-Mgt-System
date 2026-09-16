import type { Metadata } from 'next'
import Link from 'next/link'
import { XCircle } from 'lucide-react'

export const metadata: Metadata = { title: 'Payment Cancelled' }

export default async function PaymentCancelledPage({
  searchParams,
}: {
  searchParams: Promise<{ order_id?: string; type?: string }>
}) {
  const { order_id: orderId, type } = await searchParams

  const returnHref =
    orderId && type === 'parent'
      ? `/parent/payments/${orderId}`
      : orderId && type === 'guest'
        ? `/guest-payment/confirmation/${orderId}`
        : '/activities'

  const returnLabel =
    type === 'parent' || type === 'guest' ? 'Return to your order' : 'View activities'

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6">
      <XCircle className="mx-auto h-12 w-12 text-text-muted" aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-bold text-text-primary">Payment cancelled</h1>
      <p className="mt-3 text-text-secondary">
        No payment was taken. Your order is still saved and you can pay at any time.
      </p>
      <Link
        href={returnHref}
        className="mt-8 inline-block rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {returnLabel}
      </Link>
    </div>
  )
}
