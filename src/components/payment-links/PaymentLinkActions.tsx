'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updatePaymentLinkAction } from '@/lib/payment-links/actions'

interface PaymentLinkActionsProps {
  linkId: string
  currentStatus: boolean
  label: string
}

export function PaymentLinkActions({ linkId, currentStatus, label }: PaymentLinkActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    startTransition(async () => {
      const formData = new FormData()
      formData.set('label', label)
      formData.set('isActive', currentStatus ? 'false' : 'true')
      await updatePaymentLinkAction(linkId, null, formData)
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isPending}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
        currentStatus
          ? 'bg-green-100 text-green-800 hover:bg-green-200'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      } disabled:opacity-50`}
      aria-label={`${currentStatus ? 'Deactivate' : 'Activate'} payment link: ${label}`}
    >
      {isPending ? '…' : currentStatus ? 'Active' : 'Inactive'}
    </button>
  )
}
