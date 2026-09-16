import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle } from 'lucide-react'

export const metadata: Metadata = { title: 'Payment Submitted' }

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order_id?: string; type?: string; session_id?: string }>
}) {
  const { order_id: orderId, type } = await searchParams

  const returnHref =
    orderId && type === 'parent'
      ? `/parent/payments/${orderId}`
      : orderId && type === 'guest'
        ? `/guest-payment/confirmation/${orderId}`
        : '/activities'

  const returnLabel = type === 'parent' || type === 'guest' ? 'View your order' : 'View activities'

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center sm:px-6">
      <CheckCircle className="mx-auto h-12 w-12 text-success" aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-bold text-text-primary">Payment submitted</h1>
      <p className="mt-3 text-text-secondary">
        Your payment details have been sent to Stripe for processing. You will receive a
        confirmation email once the payment is confirmed.
      </p>
      <p className="mt-2 text-sm text-text-muted">
        It may take a moment for your order status to update.
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
