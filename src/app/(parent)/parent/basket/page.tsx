import type { Metadata } from 'next'
import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'
import { requireVerifiedAuth } from '@/lib/auth/guards'
import { ParentBasketView } from '@/components/basket/ParentBasketView'

export const metadata: Metadata = { title: 'Basket' }

export default async function ParentBasketPage() {
  await requireVerifiedAuth()

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <Link href="/parent/activities" className="text-sm text-text-muted hover:underline">
          ← Keep shopping
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-text-primary">
          <ShoppingCart className="h-6 w-6" aria-hidden="true" />
          Your basket
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Review your selections, then confirm to create your order.
        </p>
      </div>

      <ParentBasketView />
    </div>
  )
}
