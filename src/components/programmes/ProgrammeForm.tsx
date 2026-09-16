'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import type { ProgrammeActionState } from '@/lib/programmes/schemas'
import type { PricingModel } from '@/types/database'

interface ClassOption {
  id: string
  name: string
}

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
] as const

const PRICING_MODELS: { value: PricingModel; label: string; hint: string }[] = [
  { value: 'per_term', label: 'Per term', hint: 'One payment covers the full term' },
  { value: 'per_month', label: 'Per month', hint: 'Monthly recurring payment' },
  { value: 'per_session', label: 'Per session', hint: 'Pay each time the child attends' },
]

interface ProgrammeFormProps {
  action: (prev: ProgrammeActionState, formData: FormData) => Promise<ProgrammeActionState>
  classes: ClassOption[]
  programme?:
    | {
        id: string
        name: string
        description: string | null
        priceEuros: string
        pricingModel: PricingModel
        daysOfWeek: string[]
        sessionTime: string | null
        termStart: string | null
        termEnd: string | null
        maxEnrolments: number | null
        classIds: string[]
      }
    | undefined
}

export function ProgrammeForm({ action, classes, programme }: ProgrammeFormProps) {
  const [state, formAction, isPending] = useActionState<ProgrammeActionState, FormData>(
    action,
    null,
  )

  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(
    () => new Set(programme?.classIds ?? []),
  )
  const [selectedDays, setSelectedDays] = useState<Set<string>>(
    () => new Set(programme?.daysOfWeek ?? []),
  )

  const allClassesSelected = classes.length > 0 && selectedClassIds.size === classes.length
  const toggleAllClasses = () => {
    if (allClassesSelected) {
      setSelectedClassIds(new Set())
    } else {
      setSelectedClassIds(new Set(classes.map((c) => c.id)))
    }
  }

  return (
    <form action={formAction} className="space-y-6">
      {programme && <input type="hidden" name="programmeId" value={programme.id} />}

      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.success && (
        <Alert variant="success">
          {state.message}{' '}
          <Link href="/admin/programmes" className="underline">
            View all programmes
          </Link>
        </Alert>
      )}

      {!state?.success && (
        <>
          <div className="space-y-4">
            <Input
              label="Programme name"
              name="name"
              required
              defaultValue={programme?.name ?? ''}
              error={state?.fieldErrors?.name}
              disabled={isPending}
              placeholder="e.g. After-School Football Club"
              maxLength={200}
            />

            <Textarea
              label="Description"
              name="description"
              defaultValue={programme?.description ?? ''}
              error={state?.fieldErrors?.description}
              disabled={isPending}
              placeholder="Optional: brief description for parents"
              rows={3}
              maxLength={2000}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Price (€)"
                name="priceEuros"
                required
                defaultValue={programme?.priceEuros ?? ''}
                error={state?.fieldErrors?.priceEuros}
                disabled={isPending}
                placeholder="e.g. 50.00"
                inputMode="decimal"
              />

              <div>
                <label className="form-label mb-1 block" htmlFor="pricingModel">
                  Pricing model{' '}
                  <span className="text-error" aria-hidden="true">
                    *
                  </span>
                </label>
                <select
                  id="pricingModel"
                  name="pricingModel"
                  defaultValue={programme?.pricingModel ?? 'per_term'}
                  disabled={isPending}
                  className="input-base mt-1 w-full"
                >
                  {PRICING_MODELS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                {state?.fieldErrors?.pricingModel && (
                  <p role="alert" className="mt-1 text-xs text-error">
                    {state.fieldErrors.pricingModel}
                  </p>
                )}
                <p className="mt-1 text-xs text-text-muted">
                  {
                    PRICING_MODELS.find((m) => m.value === (programme?.pricingModel ?? 'per_term'))
                      ?.hint
                  }
                </p>
              </div>
            </div>

            <div>
              <p className="form-label mb-2">
                Session days{' '}
                <span className="text-error" aria-hidden="true">
                  *
                </span>
              </p>
              {state?.fieldErrors?.daysOfWeek && (
                <p role="alert" className="mb-2 text-xs text-error">
                  {state.fieldErrors.daysOfWeek}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map(({ value, label }) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-surface"
                  >
                    <input
                      type="checkbox"
                      name="daysOfWeek"
                      value={value}
                      checked={selectedDays.has(value)}
                      onChange={(e) => {
                        const next = new Set(selectedDays)
                        if (e.target.checked) next.add(value)
                        else next.delete(value)
                        setSelectedDays(next)
                      }}
                      disabled={isPending}
                      className="h-4 w-4 rounded border-gray-300 accent-primary"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Session time"
                name="sessionTime"
                type="time"
                defaultValue={programme?.sessionTime ?? ''}
                error={state?.fieldErrors?.sessionTime}
                disabled={isPending}
                hint="Optional: start time of each session"
              />

              <Input
                label="Max enrolments"
                name="maxEnrolments"
                type="number"
                min={1}
                defaultValue={programme?.maxEnrolments ?? ''}
                error={state?.fieldErrors?.maxEnrolments}
                disabled={isPending}
                placeholder="Leave blank for unlimited"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Term start"
                name="termStart"
                type="date"
                defaultValue={programme?.termStart ?? ''}
                error={state?.fieldErrors?.termStart}
                disabled={isPending}
                hint="Optional: first day of term"
              />

              <Input
                label="Term end"
                name="termEnd"
                type="date"
                defaultValue={programme?.termEnd ?? ''}
                error={state?.fieldErrors?.termEnd}
                disabled={isPending}
                hint="Optional: last day of term"
              />
            </div>
          </div>

          <fieldset>
            <div className="mb-2 flex items-center justify-between">
              <legend className="form-label">
                Eligible classes{' '}
                <span className="text-error" aria-hidden="true">
                  *
                </span>
              </legend>
              {classes.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAllClasses}
                  disabled={isPending}
                  className="text-xs text-primary hover:underline disabled:opacity-50"
                  suppressHydrationWarning
                >
                  {allClassesSelected ? 'Deselect all' : 'Select all classes'}
                </button>
              )}
            </div>
            {state?.fieldErrors?.classIds && (
              <p role="alert" className="mb-2 text-xs text-error">
                {state.fieldErrors.classIds}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {classes.map((cls) => (
                <label
                  key={cls.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2.5 text-sm transition-colors hover:bg-surface"
                >
                  <input
                    type="checkbox"
                    name="classIds"
                    value={cls.id}
                    checked={selectedClassIds.has(cls.id)}
                    onChange={(e) => {
                      const next = new Set(selectedClassIds)
                      if (e.target.checked) next.add(cls.id)
                      else next.delete(cls.id)
                      setSelectedClassIds(next)
                    }}
                    disabled={isPending}
                    className="h-4 w-4 rounded border-gray-300 accent-primary"
                  />
                  {cls.name}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex gap-3">
            <Button type="submit" loading={isPending}>
              {programme ? 'Save changes' : 'Create programme'}
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/programmes">Cancel</Link>
            </Button>
          </div>
        </>
      )}
    </form>
  )
}
