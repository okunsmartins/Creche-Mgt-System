'use client'

import { useState, useTransition } from 'react'
import { sendInvoiceToParentAction } from '@/lib/fees/send-invoice'

interface SendInvoiceButtonProps {
  invoiceId: string
  childName: string
  /** Pre-formatted outstanding amount, e.g. "€200.00". */
  amountLabel: string
  /** Linked parent email(s) this will send to (empty if none on record). */
  recipientEmails: string[]
}

/**
 * Admin action: email the linked parent(s) a link to view/pay this invoice.
 * Confirms before sending (outward-facing action) — showing exactly who it goes
 * to and for how much — then shows Sent/Failed inline.
 */
export function SendInvoiceButton({
  invoiceId,
  childName,
  amountLabel,
  recipientEmails,
}: SendInvoiceButtonProps) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<'sent' | string | null>(null)

  function onClick() {
    if (result === 'sent') return

    // Show the real recipient(s), child and amount before sending. When no parent
    // email is on record, say so and skip — the send would only fail anyway.
    if (recipientEmails.length === 0) {
      window.alert(
        `No parent email is on record for ${childName}. Link a parent with an email address first, then try again.`,
      )
      return
    }
    const who = recipientEmails.join(', ')
    if (!window.confirm(`Email ${who} about ${childName}'s ${amountLabel} invoice?`)) return

    startTransition(async () => {
      const res = await sendInvoiceToParentAction(invoiceId)
      setResult(res.ok ? 'sent' : res.error)
    })
  }

  if (result === 'sent') {
    return <span className="text-sm font-medium text-success">✓ Sent</span>
  }

  const hasRecipients = recipientEmails.length > 0

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        title={
          hasRecipients ? `Sends to ${recipientEmails.join(', ')}` : 'No parent email on record'
        }
        className="rounded-md border border-primary px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-white disabled:opacity-50"
      >
        {pending ? 'Sending…' : 'Send to parent'}
      </button>
      {!hasRecipients && !result && (
        <span className="text-xs text-text-muted">No parent email</span>
      )}
      {result && result !== 'sent' && <span className="text-xs text-error">{result}</span>}
    </span>
  )
}
