'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { toggleStudentActiveAction } from '@/lib/students/actions'
import type { StudentActionState } from '@/lib/students/schemas'

interface StudentStatusToggleProps {
  studentId: string
  isActive: boolean
}

export function StudentStatusToggle({ studentId, isActive }: StudentStatusToggleProps) {
  const [state, formAction, isPending] = useActionState<StudentActionState, FormData>(
    toggleStudentActiveAction,
    null,
  )

  return (
    <div className="space-y-3">
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.success && <Alert variant="success">{state.message}</Alert>}

      <form action={formAction}>
        <input type="hidden" name="studentId" value={studentId} />
        <input type="hidden" name="activate" value={isActive ? 'false' : 'true'} />
        <Button type="submit" variant={isActive ? 'danger' : 'outline'} loading={isPending}>
          {isActive ? 'Deactivate student' : 'Reactivate student'}
        </Button>
      </form>
    </div>
  )
}
