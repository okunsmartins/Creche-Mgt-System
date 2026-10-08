'use client'

import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { submitParentEnquiryAction } from '@/lib/enquiries/parent-actions'

export function ParentEnquiryForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const [childFirstName, setChildFirstName] = useState('')
  const [childLastName, setChildLastName] = useState('')
  const [childDob, setChildDob] = useState('')
  const [desiredStartDate, setDesiredStartDate] = useState('')
  const [message, setMessage] = useState('')

  function submit() {
    setError(null)
    startTransition(async () => {
      const res = await submitParentEnquiryAction({
        childFirstName,
        childLastName,
        childDob,
        desiredStartDate,
        message,
      })
      if (!res.ok) setError(res.error ?? 'Something went wrong.')
      else {
        setDone(true)
        setChildFirstName('')
        setChildLastName('')
        setChildDob('')
        setDesiredStartDate('')
        setMessage('')
      }
    })
  }

  if (done) {
    return (
      <Alert variant="success">
        Thanks — your enquiry has been sent to the crèche. They&apos;ll be in touch.{' '}
        <button type="button" className="font-medium underline" onClick={() => setDone(false)}>
          Send another
        </button>
      </Alert>
    )
  }

  return (
    <div className="space-y-5">
      {error && <Alert variant="error">{error}</Alert>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label="Child's first name (optional)"
          value={childFirstName}
          disabled={isPending}
          onChange={(e) => setChildFirstName(e.target.value)}
          autoComplete="off"
        />
        <Input
          label="Child's last name (optional)"
          value={childLastName}
          disabled={isPending}
          onChange={(e) => setChildLastName(e.target.value)}
          autoComplete="off"
        />
        <Input
          label="Child's date of birth (optional)"
          type="date"
          value={childDob}
          disabled={isPending}
          onChange={(e) => setChildDob(e.target.value)}
        />
        <Input
          label="Preferred start date (optional)"
          type="date"
          value={desiredStartDate}
          disabled={isPending}
          onChange={(e) => setDesiredStartDate(e.target.value)}
        />
      </div>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-text-primary">Your enquiry</span>
        <textarea
          className="input-base min-h-[120px]"
          placeholder="Tell the crèche what you'd like to ask about — a place for another child, availability, sessions, etc."
          value={message}
          disabled={isPending}
          onChange={(e) => setMessage(e.target.value)}
        />
      </label>
      <Button type="button" loading={isPending} onClick={submit} disabled={message.trim() === ''}>
        Send enquiry
      </Button>
    </div>
  )
}
