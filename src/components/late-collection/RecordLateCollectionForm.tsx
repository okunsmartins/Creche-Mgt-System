'use client'

import { useMemo, useState, useTransition } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { recordLateCollectionAction } from '@/lib/late-collection/actions'
import { computeLateFee, minutesLate, type LateFeePolicy } from '@/lib/late-collection/fee'

interface ChildOption {
  id: string
  name: string
}

interface RecordLateCollectionFormProps {
  childOptions: ChildOption[]
  policy: LateFeePolicy
  feesActive: boolean
  todayISO: string
}

function euros(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`
}

export function RecordLateCollectionForm({
  childOptions,
  policy,
  feesActive,
  todayISO,
}: RecordLateCollectionFormProps) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [time, setTime] = useState('')

  // Live preview from the same pure helper the server uses.
  const preview = useMemo(() => {
    if (!time) return null
    const late = Math.max(0, minutesLate(policy.cutoffTime, time))
    const fee = feesActive ? computeLateFee(policy, late) : 0
    return { late, fee }
  }, [time, policy, feesActive])

  function onSubmit(formData: FormData) {
    setMsg(null)
    const studentId = String(formData.get('studentId') ?? '')
    if (!studentId) {
      setMsg({ kind: 'err', text: 'Select a child.' })
      return
    }
    startTransition(async () => {
      const res = await recordLateCollectionAction({
        studentId,
        date: String(formData.get('date') ?? ''),
        time: String(formData.get('time') ?? ''),
        note: String(formData.get('note') ?? ''),
        alertParent: formData.get('alertParent') === 'on',
      })
      if (res.ok) {
        setMsg({
          kind: 'ok',
          text: `Recorded — ${res.minutesLate} min late, fee ${euros(res.feeCents)}${
            res.alerted ? ', parent alerted' : ''
          }.`,
        })
        ;(document.getElementById('late-collection-form') as HTMLFormElement | null)?.reset()
        setTime('')
      } else {
        setMsg({ kind: 'err', text: res.error })
      }
    })
  }

  const inputCls =
    'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary'

  return (
    <form id="late-collection-form" action={onSubmit} className="space-y-4">
      {msg && <Alert variant={msg.kind === 'ok' ? 'success' : 'error'}>{msg.text}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="studentId" className="mb-1 block text-sm font-medium text-text-primary">
            Child
          </label>
          <select id="studentId" name="studentId" required className={inputCls} defaultValue="">
            <option value="" disabled>
              Select a child…
            </option>
            {childOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="date" className="mb-1 block text-sm font-medium text-text-primary">
            Date
          </label>
          <input
            id="date"
            name="date"
            type="date"
            required
            defaultValue={todayISO}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="time" className="mb-1 block text-sm font-medium text-text-primary">
            Collection time
          </label>
          <input
            id="time"
            name="time"
            type="time"
            required
            className={inputCls}
            onChange={(e) => setTime(e.currentTarget.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="note" className="mb-1 block text-sm font-medium text-text-primary">
            Note (optional)
          </label>
          <input id="note" name="note" type="text" maxLength={300} className={inputCls} />
        </div>
      </div>

      {preview && (
        <div className="rounded-lg border border-border bg-surface/60 p-3 text-sm">
          <span className="text-text-muted">Cutoff {policy.cutoffTime} · </span>
          {preview.late > 0 ? (
            <span className="text-text-primary">
              <strong>{preview.late} min</strong> late →{' '}
              <strong className={preview.fee > 0 ? 'text-error' : 'text-text-primary'}>
                {euros(preview.fee)}
              </strong>
              {!feesActive && <span className="text-text-muted"> (fees inactive)</span>}
            </span>
          ) : (
            <span className="text-text-primary">On time — no fee.</span>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <input
          id="alertParent"
          name="alertParent"
          type="checkbox"
          defaultChecked
          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
        />
        <label htmlFor="alertParent" className="text-sm text-text-primary">
          Email the parent about this late collection
        </label>
      </div>

      <Button type="submit" loading={pending}>
        Record late collection
      </Button>
    </form>
  )
}
