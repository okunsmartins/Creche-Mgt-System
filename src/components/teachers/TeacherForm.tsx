'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import type { TeacherActionState } from '@/lib/teachers/schemas'
import type { TeacherRow } from '@/types/database'

interface TeacherFormProps {
  action: (prev: TeacherActionState, formData: FormData) => Promise<TeacherActionState>
  teacher?: Pick<TeacherRow, 'first_name' | 'last_name' | 'display_name' | 'email' | 'is_active'>
  submitLabel?: string
}

export function TeacherForm({
  action,
  teacher,
  submitLabel = 'Save staff member',
}: TeacherFormProps) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState<TeacherActionState, FormData>(action, null)
  const [isActive, setIsActive] = useState(teacher?.is_active ?? true)

  useEffect(() => {
    if (state && 'success' in state) router.push('/admin/teachers')
  }, [state, router])

  const errors = state && 'fieldErrors' in state ? state.fieldErrors : {}

  return (
    <form action={formAction} className="space-y-5">
      {state && 'error' in state && <Alert variant="error">{state.error}</Alert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="First name"
          name="firstName"
          type="text"
          autoComplete="given-name"
          required
          defaultValue={teacher?.first_name ?? ''}
          error={errors?.firstName}
          disabled={isPending}
        />
        <Input
          label="Last name"
          name="lastName"
          type="text"
          autoComplete="family-name"
          required
          defaultValue={teacher?.last_name ?? ''}
          error={errors?.lastName}
          disabled={isPending}
        />
      </div>

      <Input
        label="Display name"
        name="displayName"
        type="text"
        defaultValue={teacher?.display_name ?? ''}
        hint={
          'Short name shown in payment references, e.g. “Ms Kelly”. Defaults to first + last name if left blank.'
        }
        error={errors?.displayName}
        disabled={isPending}
      />

      <Input
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={teacher?.email ?? ''}
        hint="Optional — for display purposes only; not used to send emails."
        error={errors?.email}
        disabled={isPending}
      />

      {/* Hidden input carries the isActive value; its value is driven by React state
          so an unchecked checkbox reliably submits 'false' (plain checkboxes submit
          nothing when unchecked, which would otherwise silently drop deactivation). */}
      <input type="hidden" name="isActive" value={isActive ? 'true' : 'false'} />
      <div className="flex items-center gap-3">
        <input
          id="isActive"
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.currentTarget.checked)}
          disabled={isPending}
          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
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
          onClick={() => router.push('/admin/teachers')}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
