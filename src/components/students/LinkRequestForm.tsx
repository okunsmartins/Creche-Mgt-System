'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { submitLinkRequestAction } from '@/lib/students/actions'
import type { StudentActionState } from '@/lib/students/schemas'

export function LinkRequestForm() {
  const [state, formAction, isPending] = useActionState<StudentActionState, FormData>(
    submitLinkRequestAction,
    null,
  )

  return (
    <div className="card p-6">
      <h2 className="mb-1 text-lg font-semibold text-text-primary">Link a child</h2>
      <p className="mb-4 text-sm text-text-muted">
        Enter the pupil payment code from your child&apos;s school letter. An admin will review and
        approve the request.
      </p>

      {state?.error && (
        <Alert variant="error" className="mb-4">
          {state.error}
        </Alert>
      )}
      {state?.success && (
        <Alert variant="success" className="mb-4">
          {state.message}
        </Alert>
      )}

      {!state?.success && (
        <form action={formAction} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Pupil payment code"
              name="pupilCode"
              placeholder="e.g. SPP-AB12CD34"
              error={state?.fieldErrors?.pupilCode}
              disabled={isPending}
              autoComplete="off"
              className="font-mono uppercase"
              hint="Find this on your child's payment letter from the school."
            />
          </div>
          <Button type="submit" loading={isPending} className="shrink-0">
            Submit request
          </Button>
        </form>
      )}
    </div>
  )
}
