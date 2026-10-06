'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { checkInAction, checkOutAction, undoCheckInAction } from '@/lib/checkin/actions'
import type { CheckInState } from '@/lib/checkin/checkin'
import {
  CHILD_SESSION_LABELS,
  type StudentCareFields,
  type ChildSession,
} from '@/lib/students/schemas'

export interface CheckInChild {
  id: string
  name: string
  state: CheckInState
  care: StudentCareFields
}
export interface CheckInRoom {
  id: string
  name: string
  children: CheckInChild[]
}

const STATE_BADGE: Record<
  CheckInState,
  { variant: 'success' | 'default' | 'warning'; text: string }
> = {
  in: { variant: 'success', text: 'In' },
  out: { variant: 'default', text: 'Left' },
  not_in: { variant: 'warning', text: 'Not in' },
}

/** Whether there's any care information worth showing. */
function hasCare(care: StudentCareFields): boolean {
  return Boolean(
    care.allergies ||
    care.dietaryNeeds ||
    care.medicalConditions ||
    care.medicationConsent ||
    care.medicationNotes ||
    care.emergencyContactName ||
    care.emergencyContactPhone ||
    care.session,
  )
}

/** Read-only care summary (no editing) for the check-in glance view. */
function CareDetails({ care }: { care: StudentCareFields }) {
  const emergency = [care.emergencyContactName, care.emergencyContactPhone]
    .filter(Boolean)
    .join(' · ')
  const emergencyLine = care.emergencyContactRelationship
    ? `${emergency} (${care.emergencyContactRelationship})`
    : emergency
  const rows: [string, string][] = []
  if (care.allergies) rows.push(['Allergies', care.allergies])
  if (care.dietaryNeeds) rows.push(['Dietary', care.dietaryNeeds])
  if (care.medicalConditions) rows.push(['Medical', care.medicalConditions])
  if (care.medicationConsent || care.medicationNotes)
    rows.push([
      'Medication',
      `${care.medicationConsent ? 'Consent given' : 'No consent'}${
        care.medicationNotes ? ` — ${care.medicationNotes}` : ''
      }`,
    ])
  if (emergencyLine) rows.push(['Emergency contact', emergencyLine])
  if (care.session) rows.push(['Session', CHILD_SESSION_LABELS[care.session as ChildSession]])

  return (
    <dl className="mt-1 space-y-1 rounded-lg border border-border/60 bg-surface-raised/40 p-3">
      {rows.map(([label, value]) => (
        <div key={label} className="flex gap-2">
          <dt className="w-28 shrink-0 font-medium text-text-muted">{label}</dt>
          <dd className="text-text-secondary">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function CheckInBoard({ rooms, dateLabel }: { rooms: CheckInRoom[]; dateLabel: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const present = rooms.reduce((n, r) => n + r.children.filter((c) => c.state === 'in').length, 0)
  const total = rooms.reduce((n, r) => n + r.children.length, 0)

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) setError(res.error ?? 'Something went wrong.')
      else router.refresh()
    })
  }

  if (total === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
        No children enrolled yet.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm text-text-muted">Present now · {dateLabel}</p>
        <p className="mt-1 text-2xl font-bold text-text-primary">
          {present}{' '}
          <span className="text-base font-normal text-text-muted">of {total} enrolled</span>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {rooms.map((room) => {
          const roomPresent = room.children.filter((c) => c.state === 'in').length
          return (
            <div key={room.id} className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-text-primary">{room.name}</h2>
                <span className="text-sm text-text-muted">{roomPresent} present</span>
              </div>
              <ul className="mt-3 divide-y divide-border/60">
                {room.children.map((c) => {
                  const badge = STATE_BADGE[c.state]
                  return (
                    <li key={c.id} className="py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex flex-wrap items-center gap-2 text-sm">
                          <Badge variant={badge.variant}>{badge.text}</Badge>
                          {c.name}
                          {c.care.allergies && <Badge variant="error">Allergy</Badge>}
                          {c.care.medicalConditions && <Badge variant="warning">Medical</Badge>}
                        </span>
                        <span className="flex shrink-0 gap-1.5">
                          {c.state !== 'in' && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => run(() => checkInAction(c.id))}
                              disabled={isPending}
                            >
                              Check in
                            </Button>
                          )}
                          {c.state === 'in' && (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => run(() => checkOutAction(c.id))}
                                disabled={isPending}
                              >
                                Check out
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => run(() => undoCheckInAction(c.id))}
                                disabled={isPending}
                                title="Undo today's check-in"
                              >
                                Undo
                              </Button>
                            </>
                          )}
                        </span>
                      </div>
                      {hasCare(c.care) && (
                        <details className="mt-1 text-xs">
                          <summary className="cursor-pointer text-text-muted hover:text-primary">
                            Care details
                          </summary>
                          <CareDetails care={c.care} />
                        </details>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
