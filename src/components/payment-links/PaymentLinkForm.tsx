'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import type { PaymentLinkActionState } from '@/lib/payment-links/schemas'
import type { ActivityRow, PaymentLinkRow } from '@/types/database'

interface PaymentLinkFormProps {
  action: (prev: PaymentLinkActionState, formData: FormData) => Promise<PaymentLinkActionState>
  activities: Pick<ActivityRow, 'id' | 'name' | 'is_active' | 'publication_status'>[]
  link?: Pick<PaymentLinkRow, 'activity_id' | 'label' | 'expires_at' | 'max_uses' | 'is_active'>
  submitLabel?: string
}

export function PaymentLinkForm({
  action,
  activities,
  link,
  submitLabel = 'Create link',
}: PaymentLinkFormProps) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState<PaymentLinkActionState, FormData>(
    action,
    null,
  )

  useEffect(() => {
    if (state && 'success' in state) router.push('/admin/payment-links')
  }, [state, router])

  const errors = state && 'fieldErrors' in state ? state.fieldErrors : {}

  const publishedActivities = activities.filter(
    (a) => a.is_active && a.publication_status !== 'archived',
  )

  return (
    <form action={formAction} className="space-y-5">
      {state && 'error' in state && <Alert variant="error">{state.error}</Alert>}

      <div>
        <label htmlFor="activityId" className="form-label">
          Activity{' '}
          <span className="ml-1 text-error" aria-hidden="true">
            *
          </span>
        </label>
        <select
          id="activityId"
          name="activityId"
          required
          disabled={isPending || !!link}
          defaultValue={link?.activity_id ?? ''}
          className="input-base mt-1"
          aria-describedby={errors?.activityId ? 'activityId-error' : undefined}
          suppressHydrationWarning
        >
          <option value="">Select an activity…</option>
          {publishedActivities.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {errors?.activityId && (
          <p id="activityId-error" className="mt-1 text-xs text-error" role="alert">
            {errors.activityId}
          </p>
        )}
        {link && (
          <p className="mt-1 text-xs text-text-muted">Activity cannot be changed after creation.</p>
        )}
      </div>

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
