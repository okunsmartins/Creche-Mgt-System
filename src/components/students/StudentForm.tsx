'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Select } from '@/components/ui/Select'
import {
  CHILD_SESSIONS,
  CHILD_SESSION_LABELS,
  type StudentActionState,
  type StudentCareFields,
} from '@/lib/students/schemas'
import type { SelectOption } from '@/types'

interface StudentFormProps {
  /** Server action for the form — either createStudentAction or updateStudentAction */
  action: (prev: StudentActionState, formData: FormData) => Promise<StudentActionState>
  classes: SelectOption[]
  /** Populated in edit mode; omit for create */
  student?:
    | ({
        id: string
        firstName: string
        lastName: string
        classId: string
      } & Partial<StudentCareFields>)
    | undefined
}

const SESSION_OPTIONS: SelectOption[] = CHILD_SESSIONS.map((s) => ({
  value: s,
  label: CHILD_SESSION_LABELS[s],
}))

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
        label="Room"
        name="classId"
        required
        options={classes}
        placeholder="Select a room…"
        defaultValue={student?.classId ?? ''}
        error={state?.fieldErrors?.classId}
        disabled={isPending}
      />

      {/* Care record — captured on create and edit. */}
      <>
        <Select
          label="Session"
          name="session"
          options={SESSION_OPTIONS}
          placeholder="Not set"
          defaultValue={student?.session ?? ''}
          disabled={isPending}
        />

        {isEdit && (
          <Input
            label="Parent mobile"
            name="parentMobile"
            type="tel"
            defaultValue={student?.parentMobile ?? ''}
            disabled={isPending}
            autoComplete="off"
            hint="Used to text the parent (e.g. reminders)."
          />
        )}

        <div className="space-y-5 border-t border-border pt-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            Emergency contact
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Name"
              name="emergencyContactName"
              defaultValue={student?.emergencyContactName ?? ''}
              disabled={isPending}
              autoComplete="off"
            />
            <Input
              label="Phone"
              name="emergencyContactPhone"
              type="tel"
              defaultValue={student?.emergencyContactPhone ?? ''}
              disabled={isPending}
              autoComplete="off"
            />
          </div>
          <Input
            label="Relationship to child"
            name="emergencyContactRelationship"
            defaultValue={student?.emergencyContactRelationship ?? ''}
            disabled={isPending}
            autoComplete="off"
          />
        </div>

        <div className="space-y-5 border-t border-border pt-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            Health &amp; dietary
          </h2>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-text-primary">Allergies</span>
            <textarea
              name="allergies"
              className="input-base min-h-[70px]"
              placeholder="e.g. peanuts, dairy — or leave blank if none"
              defaultValue={student?.allergies ?? ''}
              disabled={isPending}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-text-primary">Dietary needs</span>
            <textarea
              name="dietaryNeeds"
              className="input-base min-h-[70px]"
              placeholder="e.g. vegetarian, halal, no pork"
              defaultValue={student?.dietaryNeeds ?? ''}
              disabled={isPending}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-text-primary">Medical conditions</span>
            <textarea
              name="medicalConditions"
              className="input-base min-h-[70px]"
              placeholder="e.g. asthma, epilepsy — include any care notes"
              defaultValue={student?.medicalConditions ?? ''}
              disabled={isPending}
            />
          </label>
        </div>

        <div className="space-y-4 border-t border-border pt-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            Medication
          </h2>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="medicationConsent"
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              defaultChecked={student?.medicationConsent ?? false}
              disabled={isPending}
            />
            <span className="font-medium text-text-primary">
              Parent/guardian consents to staff administering medication
            </span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-text-primary">
              Medication details (name, dose, when to give)
            </span>
            <textarea
              name="medicationNotes"
              className="input-base min-h-[70px]"
              placeholder="Only complete if consent is given above"
              defaultValue={student?.medicationNotes ?? ''}
              disabled={isPending}
            />
          </label>
        </div>
      </>

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
          <Input
            label="Parent mobile"
            name="parentMobile"
            type="tel"
            error={state?.fieldErrors?.parentMobile}
            disabled={isPending}
            autoComplete="off"
            hint="So you can text the parent (optional)."
          />
        </div>
      )}

      <div className="flex gap-3">
        <Button type="submit" loading={isPending}>
          {isEdit ? 'Save changes' : 'Create child'}
        </Button>
        <Button type="button" variant="outline" onClick={() => history.back()} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
