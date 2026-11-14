'use client'

import { useActionState, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { refundFeePaymentAction, type FeeRefundState } from '@/lib/fees/refund-actions'

export interface FeePaymentView {
  id: string
  reference: string
  /** e.g. "Invoice INV-2026-000028" or "Late collection fee". */
  label: string
  provider: 'stripe' | 'revolut'
  amountCents: number
  refundedCents: number
  status: string
  paidAt: string | null
}

const STATUS_LABEL: Record<string, string> = {
  paid: 'Paid',
  partially_refunded: 'Part refunded',
  refunded: 'Refunded',
}

/** Online payments for this child's invoices / late fees, with a refund action each. */
export function FeePaymentsPanel({ payments }: { payments: FeePaymentView[] }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-base font-semibold text-text-primary">Online payments</h2>
      <p className="mt-1 text-xs text-text-muted">
        Card / Revolut payments made by the parent. A refund goes back to the card or account they
        paid with, the invoice or late fee is updated, and the parent is emailed.
      </p>
      {payments.length === 0 ? (
        <p className="mt-4 text-sm text-text-muted">No online payments yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {payments.map((p) => (
            <PaymentRow key={p.id} p={p} />
          ))}
        </ul>
      )}
    </section>
  )
}

function PaymentRow({ p }: { p: FeePaymentView }) {
  const refundable = Math.max(0, p.amountCents - p.refundedCents)
  const canRefund = refundable > 0 && (p.status === 'paid' || p.status === 'partially_refunded')
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState<FeeRefundState, FormData>(
    refundFeePaymentAction,
    null,
  )
  const done = state && 'success' in state

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 text-sm">
          <p className="font-medium text-text-primary">
            {p.label} · {formatCurrency(p.amountCents)}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            {p.reference} · {p.provider === 'revolut' ? 'Revolut' : 'Card (Stripe)'}
            {p.paidAt ? ` · ${p.paidAt.slice(0, 10)}` : ''}
            {p.refundedCents > 0 ? ` · ${formatCurrency(p.refundedCents)} refunded` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-surface-raised px-2.5 py-0.5 text-xs font-medium text-text-secondary">
            {STATUS_LABEL[p.status] ?? p.status}
          </span>
          {canRefund && !open && !done && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-error ring-1 ring-error/30 transition-colors hover:bg-error/10"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Refund
            </button>
          )}
        </div>
      </div>

      {open && !done && (
        <form
          action={formAction}
          onSubmit={(e) => {
            const amt = new FormData(e.currentTarget).get('amount')
            if (!window.confirm(`Refund €${amt} to the parent? This can't be undone.`))
              e.preventDefault()
          }}
          className="mt-3 grid gap-3 rounded-lg border border-border bg-surface-raised/40 p-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end"
        >
          <input type="hidden" name="paymentId" value={p.id} />
          <label className="text-xs text-text-muted">
            Amount (€)
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              max={(refundable / 100).toFixed(2)}
              defaultValue={(refundable / 100).toFixed(2)}
              required
              className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary"
            />
          </label>
          <label className="text-xs text-text-muted">
            Reason (optional, internal)
            <input
              name="reason"
              maxLength={300}
              placeholder="e.g. Charged in error"
              className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={isPending}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-error px-3 py-1.5 text-xs font-semibold text-white hover:bg-error/90 disabled:opacity-50"
            >
              {isPending ? 'Refunding…' : 'Confirm refund'}
            </button>
          </div>
        </form>
      )}
      {state && 'error' in state && <p className="mt-2 text-xs text-error">{state.error}</p>}
      {done && <p className="mt-2 text-xs text-success">{state.message}</p>}
    </li>
  )
}
