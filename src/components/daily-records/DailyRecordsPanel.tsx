'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { addDailyRecordAction, deleteDailyRecordAction } from '@/lib/daily-records/actions'
import {
  DAILY_RECORD_TYPES,
  DAILY_RECORD_LABELS,
  type DailyRecordType,
} from '@/lib/daily-records/records'

export interface DailyRecordRow {
  id: string
  type: DailyRecordType
  note: string | null
  recorded_at: string
}

export function DailyRecordsPanel({
  studentId,
  records,
}: {
  studentId: string
  records: DailyRecordRow[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [type, setType] = useState<DailyRecordType>('nappy')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  function add() {
    setError(null)
    startTransition(async () => {
      const res = await addDailyRecordAction({ studentId, type, note })
      if (!res.ok) setError(res.error)
      else {
        setNote('')
        router.refresh()
      }
    })
  }

  function remove(id: string) {
    setError(null)
    startTransition(async () => {
      const res = await deleteDailyRecordAction(id)
      if (!res.ok) setError(res.error)
      else router.refresh()
    })
  }

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-base font-semibold text-text-primary">Add a record</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {DAILY_RECORD_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                type === t
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-text-secondary hover:bg-surface-raised'
              }`}
            >
              {DAILY_RECORD_LABELS[t]}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <Textarea
            label={`Note${type === 'incident' || type === 'medication' ? ' (required)' : ''}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={
              type === 'medication'
                ? 'e.g. Calpol 5ml at 15:00 (parent consent on file)'
                : type === 'incident'
                  ? 'e.g. Small bump on knee at 11:20, comforted, parent to be told'
                  : type === 'sleep'
                    ? 'e.g. Slept 12:30–14:00'
                    : 'Optional detail'
            }
          />
        </div>
        <div className="mt-3">
          <Button type="button" onClick={add} disabled={isPending}>
            Add {DAILY_RECORD_LABELS[type].toLowerCase()} record
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-base font-semibold text-text-primary">Today’s records</h2>
        {records.length === 0 ? (
          <p className="mt-1 text-sm text-text-muted">No records logged today.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {records.map((r) => (
              <li
                key={r.id}
                className="flex items-start justify-between gap-3 border-b border-border/50 pb-2"
              >
                <div className="text-sm">
                  <span className="flex items-center gap-2">
                    <Badge variant="default">{DAILY_RECORD_LABELS[r.type]}</Badge>
                    <span className="text-text-muted">{fmtTime(r.recorded_at)}</span>
                  </span>
                  {r.note && <p className="mt-1 text-text-secondary">{r.note}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => remove(r.id)}
                  disabled={isPending}
                  className="shrink-0 text-xs text-text-muted hover:text-error"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
