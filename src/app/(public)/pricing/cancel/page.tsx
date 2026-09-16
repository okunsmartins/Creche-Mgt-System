import type { Metadata } from 'next'
import Link from 'next/link'
import { Info } from 'lucide-react'

export const metadata: Metadata = { title: 'Checkout cancelled' }

export default function SubscriptionCancelPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
      <Info className="mx-auto h-12 w-12 text-text-muted" aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-bold text-text-primary">Checkout cancelled</h1>
      <p className="mt-3 text-sm text-text-secondary">
        No charge was made — your school is still on the free plan. You can subscribe any time.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/pricing"
          className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:bg-primary-hover hover:shadow-none"
        >
          Back to pricing
        </Link>
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center justify-center rounded-xl border border-border bg-surface px-6 py-2.5 text-sm font-semibold text-text-primary transition-all hover:border-primary/40 hover:bg-surface-raised"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  )
}
