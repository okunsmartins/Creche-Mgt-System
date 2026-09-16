'use client'

import Link from 'next/link'
import { ShoppingCart, Check } from 'lucide-react'
import { useParentBasket } from '@/lib/basket/useParentBasket'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'

interface EligibleStudent {
  id: string
  firstName: string
  lastName: string
  className: string
}

interface ParentPaymentFormProps {
  activityId: string
  activityName: string
  amountCents: number
  eligibleStudents: EligibleStudent[]
}

export function ParentPaymentForm({
  activityId,
  activityName,
  amountCents,
  eligibleStudents,
}: ParentPaymentFormProps) {
  const { items, loaded, addItem, isActivityInBasket } = useParentBasket()

  if (eligibleStudents.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-text-muted">
        None of your linked children are in an eligible class for this activity.
      </div>
    )
  }

  const basketCount = items.length

  return (
    <div className="space-y-6">
      {/* Activity summary */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="text-xs uppercase tracking-wide text-text-muted">Paying for</p>
        <p className="mt-0.5 font-semibold text-text-primary">{activityName}</p>
        <p className="text-xl font-bold text-primary">{formatCurrency(amountCents)}</p>
      </div>

      {/* Per-child add-to-basket buttons */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-text-primary">Select a child:</p>

        {eligibleStudents.map((student) => {
          const inBasket = loaded && isActivityInBasket(student.id, activityId)
          return (
            <div
              key={student.id}
              className="flex items-center justify-between rounded-lg border border-border p-4"
            >
              <div>
                <p className="font-medium text-text-primary">
                  {student.firstName} {student.lastName}
                </p>
                <p className="text-sm text-text-muted">{student.className}</p>
              </div>

              {inBasket ? (
                <span className="flex items-center gap-1.5 text-sm font-medium text-success">
                  <Check className="h-4 w-4" aria-hidden="true" />
                  In basket
                </span>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    addItem({
                      kind: 'activity',
                      studentId: student.id,
                      studentName: `${student.firstName} ${student.lastName}`,
                      className: student.className,
                      activityId,
                      activityName,
                      amountCents,
                    })
                  }
                >
                  Add to basket
                </Button>
              )}
            </div>
          )
        })}
      </div>

      {/* Basket CTA — visible once at least one item is in the basket */}
      {loaded && basketCount > 0 && (
        <Link
          href="/parent/basket"
          className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-medium text-primary hover:bg-primary/10"
        >
          <span className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" aria-hidden="true" />
            View basket
          </span>
          <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-white">
            {basketCount} {basketCount === 1 ? 'item' : 'items'}
          </span>
        </Link>
      )}
    </div>
  )
}
