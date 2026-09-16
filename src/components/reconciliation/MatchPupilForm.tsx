'use client'

import { useActionState, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Input } from '@/components/ui/Input'
import { matchPupilAction, type ReconciliationState } from '@/lib/reconciliation/actions'

interface StudentOption {
  id: string
  first_name: string
  last_name: string
  pupil_payment_code: string
  class_name: string
}

interface MatchPupilFormProps {
  orderItemId: string
  snapshotName: string
  snapshotClass: string
  students: StudentOption[]
}

export function MatchPupilForm({
  orderItemId,
  snapshotName,
  snapshotClass,
  students,
}: MatchPupilFormProps) {
  const [state, formAction, isPending] = useActionState<ReconciliationState, FormData>(
    matchPupilAction,
    null,
  )
  const [search, setSearch] = useState('')

  const filtered = students.filter((s) => {
    const fullName = `${s.first_name} ${s.last_name}`.toLowerCase()
    const q = search.toLowerCase()
    return (
      fullName.includes(q) ||
      s.pupil_payment_code.toLowerCase().includes(q) ||
      s.class_name.toLowerCase().includes(q)
    )
  })

  if (state?.success) {
    return (
      <Alert variant="success" className="text-xs">
        Matched — verification status updated to &ldquo;Manually Matched&rdquo;.
      </Alert>
    )
  }

  return (
    <div className="space-y-2">
      {state?.error && (
        <Alert variant="error" className="text-xs">
          {state.error}
        </Alert>
      )}
      <p className="text-xs text-text-muted">
        Submitted: <span className="font-medium text-text-primary">{snapshotName}</span> &middot;{' '}
        {snapshotClass}
      </p>
      <Input
        type="text"
        placeholder="Search by name, code or class..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="text-sm"
      />
      {search && filtered.length === 0 && (
        <p className="text-xs text-text-muted">No students found.</p>
      )}
      {search && filtered.length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-white">
          {filtered.map((s) => (
            <form key={s.id} action={formAction}>
              <input type="hidden" name="orderItemId" value={orderItemId} />
              <input type="hidden" name="studentId" value={s.id} />
              <button
                type="submit"
                disabled={isPending}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface disabled:opacity-50"
              >
                <span className="font-medium text-text-primary">
                  {s.first_name} {s.last_name}
                </span>
                <span className="text-xs text-text-muted">
                  {s.class_name} &middot; {s.pupil_payment_code}
                </span>
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  )
}
