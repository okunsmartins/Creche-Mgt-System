'use client'

import { useState, useTransition } from 'react'
import { Trash2, EyeOff } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { deleteObservationAction } from '@/lib/observations/actions'
import { AISTEAR_THEME_LABELS } from '@/lib/observations/observations'
import { formatDate } from '@/lib/utils'
import type { StudentObservations } from '@/lib/observations/queries'

export function ObservationTimeline({
  students,
  canManage = false,
  emptyText = 'No observations yet.',
}: {
  students: StudentObservations[]
  canManage?: boolean
  emptyText?: string
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const anyObservations = students.some((s) => s.observations.length > 0)
  if (!anyObservations) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
        {emptyText}
      </div>
    )
  }

  function remove(id: string) {
    setError(null)
    setDeleting(id)
    startTransition(async () => {
      const res = await deleteObservationAction(id)
      setDeleting(null)
      if (res.error) setError(res.error)
    })
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-error/30 bg-error/10 px-4 py-2 text-sm text-error">
          {error}
        </div>
      )}
      {students
        .filter((s) => s.observations.length > 0)
        .map((s) => (
          <section key={s.studentId} className="space-y-3">
            <h2 className="text-base font-semibold text-text-primary">
              {[s.firstName, s.lastName].filter(Boolean).join(' ')}
              {s.className && (
                <span className="ml-2 text-sm font-normal text-text-muted">{s.className}</span>
              )}
            </h2>
            <ol className="space-y-3">
              {s.observations.map((o) => (
                <li key={o.id} className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-text-primary">{o.title}</p>
                      <p className="text-xs text-text-muted">{formatDate(o.observationDate)}</p>
                    </div>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => remove(o.id)}
                        disabled={isPending && deleting === o.id}
                        className="inline-flex items-center gap-1 text-xs font-medium text-text-muted hover:text-error disabled:opacity-50"
                        aria-label="Delete observation"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {isPending && deleting === o.id ? 'Deleting…' : 'Delete'}
                      </button>
                    )}
                  </div>

                  {o.themes.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {o.themes.map((t) => (
                        <Badge key={t} variant="default">
                          {AISTEAR_THEME_LABELS[t]}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <p className="mt-3 whitespace-pre-wrap text-sm text-text-secondary">
                    {o.learningStory}
                  </p>

                  {o.nextSteps && (
                    <p className="mt-2 text-sm text-text-secondary">
                      <span className="font-medium text-text-primary">Next steps: </span>
                      {o.nextSteps}
                    </p>
                  )}

                  {o.imageUrl && (
                    <a
                      href={o.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- signed remote URL */}
                      <img
                        src={o.imageUrl}
                        alt={`Photo for ${o.title}`}
                        className="max-h-56 rounded-lg border border-border object-cover"
                      />
                    </a>
                  )}

                  <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
                    {o.authorName && <span>By {o.authorName}</span>}
                    {canManage && !o.sharedWithParents && (
                      <span className="inline-flex items-center gap-1 text-amber-700">
                        <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> Not shared with
                        parents
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
    </div>
  )
}
