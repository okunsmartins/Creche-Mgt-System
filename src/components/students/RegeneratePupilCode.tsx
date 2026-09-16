'use client'

import { useState, useActionState } from 'react'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { regeneratePupilCodeAction } from '@/lib/students/actions'
import type { StudentActionState } from '@/lib/students/schemas'

interface RegeneratePupilCodeProps {
  studentId: string
  currentCode: string
}

export function RegeneratePupilCode({ studentId, currentCode }: RegeneratePupilCodeProps) {
  const [confirmed, setConfirmed] = useState(false)
  const [state, formAction, isPending] = useActionState<StudentActionState, FormData>(
    regeneratePupilCodeAction,
    null,
  )

  if (state?.success) {
    return <Alert variant="success">{state.message}</Alert>
  }

  return (
    <div className="space-y-3">
      <p className="font-mono text-sm">
        Current code: <span className="font-semibold">{currentCode}</span>
      </p>

      {state?.error && <Alert variant="error">{state.error}</Alert>}

      {!confirmed ? (
        <Button variant="outline" type="button" onClick={() => setConfirmed(true)}>
          Regenerate code
        </Button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium text-warning">
            This will immediately invalidate the current code. Continue?
          </p>
          <div className="flex gap-2">
            <form action={formAction}>
              <input type="hidden" name="studentId" value={studentId} />
              <Button type="submit" variant="danger" loading={isPending}>
                Yes, regenerate
              </Button>
            </form>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmed(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
