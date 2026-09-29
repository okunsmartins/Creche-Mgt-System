'use client'

import { useActionState } from 'react'
import { Upload, CheckCircle, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { importStudentsAction, type ImportStudentsState } from '@/lib/students/actions'

export function ImportStudentsForm() {
  const [state, formAction, isPending] = useActionState<ImportStudentsState, FormData>(
    importStudentsAction,
    null,
  )

  return (
    <div className="space-y-5">
      {state?.error && <Alert variant="error">{state.error}</Alert>}

      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="file" className="mb-1 block text-sm font-medium text-text-primary">
            CSV file
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-text-primary hover:file:bg-surface-raised"
          />
          <p className="mt-2 text-xs text-text-muted">
            Header row required, with columns <strong>first name</strong>,{' '}
            <strong>last name</strong> and <strong>class</strong>. The class must exactly match one
            of your crèche&apos;s classes. Up to 500 rows per import. Pupil payment codes are
            generated automatically.
          </p>
        </div>

        <Button type="submit" loading={isPending}>
          {!isPending && <Upload className="h-4 w-4" aria-hidden="true" />}
          Import students
        </Button>
      </form>

      {state?.summary && (
        <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-success" aria-hidden="true" />
            <span className="font-medium text-text-primary">
              {state.summary.created} student{state.summary.created === 1 ? '' : 's'} imported
            </span>
            {state.summary.skipped > 0 && (
              <span className="text-text-muted">
                · {state.summary.skipped} skipped (duplicates)
              </span>
            )}
          </div>

          {state.summary.errors.length > 0 && (
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-sm font-medium text-amber-700">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                {state.summary.errors.length} row
                {state.summary.errors.length === 1 ? '' : 's'} skipped with errors
              </p>
              <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-text-secondary">
                {state.summary.errors.map((e) => (
                  <li key={e.line}>
                    Line {e.line}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
