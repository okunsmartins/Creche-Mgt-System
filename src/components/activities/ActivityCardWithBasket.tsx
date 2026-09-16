'use client'

import Link from 'next/link'
import { ShoppingCart, Check, Clock } from 'lucide-react'
import { useParentBasket } from '@/lib/basket/useParentBasket'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'

export interface ActivityStudent {
  id: string
  firstName: string
  lastName: string
  className: string
}

export interface ActivityCardProps {
  activityId: string
  activityName: string
  description: string | null
  amountCents: number
  classNames: string[]
  closesAt: string | null
  eligibleStudents: ActivityStudent[]
}

export function ActivityCardWithBasket({
  activityId,
  activityName,
  description,
  amountCents,
  classNames,
  closesAt,
  eligibleStudents,
}: ActivityCardProps) {
  const { items, loaded, addItem, removeItem, isActivityInBasket } = useParentBasket()
  const basketCount = items.length

  const isDeadlineSoon =
    closesAt !== null && new Date(closesAt).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      {/* Header row */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-base font-semibold text-text-primary">{activityName}</h2>
        <span className="shrink-0 text-lg font-bold text-primary">
          {formatCurrency(amountCents)}
          <span className="ml-1 text-xs font-normal text-text-muted">per child</span>
        </span>
      </div>

      {description && <p className="mb-3 text-sm text-text-secondary">{description}</p>}

      {/* Class eligibility tags */}
      {classNames.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {classNames.map((name) => (
            <span
              key={name}
              className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20"
            >
              {name}
            </span>
          ))}
        </div>
      )}

      {/* Deadline */}
      {closesAt && (
        <p
          className={`mb-4 flex items-center gap-1.5 text-xs ${
            isDeadlineSoon ? 'font-medium text-warning' : 'text-text-muted'
          }`}
        >
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          Deadline:{' '}
          {new Date(closesAt).toLocaleDateString('en-IE', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
          {isDeadlineSoon && ' — closing soon'}
        </p>
      )}

      {/* Per-child basket buttons */}
      <div className="space-y-2">
        {eligibleStudents.map((student) => {
          const inBasket = loaded && isActivityInBasket(student.id, activityId)
          const itemKey = `activity:${student.id}:${activityId}`

          return (
            <div
              key={student.id}
              className="flex items-center justify-between rounded-lg border border-border bg-background/50 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {student.firstName} {student.lastName}
                </p>
                <p className="text-xs text-text-muted">{student.className}</p>
              </div>

              {!loaded ? (
                <span className="h-8 w-28 animate-pulse rounded-md bg-surface" />
              ) : inBasket ? (
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-success">
                    <Check className="h-4 w-4" aria-hidden="true" />
                    In basket
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(itemKey)}
                    className="text-xs text-text-muted underline hover:text-error"
                    aria-label={`Remove ${activityName} for ${student.firstName} from basket`}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
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

      {/* Basket CTA — only shown once something is in the basket */}
      {loaded && basketCount > 0 && (
        <Link
          href="/parent/basket"
          className="mt-4 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-medium text-primary hover:bg-primary/10"
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
