'use client'

import { useState, useTransition } from 'react'
import { sendArrearsReminderAction } from '@/lib/fees/arrears-send'

/**
 * Admin action: email a child's linked parent(s) an outstanding-balance reminder
 * with a link to pay in their portal. Confirms before sending.
 */
export function SendArrearsReminderButton({
  studentId,
  childName,
  amountLabel,
}: {
  studentId: string
  childName: string
  amountLabel: string
}) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<'sent' | string | null>(null)

  function onClick() {
    if (result === 'sent') return
    if (
      !window.confirm(`Email ${childName}'s parent(s) a reminder for ${amountLabel} outstanding?`)
    )
      return
    startTransition(async () => {
      const res = await sendArrearsReminderAction(studentId)
      setResult(res.ok ? 'sent' : res.error)
    })
  }

  if (result === 'sent') return <span className="text-sm font-medium text-success">✓ Sent</span>

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-md border border-primary px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-white disabled:opacity-50"
      >
        {pending ? 'Sending…' : 'Send reminder'}
      </button>
      {result && result !== 'sent' && <span className="text-xs text-error">{result}</span>}
    </span>
  )
}
