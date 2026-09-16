'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { formatCurrency } from '@/lib/utils'
import { initiateRefundAction, type RefundActionState } from '@/lib/refunds/actions'

interface RefundFormProps {
  orderId: string
  paymentId: string
  paymentAmountCents: number
  alreadyRefundedCents: number
}

export function RefundForm({
  orderId,
  paymentId,
  paymentAmountCents,
  alreadyRefundedCents,
}: RefundFormProps) {
  const refundable = paymentAmountCents - alreadyRefundedCents
  const [state, formAction, isPending] = useActionState<RefundActionState, FormData>(
    initiateRefundAction,
    null,
  )
  const [isFullRefund, setIsFullRefund] = useState(false)

  const fullAmountEuros = (refundable / 100).toFixed(2)

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">Initiate refund</h3>
      <p className="mb-4 text-xs text-text-muted">
        Refundable balance:{' '}
        <span className="font-semibold text-text-primary">{formatCurrency(refundable)}</span>
      </p>

      {state?.error && (
        <Alert variant="error" className="mb-3">
          {state.error}
        </Alert>
      )}
      {state?.success && (
        <Alert variant="success" className="mb-3">
          Refund of {formatCurrency(state.refundedAmountCents ?? 0)} initiated successfully.
        </Alert>
      )}

      {!state?.success && (
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="paymentId" value={paymentId} />

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="fullRefund"
              checked={isFullRefund}
              onChange={(e) => setIsFullRefund(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary"
            />
            <label htmlFor="fullRefund" className="text-sm text-text-secondary">
              Full refund ({formatCurrency(refundable)})
            </label>
          </div>

          {!isFullRefund && (
            <div>
              <label
                htmlFor="amountEuros"
                className="mb-1 block text-xs font-medium text-text-secondary"
              >
                Amount (EUR)
              </label>
              <Input
                id="amountEuros"
                name="amountEuros"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                max={fullAmountEuros}
                className="max-w-[160px]"
              />
            </div>
          )}

          {isFullRefund && <input type="hidden" name="amountEuros" value={fullAmountEuros} />}

          <div>
            <label htmlFor="reason" className="mb-1 block text-xs font-medium text-text-secondary">
              Reason
            </label>
            <Textarea
              id="reason"
              name="reason"
              rows={2}
              placeholder="Reason for refund..."
              maxLength={500}
            />
          </div>

          <Button type="submit" variant="outline" size="sm" loading={isPending}>
            Initiate refund
          </Button>
        </form>
      )}
    </div>
  )
}
