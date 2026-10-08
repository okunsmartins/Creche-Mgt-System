'use client'

import { useState, useTransition } from 'react'
import { sendInvoiceToParentAction } from '@/lib/fees/send-invoice'

interface SendInvoiceButtonProps {
  invoiceId: string
}

/**
 * Admin action: email the linked parent(s) a link to view/pay this invoice.
 * Confirms before sending (outward-facing action), then shows Sent/Failed inline.
 */
export function SendInvoiceButton({ invoiceId }: SendInvoiceButtonProps) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<'sent' | string | null>(null)

  function onClick() {
    if (result === 'sent') return
    if (!window.confirm('Email the parent a link to view and pay this invoice?')) return
    startTransition(async () => {
      const res = await sendInvoiceToParentAction(invoiceId)
      setResult(res.ok ? 'sent' : res.error)
    })
  }

  if (result === 'sent') {
    return <span className="text-sm font-medium text-success">✓ Sent</span>
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-md border border-primary px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-white disabled:opacity-50"
      >
        {pending ? 'Sending…' : 'Send to parent'}
      </button>
      {result && result !== 'sent' && <span className="text-xs text-error">{result}</span>}
    </span>
  )
}
