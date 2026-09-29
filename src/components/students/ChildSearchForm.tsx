'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Search, UserPlus, CheckCircle, Clock } from 'lucide-react'
import {
  searchStudentsForLinkAction,
  submitLinkRequestByStudentIdAction,
  submitLinkRequestAction,
} from '@/lib/students/actions'
import type { ChildSearchState, StudentActionState } from '@/lib/students/schemas'

// ── Individual "Request to link" button per search result ─────────────────────

function LinkRequestButton({ studentId }: { studentId: string }) {
  const boundAction = submitLinkRequestByStudentIdAction.bind(null, studentId)
  const [state, formAction, isPending] = useActionState<StudentActionState, FormData>(
    boundAction,
    null,
  )

  if (state?.success) {
    return (
      <span className="flex items-center gap-1.5 text-sm font-medium text-success">
        <CheckCircle className="h-4 w-4" aria-hidden="true" />
        Request sent
      </span>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <form action={formAction}>
        <Button type="submit" size="sm" loading={isPending} disabled={isPending}>
          <UserPlus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Request link
        </Button>
      </form>
      {state?.error && <span className="text-xs text-error">{state.error}</span>}
    </div>
  )
}

// ── Pupil code fallback (collapsed by default) ────────────────────────────────

function PupilCodeForm() {
  const [state, formAction, isPending] = useActionState<StudentActionState, FormData>(
    submitLinkRequestAction,
    null,
  )

  if (state?.success) {
    return <Alert variant="success">{state.message}</Alert>
  }

  return (
    <div>
      {state?.error && (
        <Alert variant="error" className="mb-4">
          {state.error}
        </Alert>
      )}
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
            hint="Find this on your child's payment letter from the crèche."
          />
        </div>
        <Button type="submit" loading={isPending} className="shrink-0">
          Submit request
        </Button>
      </form>
    </div>
  )
}

// ── Main search form ──────────────────────────────────────────────────────────

export function ChildSearchForm() {
  const [state, searchAction, isSearching] = useActionState<ChildSearchState, FormData>(
    searchStudentsForLinkAction,
    null,
  )

  return (
    <div className="space-y-6">
      {/* Search card */}
      <div className="card p-6">
        <h2 className="mb-1 text-lg font-semibold text-text-primary">Find a child</h2>
        <p className="mb-5 text-sm text-text-muted">
          Enter your child&apos;s first and last name to search the crèche register. The crèche will
          review and approve your link request before access is granted.
        </p>

        <form action={searchAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="First name"
              name="firstName"
              placeholder="e.g. Emma"
              error={state?.fieldErrors?.firstName}
              disabled={isSearching}
              autoComplete="off"
            />
            <Input
              label="Last name"
              name="lastName"
              placeholder="e.g. Murphy"
              error={state?.fieldErrors?.lastName}
              disabled={isSearching}
              autoComplete="off"
            />
          </div>
          <Button type="submit" loading={isSearching} className="w-full sm:w-auto">
            <Search className="mr-2 h-4 w-4" aria-hidden="true" />
            Search
          </Button>
        </form>
      </div>

      {/* Results */}
      {state?.searched && (
        <div>
          {state.error && <Alert variant="error">{state.error}</Alert>}

          {!state.error && state.results?.length === 0 && (
            <div className="rounded-lg border border-border bg-surface p-6 text-center">
              <p className="text-sm text-text-muted">
                No children found with that name. Check the spelling and try again, or contact the
                school office if you believe there is an error.
              </p>
            </div>
          )}

          {(state.results?.length ?? 0) > 0 && (
            <div>
              <p className="mb-3 text-sm text-text-muted">
                {state.results!.length} result{state.results!.length !== 1 ? 's' : ''} — select your
                child and click &ldquo;Request link&rdquo;
              </p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-surface">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                        Name
                      </th>
                      <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted sm:table-cell">
                        Class
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {state.results!.map((result) => (
                      <tr key={result.studentId} className="hover:bg-surface/50">
                        <td className="px-4 py-3 font-medium text-text-primary">
                          {result.firstName} {result.lastInitial}.
                          <span className="block text-xs font-normal text-text-muted sm:hidden">
                            {result.className ?? '—'}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 text-text-secondary sm:table-cell">
                          {result.className ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          {result.status === 'linked' && (
                            <Badge variant="success">Already linked</Badge>
                          )}
                          {result.status === 'pending' && (
                            <span className="flex items-center gap-1.5 text-sm text-text-muted">
                              <Clock className="h-4 w-4" aria-hidden="true" />
                              Awaiting approval
                            </span>
                          )}
                          {result.status === 'available' && (
                            <LinkRequestButton studentId={result.studentId} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fallback: pupil code */}
      <details className="group rounded-lg border border-border bg-surface">
        <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-medium text-text-secondary hover:text-text-primary">
          Have a pupil payment code from a crèche letter?
          <span className="ml-2 text-xs text-text-muted transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="border-t border-border px-5 pb-5 pt-4">
          <PupilCodeForm />
        </div>
      </details>
    </div>
  )
}
