'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { proposeCollectorByParentAction } from '@/lib/collectors/actions'
import { COLLECTOR_RELATIONSHIPS, COLLECTOR_RELATIONSHIP_LABELS } from '@/lib/collectors/collectors'

export function ParentCollectorsForm({
  childOptions,
}: {
  childOptions: { id: string; name: string }[]
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
    if (!studentId) {
      setError('Choose a child.')
      return
    }
    startTransition(async () => {
      const res = await proposeCollectorByParentAction({
        studentId,
        fullName: (fd.get('fullName') as string) ?? '',
        relationship: (fd.get('relationship') as string) ?? '',
        phone: (fd.get('phone') as string) ?? '',
        password: (fd.get('password') as string) ?? '',
        notes: (fd.get('notes') as string) ?? '',
      })
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
      className="grid gap-3 rounded-xl border border-border bg-surface p-5 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault()
        submit(e.currentTarget)
      }}
    >
      {error && (
        <div className="sm:col-span-2">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
      {done && (
        <div className="sm:col-span-2">
          <Alert variant="success">Submitted — the crèche will review and approve it.</Alert>
        </div>
      )}

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
        <span className="font-medium text-text-primary">Relationship</span>
        <select name="relationship" required className="input-base" defaultValue="grandparent">
          {COLLECTOR_RELATIONSHIPS.map((r) => (
            <option key={r} value={r}>
              {COLLECTOR_RELATIONSHIP_LABELS[r]}
            </option>
          ))}
        </select>
      </label>
      <Input label="Full name" name="fullName" required />
      <Input label="Phone" name="phone" />
      <Input
        label="Collection word (optional)"
        name="password"
        placeholder="A word staff can ask for at the door"
      />
      <div className="self-end pb-1 text-xs text-text-muted sm:col-span-1">
        The crèche must approve this person before they can collect.
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={isPending}>
          Submit for approval
        </Button>
      </div>
    </form>
  )
}
