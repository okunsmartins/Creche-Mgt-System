'use client'

import { useActionState, useState, useRef } from 'react'
import Link from 'next/link'
import { ShoppingCart, Check } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { cn, formatCurrency } from '@/lib/utils'
import { lookupPupilAction } from '@/lib/orders/actions'
import { useGuestBasket } from '@/lib/basket/useGuestBasket'
import type { GuestIdentification } from '@/lib/basket/types'
import type { LookupPupilState } from '@/lib/orders/schemas'

interface GuestPaymentFormProps {
  activityId: string
  activityName: string
  amountCents: number
  classes: { id: string; name: string }[]
  paymentLinkId?: string
}

export function GuestPaymentForm({
  activityId,
  activityName,
  amountCents,
  classes,
  paymentLinkId,
}: GuestPaymentFormProps) {
  const [lookupState, lookupAction, isLookupPending] = useActionState<LookupPupilState, FormData>(
    lookupPupilAction,
    null,
  )

  const { basket, loaded, setIdentification, addActivity, clearBasket, isActivityInBasket } =
    useGuestBasket()

  const [mode, setMode] = useState<'code' | 'manual'>('code')
  const [pupilCode, setPupilCode] = useState('')
  const manualFormRef = useRef<HTMLFormElement>(null)

  const classOptions = classes.map((c) => ({ value: c.id, label: c.name }))
  const activityCount = basket?.activities.length ?? 0
  const alreadyInBasket = loaded && isActivityInBasket(activityId)

  // If the basket already has a child identification, skip the identification step.
  const hasIdentification = loaded && basket !== null

  function handleAddToBasket() {
    addActivity({ activityId, activityName, amountCents })
  }

  function handleManualAddToBasket(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!e.currentTarget.checkValidity()) {
      e.currentTarget.reportValidity()
      return
    }
    const fd = new FormData(e.currentTarget)
    const childFirstName = (fd.get('childFirstName') as string).trim()
    const childLastName = (fd.get('childLastName') as string).trim()
    const childClassId = fd.get('childClassId') as string
    const childClassName = classes.find((c) => c.id === childClassId)?.name ?? ''

    const id: GuestIdentification = {
      mode: 'manual',
      childFirstName,
      childLastName,
      childClassId,
      childClassName,
    }
    setIdentification(id, paymentLinkId)
    addActivity({ activityId, activityName, amountCents })
  }

  const lookupSucceeded = lookupState?.success === true

  // ── Shared: activity summary card ──────────────────────────────────────────
  const activityCard = (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-text-muted">Paying for</p>
      <p className="mt-0.5 font-semibold text-text-primary">{activityName}</p>
      <p className="text-xl font-bold text-primary">{formatCurrency(amountCents)}</p>
    </div>
  )

  // ── Shared: basket CTA (shown after adding) ─────────────────────────────────
  const basketCta = alreadyInBasket && (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
        <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
        Activity added to basket
      </div>
      <Link
        href="/guest-payment/basket"
        className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-medium text-primary hover:bg-primary/10"
      >
        <span className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4" aria-hidden="true" />
          View basket
        </span>
        <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-white">
          {activityCount} {activityCount === 1 ? 'item' : 'items'}
        </span>
      </Link>
      <Link
        href="/activities"
        className="block text-center text-sm text-text-muted hover:underline"
      >
        Add another activity
      </Link>
    </div>
  )

  // ── Case: basket already has a child identification ────────────────────────
  if (hasIdentification) {
    const childDisplay =
      basket!.mode === 'code'
        ? `${basket!.lookupFirstName} — ${basket!.lookupClassName}`
        : `${basket!.childFirstName} ${basket!.childLastName} — ${basket!.childClassName}`

    return (
      <div className="space-y-6">
        {activityCard}

        <div className="flex items-start justify-between rounded-lg border border-border bg-surface p-4">
          <div>
            <p className="text-sm font-medium text-text-primary">Paying as guest for:</p>
            <p className="text-sm text-text-secondary">{childDisplay}</p>
          </div>
          <button type="button" onClick={clearBasket} className="text-xs text-text-muted underline">
            Start over
          </button>
        </div>

        {alreadyInBasket ? (
          basketCta
        ) : (
          <Button type="button" className="w-full" onClick={handleAddToBasket}>
            Add to basket
          </Button>
        )}

        {!alreadyInBasket && activityCount > 0 && (
          <Link
            href="/guest-payment/basket"
            className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-medium text-primary hover:bg-primary/10"
          >
            <span className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" aria-hidden="true" />
              View basket
            </span>
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-white">
              {activityCount} {activityCount === 1 ? 'item' : 'items'}
            </span>
          </Link>
        )}
      </div>
    )
  }

  // ── Case: no basket — show identification step ─────────────────────────────
  return (
    <div className="space-y-6">
      {activityCard}

      {/* Mode tabs */}
      {!lookupSucceeded && (
        <div className="flex overflow-hidden rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setMode('code')}
            disabled={isLookupPending}
            className={cn(
              'flex-1 px-4 py-2.5 text-sm font-medium transition-colors',
              mode === 'code'
                ? 'bg-primary text-white'
                : 'bg-surface text-text-secondary hover:bg-gray-50',
            )}
          >
            Pupil payment code
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            disabled={isLookupPending}
            className={cn(
              'flex-1 border-l border-border px-4 py-2.5 text-sm font-medium transition-colors',
              mode === 'manual'
                ? 'bg-primary text-white'
                : 'bg-surface text-text-secondary hover:bg-gray-50',
            )}
          >
            Enter details manually
          </button>
        </div>
      )}

      {/* ── Code mode: pupil lookup ── */}
      {mode === 'code' && !lookupSucceeded && (
        <form
          action={lookupAction}
          onSubmit={(e) => {
            const fd = new FormData(e.currentTarget)
            setPupilCode((fd.get('pupilCode') as string | null)?.trim().toUpperCase() ?? '')
          }}
          className="space-y-4"
        >
          <Input
            label="Pupil payment code"
            name="pupilCode"
            required
            placeholder="e.g. SPP-AB12CD34"
            hint="This code is printed on the crèche communication letter."
            error={lookupState?.error ?? undefined}
            disabled={isLookupPending}
            className="uppercase"
          />
          <Button type="submit" loading={isLookupPending} className="w-full">
            Look up child
          </Button>
        </form>
      )}

      {/* ── Code mode: lookup succeeded → add to basket ── */}
      {mode === 'code' && lookupSucceeded && (
        <div className="space-y-4">
          <div className="flex items-start justify-between rounded-lg border border-success/30 bg-green-50 p-4">
            <div>
              <p className="text-sm font-medium text-green-800">Child found</p>
              <p className="text-sm text-green-700">
                {lookupState.studentFirstName} — {lookupState.className}
              </p>
            </div>
            {/* Full-page reload resets all useActionState */}
            <a
              href={`/guest-payment?activityId=${activityId}`}
              className="text-xs text-text-muted underline"
            >
              Wrong child?
            </a>
          </div>

          {alreadyInBasket ? (
            basketCta
          ) : (
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                const id: GuestIdentification = {
                  mode: 'code',
                  pupilCode,
                  lookupFirstName: lookupState.studentFirstName ?? '',
                  lookupClassName: lookupState.className ?? '',
                }
                setIdentification(id, paymentLinkId)
                handleAddToBasket()
              }}
            >
              Add to basket
            </Button>
          )}
        </div>
      )}

      {/* ── Manual mode ── */}
      {mode === 'manual' && (
        <form
          ref={manualFormRef}
          onSubmit={handleManualAddToBasket}
          className="space-y-4"
          noValidate={false}
        >
          <Alert variant="info">
            Payments entered manually are flagged for review and reconciliation by the crèche
            office.
          </Alert>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Child's first name" name="childFirstName" required />
            <Input label="Child's last name" name="childLastName" required />
          </div>

          <Select
            label="Child's class"
            name="childClassId"
            required
            options={classOptions}
            placeholder="Select class..."
          />

          <Button type="submit" className="w-full">
            Add to basket
          </Button>
        </form>
      )}
    </div>
  )
}
