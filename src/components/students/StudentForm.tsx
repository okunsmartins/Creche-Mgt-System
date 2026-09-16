'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Select } from '@/components/ui/Select'
import type { StudentActionState } from '@/lib/students/schemas'
import type { SelectOption } from '@/types'

interface StudentFormProps {
  /** Server action for the form — either createStudentAction or updateStudentAction */
  action: (prev: StudentActionState, formData: FormData) => Promise<StudentActionState>
  classes: SelectOption[]
  /** Populated in edit mode; omit for create */
  student?:
    | {
        id: string
        firstName: string
        lastName: string
        classId: string
      }
    | undefined
}

export function StudentForm({ action, classes, student }: StudentFormProps) {
  const [state, formAction, isPending] = useActionState<StudentActionState, FormData>(action, null)

  const isEdit = Boolean(student)

  return (
    <form action={formAction} className="space-y-5">
      {/* Hidden field for edit mode */}
      {student && <input type="hidden" name="studentId" value={student.id} />}

      {state?.error && <Alert variant="error">{state.error}</Alert>}

      {state?.success && <Alert variant="success">{state.message}</Alert>}

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label="First name"
          name="firstName"
          required
          defaultValue={student?.firstName ?? ''}
          error={state?.fieldErrors?.firstName}
          disabled={isPending}
          autoComplete="off"
        />
        <Input
          label="Last name"
          name="lastName"
          required
          defaultValue={student?.lastName ?? ''}
          error={state?.fieldErrors?.lastName}
          disabled={isPending}
          autoComplete="off"
        />
      </div>

      <Select
        label="Class"
        name="classId"
        required
        options={classes}
        placeholder="Select a class…"
        defaultValue={student?.classId ?? ''}
        error={state?.fieldErrors?.classId}
        disabled={isPending}
      />

      {!isEdit && (
        <div className="space-y-5 border-t border-border pt-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            Parent / Guardian
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Parent first name"
              name="parentFirstName"
              required
              error={state?.fieldErrors?.parentFirstName}
              disabled={isPending}
              autoComplete="off"
            />
            <Input
              label="Parent last name"
              name="parentLastName"
              required
              error={state?.fieldErrors?.parentLastName}
              disabled={isPending}
              autoComplete="off"
            />
          </div>
          <Input
            label="Parent email address"
            name="parentEmail"
            type="email"
            required
            error={state?.fieldErrors?.parentEmail}
            disabled={isPending}
            autoComplete="off"
          />
        </div>
      )}

      <div className="flex gap-3">
        <Button type="submit" loading={isPending}>
          {isEdit ? 'Save changes' : 'Create student'}
        </Button>
        <Button type="button" variant="outline" onClick={() => history.back()} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
