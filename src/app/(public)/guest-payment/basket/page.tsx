import type { Metadata } from 'next'
import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'
import { GuestBasketView } from '@/components/basket/GuestBasketView'

export const metadata: Metadata = { title: 'Guest Basket' }

export default function GuestBasketPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <div className="mb-8">
        <Link href="/activities" className="text-sm text-text-muted hover:underline">
          ← Back to activities
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-text-primary">
          <ShoppingCart className="h-6 w-6" aria-hidden="true" />
          Your basket
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Review your selection and enter your details to confirm.
        </p>
      </div>

      <div className="card p-6">
        <GuestBasketView />
      </div>
    </div>
  )
}
