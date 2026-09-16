'use client'

import Link from 'next/link'
import { ShoppingCart, Check, Repeat } from 'lucide-react'
import { useParentBasket } from '@/lib/basket/useParentBasket'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'
import type { PricingModel } from '@/types/database'

const PRICING_LABEL: Record<PricingModel, string> = {
  per_term: 'per term',
  per_month: 'per month',
  per_session: 'per session',
}

const DAY_LABEL: Record<string, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
}

export interface ProgrammeStudent {
  id: string
  firstName: string
  lastName: string
  className: string
}

export interface ProgrammeCardProps {
  programmeId: string
  programmeName: string
  description: string | null
  priceCents: number
  pricingModel: PricingModel
  daysOfWeek: string[]
  sessionTime: string | null
  termStart: string | null
  termEnd: string | null
  classNames: string[]
  eligibleStudents: ProgrammeStudent[]
}

export function ProgrammeCardWithBasket({
  programmeId,
  programmeName,
  description,
  priceCents,
  pricingModel,
  daysOfWeek,
  sessionTime,
  termStart,
  termEnd,
  classNames,
  eligibleStudents,
}: ProgrammeCardProps) {
  const { items, loaded, addItem, removeItem, isProgrammeInBasket } = useParentBasket()
  const basketCount = items.length

  const dayLabels = daysOfWeek.map((d) => DAY_LABEL[d] ?? d).join(', ')

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      {/* Header row */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Repeat className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
          <h2 className="text-base font-semibold text-text-primary">{programmeName}</h2>
        </div>
        <div className="shrink-0 text-right">
          <span className="text-lg font-bold text-primary">{formatCurrency(priceCents)}</span>
          <span className="ml-1 text-xs font-normal text-text-muted">
            {PRICING_LABEL[pricingModel]}
          </span>
        </div>
      </div>

      {description && <p className="mb-3 text-sm text-text-secondary">{description}</p>}

      {/* Session days + time */}
      {dayLabels && (
        <p className="mb-2 text-sm text-text-secondary">
          <span className="font-medium text-text-primary">Days:</span> {dayLabels}
          {sessionTime && (
            <span className="ml-2 text-text-muted">at {sessionTime.slice(0, 5)}</span>
          )}
        </p>
      )}

      {/* Term dates */}
      {(termStart ?? termEnd) && (
        <p className="mb-2 text-sm text-text-muted">
          {termStart && termEnd
            ? `${formatDate(termStart)} – ${formatDate(termEnd)}`
            : termStart
              ? `From ${formatDate(termStart)}`
              : `Until ${formatDate(termEnd!)}`}
        </p>
      )}

      {/* Class eligibility tags */}
      {classNames.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
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

      {/* Per-child basket buttons */}
      <div className="space-y-2">
        {eligibleStudents.map((student) => {
          const inBasket = loaded && isProgrammeInBasket(student.id, programmeId)
          const itemKey = `programme:${student.id}:${programmeId}`

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
                    aria-label={`Remove ${programmeName} for ${student.firstName} from basket`}
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
                      kind: 'programme',
                      studentId: student.id,
                      studentName: `${student.firstName} ${student.lastName}`,
                      className: student.className,
                      programmeId,
                      programmeName,
                      pricingModel,
                      amountCents: priceCents,
                    })
                  }
                >
                  Enrol
                </Button>
              )}
            </div>
          )
        })}
      </div>

      {/* Basket CTA */}
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
