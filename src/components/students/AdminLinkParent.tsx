'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { adminLinkParentAction } from '@/lib/students/actions'
import type { StudentActionState } from '@/lib/students/schemas'

interface AdminLinkParentProps {
  studentId: string
}

export function AdminLinkParent({ studentId }: AdminLinkParentProps) {
  const [state, formAction, isPending] = useActionState<StudentActionState, FormData>(
    adminLinkParentAction,
    null,
  )

  return (
    <div className="space-y-3">
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.message}</Alert>}

      {!state?.success && (
        <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="studentId" value={studentId} />
          <div className="flex-1">
            <Input
              label="Parent email address"
              name="parentEmail"
              type="email"
              autoComplete="off"
              placeholder="parent@example.com"
              error={state?.fieldErrors?.parentEmail}
              disabled={isPending}
              hint="The parent must already have a registered account."
            />
          </div>
          <Button type="submit" loading={isPending} className="shrink-0">
            Link parent
          </Button>
        </form>
      )}
    </div>
  )
}
