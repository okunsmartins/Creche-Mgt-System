'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import type { PaymentLinkActionState } from '@/lib/payment-links/schemas'
import type { ActivityRow, PaymentLinkRow, ProgrammeRow } from '@/types/database'

type TargetType = 'activity' | 'programme'

interface PaymentLinkFormProps {
  action: (prev: PaymentLinkActionState, formData: FormData) => Promise<PaymentLinkActionState>
  activities: Pick<ActivityRow, 'id' | 'name' | 'is_active' | 'publication_status'>[]
  programmes: Pick<ProgrammeRow, 'id' | 'name' | 'is_active' | 'publication_status'>[]
  link?: Pick<
    PaymentLinkRow,
    'activity_id' | 'programme_id' | 'label' | 'expires_at' | 'max_uses' | 'is_active'
  >
  /** The existing target's display name, shown read-only in edit mode. */
  targetName?: string
  submitLabel?: string
}

export function PaymentLinkForm({
  action,
  activities,
  programmes,
  link,
  targetName,
  submitLabel = 'Create link',
}: PaymentLinkFormProps) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState<PaymentLinkActionState, FormData>(
    action,
    null,
  )
  const [targetType, setTargetType] = useState<TargetType>(
    link?.programme_id ? 'programme' : 'activity',
  )

  useEffect(() => {
    if (state && 'success' in state) router.push('/admin/payment-links')
  }, [state, router])

  const errors = state && 'fieldErrors' in state ? state.fieldErrors : {}

  const publishedActivities = activities.filter(
    (a) => a.is_active && a.publication_status !== 'archived',
  )
  const publishedProgrammes = programmes.filter(
    (p) => p.is_active && p.publication_status !== 'archived',
  )
  const isEdit = !!link

  return (
    <form action={formAction} className="space-y-5">
      {state && 'error' in state && <Alert variant="error">{state.error}</Alert>}

      {isEdit ? (
        <div>
          <label className="form-label">{link?.programme_id ? 'Programme' : 'Activity'}</label>
          <p className="mt-1 rounded-md border border-border bg-surface/50 px-3 py-2 text-sm text-text-muted">
            {targetName ?? '—'}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            The activity/programme cannot be changed after creation.
          </p>
        </div>
      ) : (
        <>
          <div>
            <label htmlFor="targetType" className="form-label">
              Pay for
            </label>
            <select
              id="targetType"
              name="targetType"
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as TargetType)}
              disabled={isPending}
              className="input-base mt-1"
            >
              <option value="activity">Activity</option>
              <option value="programme">Programme</option>
            </select>
          </div>

          <div>
            <label htmlFor="targetId" className="form-label">
              {targetType === 'programme' ? 'Programme' : 'Activity'}{' '}
              <span className="ml-1 text-error" aria-hidden="true">
                *
              </span>
            </label>
            <select
              key={targetType}
              id="targetId"
              name="targetId"
              required
              disabled={isPending}
              defaultValue=""
              className="input-base mt-1"
              aria-describedby={errors?.targetId ? 'targetId-error' : undefined}
              suppressHydrationWarning
            >
              <option value="">
                {targetType === 'programme' ? 'Select a programme…' : 'Select an activity…'}
              </option>
              {(targetType === 'programme' ? publishedProgrammes : publishedActivities).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {errors?.targetId && (
              <p id="targetId-error" className="mt-1 text-xs text-error" role="alert">
                {errors.targetId}
              </p>
            )}
          </div>
        </>
      )}

      <Input
        label="Label"
        name="label"
        type="text"
        required
        defaultValue={link?.label ?? ''}
        hint="A descriptive name shown in the admin (e.g. 'Dublin Zoo – Class 3B')."
        error={errors?.label}
        disabled={isPending}
      />

      <Input
        label="Expiry date and time"
        name="expiresAt"
        type="datetime-local"
        defaultValue={link?.expires_at ? new Date(link.expires_at).toISOString().slice(0, 16) : ''}
        hint="Optional — leave blank for no expiry."
        error={errors?.expiresAt}
        disabled={isPending}
      />

      <Input
        label="Maximum uses"
        name="maxUses"
        type="number"
        min="1"
        defaultValue={link?.max_uses?.toString() ?? ''}
        hint="Optional — leave blank for unlimited uses."
        error={errors?.maxUses}
        disabled={isPending}
      />

      {/* Hidden input carries the isActive value; checkbox below updates it via onChange */}
      <input
        type="hidden"
        name="isActive"
        defaultValue={link?.is_active !== false ? 'true' : 'false'}
      />
      <div className="flex items-center gap-3">
        <input
          id="isActive"
          type="checkbox"
          defaultChecked={link?.is_active ?? true}
          disabled={isPending}
          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
          onChange={(e) => {
            const hidden = e.currentTarget.form?.elements.namedItem(
              'isActive',
            ) as HTMLInputElement | null
            if (hidden) hidden.value = e.currentTarget.checked ? 'true' : 'false'
          }}
        />
        <label htmlFor="isActive" className="text-sm font-medium text-text-primary">
          Active
        </label>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={isPending}>
          {submitLabel}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={isPending}
          onClick={() => router.push('/admin/payment-links')}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
