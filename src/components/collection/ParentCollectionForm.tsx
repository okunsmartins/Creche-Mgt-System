'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { requestCollectionByParentAction } from '@/lib/collection/actions'

export function ParentCollectionForm({
  childOptions,
  runOptions,
}: {
  childOptions: { id: string; name: string }[]
  runOptions: { id: string; label: string }[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function submit(form: HTMLFormElement) {
    setError(null)
    setDone(false)
    const fd = new FormData(form)
    const studentId = (fd.get('studentId') as string) ?? ''
    const runId = (fd.get('runId') as string) ?? ''
    if (!studentId || !runId) {
      setError('Choose a child and a run.')
      return
    }
    if (fd.get('consent') !== 'on') {
      setError('Please confirm consent to proceed.')
      return
    }
    startTransition(async () => {
      const res = await requestCollectionByParentAction({ studentId, runId, consent: true })
      if (!res.ok) setError(res.error)
      else {
        form.reset()
        setDone(true)
        router.refresh()
      }
    })
  }

  return (
    <form
      className="grid gap-3 rounded-xl border border-border bg-surface p-5"
      onSubmit={(e) => {
        e.preventDefault()
        submit(e.currentTarget)
      }}
    >
      {error && <Alert variant="error">{error}</Alert>}
      {done && <Alert variant="success">Request submitted — the crèche will review it.</Alert>}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-text-primary">Child</span>
        <select name="studentId" required className="input-base" defaultValue="">
          <option value="" disabled>
            Select your child…
          </option>
          {childOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-text-primary">Collection run</span>
        <select name="runId" required className="input-base" defaultValue="">
          <option value="" disabled>
            Select a run…
          </option>
          {runOptions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="consent" className="mt-0.5 h-4 w-4" />
        <span>
          I consent to my crèche collecting my child from their primary school on the days arranged,
          and to the associated charges.
        </span>
      </label>

      <div>
        <Button type="submit" disabled={isPending}>
          Request collection
        </Button>
      </div>
    </form>
  )
}
