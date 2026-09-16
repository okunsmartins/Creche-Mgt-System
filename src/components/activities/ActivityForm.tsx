'use client'

import { useActionState, useMemo, useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import type { ActivityActionState } from '@/lib/activities/schemas'

interface ClassOption {
  id: string
  name: string
}

interface StudentOption {
  id: string
  first_name: string
  last_name: string
  class_id: string
}

interface ActivityFormProps {
  action: (prev: ActivityActionState, formData: FormData) => Promise<ActivityActionState>
  classes: ClassOption[]
  students?: StudentOption[] | undefined
  activity?:
    | {
        id: string
        name: string
        description: string | null
        amountEuros: string
        accountingCode: string | null
        opensAt: string | null
        closesAt: string | null
        classIds: string[]
        pupilIds?: string[] | undefined
      }
    | undefined
}

export function ActivityForm({ action, classes, students, activity }: ActivityFormProps) {
  const [state, formAction, isPending] = useActionState<ActivityActionState, FormData>(action, null)
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(
    () => new Set(activity?.classIds ?? []),
  )
  const [selectedPupilIds, setSelectedPupilIds] = useState<Set<string>>(
    () => new Set(activity?.pupilIds ?? []),
  )

  const allSelected = classes.length > 0 && selectedClassIds.size === classes.length
  const toggleAll = () => {
    if (allSelected) {
      setSelectedClassIds(new Set())
    } else {
      setSelectedClassIds(new Set(classes.map((c) => c.id)))
    }
  }

  // Group students by class for the pupil picker
  const studentsByClass = useMemo(() => {
    if (!students || students.length === 0) return []
    const classMap = new Map<string, { className: string; students: StudentOption[] }>()
    for (const student of students) {
      const cls = classes.find((c) => c.id === student.class_id)
      const className = cls?.name ?? 'Unknown class'
      const existing = classMap.get(student.class_id)
      if (existing) {
        existing.students.push(student)
      } else {
        classMap.set(student.class_id, { className, students: [student] })
      }
    }
    // Sort by class order (matches the classes array order)
    return classes
      .map((c) => classMap.get(c.id))
      .filter((g): g is { className: string; students: StudentOption[] } => g !== undefined)
  }, [students, classes])

  return (
    <form action={formAction} className="space-y-6">
      {activity && <input type="hidden" name="activityId" value={activity.id} />}

      {state?.error && <Alert variant="error">{state.error}</Alert>}
      {state?.success && (
        <Alert variant="success">
          {state.message}{' '}
          <Link href="/admin/activities" className="underline">
            View all activities
          </Link>
        </Alert>
      )}
      {state?.warning && <Alert variant="warning">{state.warning}</Alert>}

      {!state?.success && (
        <>
          <div className="space-y-4">
            <Input
              label="Activity name"
              name="name"
              required
              defaultValue={activity?.name ?? ''}
              error={state?.fieldErrors?.name}
              disabled={isPending}
              placeholder="e.g. School Tour 2026"
              maxLength={200}
            />

            <Textarea
              label="Description"
              name="description"
              defaultValue={activity?.description ?? ''}
              error={state?.fieldErrors?.description}
              disabled={isPending}
              placeholder="Optional: brief description for parents"
              rows={3}
              maxLength={2000}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Amount (€)"
                name="amountEuros"
                required
                defaultValue={activity?.amountEuros ?? ''}
                error={state?.fieldErrors?.amountEuros}
                disabled={isPending}
                placeholder="e.g. 5.00"
                inputMode="decimal"
              />

              <Input
                label="Accounting code"
                name="accountingCode"
                defaultValue={activity?.accountingCode ?? ''}
                error={state?.fieldErrors?.accountingCode}
                disabled={isPending}
                placeholder="Optional GL / cost-centre code"
                maxLength={50}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Opens at"
                name="opensAt"
                type="datetime-local"
                defaultValue={activity?.opensAt ?? ''}
                error={state?.fieldErrors?.opensAt}
                disabled={isPending}
                hint="Leave blank to open immediately when published"
              />

              <Input
                label="Closes at"
                name="closesAt"
                type="datetime-local"
                defaultValue={activity?.closesAt ?? ''}
                error={state?.fieldErrors?.closesAt}
                disabled={isPending}
                hint="Leave blank for no closing date"
              />
            </div>
          </div>

          <fieldset>
            <div className="mb-2 flex items-center justify-between">
              <legend className="form-label">
                Eligible classes
                {studentsByClass.length === 0 && (
                  <span className="ml-1 text-error" aria-hidden="true">
                    *
                  </span>
                )}
              </legend>
              {classes.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAll}
                  disabled={isPending}
                  className="text-xs text-primary hover:underline disabled:opacity-50"
                  suppressHydrationWarning
                >
                  {allSelected ? 'Deselect all' : 'Select all classes'}
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

          {studentsByClass.length > 0 && (
            <fieldset>
              <legend className="form-label mb-1">
                Individual pupils <span className="font-normal text-text-muted">(optional)</span>
              </legend>
              <p className="mb-3 text-xs text-text-muted">
                Select specific pupils to make this activity available to them regardless of class
                eligibility above.
              </p>
              <div className="space-y-4">
                {studentsByClass.map(({ className, students: groupStudents }) => {
                  const classAllSelected =
                    groupStudents.length > 0 &&
                    groupStudents.every((s) => selectedPupilIds.has(s.id))
                  const toggleClass = () => {
                    const next = new Set(selectedPupilIds)
                    if (classAllSelected) {
                      groupStudents.forEach((s) => next.delete(s.id))
                    } else {
                      groupStudents.forEach((s) => next.add(s.id))
                    }
                    setSelectedPupilIds(next)
                  }
                  return (
                    <div key={className}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                          {className}
                        </p>
                        <button
                          type="button"
                          onClick={toggleClass}
                          disabled={isPending}
                          className="text-xs text-primary hover:underline disabled:opacity-50"
                          suppressHydrationWarning
                        >
                          {classAllSelected ? 'Deselect all' : 'Select all'}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {groupStudents.map((student) => (
                          <label
                            key={student.id}
                            className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2.5 text-sm transition-colors hover:bg-surface"
                          >
                            <input
                              type="checkbox"
                              name="pupilIds"
                              value={student.id}
                              checked={selectedPupilIds.has(student.id)}
                              onChange={(e) => {
                                const next = new Set(selectedPupilIds)
                                if (e.target.checked) next.add(student.id)
                                else next.delete(student.id)
                                setSelectedPupilIds(next)
                              }}
                              disabled={isPending}
                              className="h-4 w-4 rounded border-gray-300 accent-primary"
                            />
                            {student.first_name} {student.last_name}
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </fieldset>
          )}

          <div className="flex gap-3">
            <Button type="submit" loading={isPending}>
              {activity ? 'Save changes' : 'Create activity'}
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/activities">Cancel</Link>
            </Button>
          </div>
        </>
      )}
    </form>
  )
}
