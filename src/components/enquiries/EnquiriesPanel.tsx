'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Alert } from '@/components/ui/Alert'
import {
  createEnquiryAction,
  updateEnquiryStatusAction,
  deleteEnquiryAction,
  sendEnquiryEmailAction,
} from '@/lib/enquiries/actions'
import {
  ENQUIRY_STATUSES,
  ENQUIRY_STATUS_LABELS,
  type EnquiryStatus,
} from '@/lib/enquiries/enquiries'

export interface EnquiryRow {
  id: string
  parent_name: string
  parent_email: string | null
  parent_phone: string | null
  child_first_name: string | null
  child_last_name: string | null
  desired_start_date: string | null
  status: EnquiryStatus
  notes: string | null
  created_at: string
}

export function EnquiriesPanel({ enquiries }: { enquiries: EnquiryRow[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  // Which enquiry's email composer is open.
  const [emailingId, setEmailingId] = useState<string | null>(null)

  function submit(form: HTMLFormElement) {
    setError(null)
    const fd = new FormData(form)
    startTransition(async () => {
      const res = await createEnquiryAction({
        parentName: (fd.get('parentName') as string) ?? '',
        parentEmail: (fd.get('parentEmail') as string) ?? '',
        parentPhone: (fd.get('parentPhone') as string) ?? '',
        childFirstName: (fd.get('childFirstName') as string) ?? '',
        childLastName: (fd.get('childLastName') as string) ?? '',
        desiredStartDate: (fd.get('desiredStartDate') as string) ?? '',
        notes: (fd.get('notes') as string) ?? '',
      })
      if (!res.ok) setError(res.error)
      else {
        form.reset()
        setOpen(false)
        router.refresh()
      }
    })
  }

  function setStatus(id: string, status: string) {
    setError(null)
    startTransition(async () => {
      const res = await updateEnquiryStatusAction(id, status)
      if (!res.ok) setError(res.error)
      else router.refresh()
    })
  }

  function remove(id: string) {
    setError(null)
    startTransition(async () => {
      const res = await deleteEnquiryAction(id)
      if (!res.ok) setError(res.error)
      else router.refresh()
    })
  }

  function sendEmail(id: string, form: HTMLFormElement) {
    setError(null)
    setNotice(null)
    const fd = new FormData(form)
    startTransition(async () => {
      const res = await sendEnquiryEmailAction(
        id,
        (fd.get('subject') as string) ?? '',
        (fd.get('message') as string) ?? '',
      )
      if (!res.ok) setError(res.error)
      else {
        setNotice('Email sent to the parent.')
        setEmailingId(null)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <div>
        <Button type="button" onClick={() => setOpen((v) => !v)}>
          {open ? 'Cancel' : 'New enquiry'}
        </Button>
      </div>

      {open && (
        <form
          className="grid gap-3 rounded-xl border border-border bg-surface p-5 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            submit(e.currentTarget)
          }}
        >
          <Input label="Parent/guardian name" name="parentName" required />
          <Input label="Email" name="parentEmail" type="email" />
          <Input label="Phone" name="parentPhone" />
          <Input label="Desired start date" name="desiredStartDate" type="date" />
          <Input label="Child first name" name="childFirstName" />
          <Input label="Child last name" name="childLastName" />
          <div className="sm:col-span-2">
            <Textarea label="Notes" name="notes" rows={2} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={isPending}>
              Save enquiry
            </Button>
          </div>
        </form>
      )}

      {enquiries.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-muted">
          No enquiries yet. Add one with “New enquiry”.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-muted">
                <th className="px-4 py-3">Parent</th>
                <th className="px-4 py-3">Child</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Desired start</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {enquiries.map((e) => [
                <tr key={e.id} className="border-b border-border/50 align-top">
                  <td className="px-4 py-3 font-medium">
                    {e.parent_name}
                    {e.notes && (
                      <p className="mt-0.5 text-xs font-normal text-text-muted">{e.notes}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {[e.child_first_name, e.child_last_name].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {e.parent_email && <div>{e.parent_email}</div>}
                    {e.parent_phone && <div>{e.parent_phone}</div>}
                    {!e.parent_email && !e.parent_phone && '—'}
                  </td>
                  <td className="px-4 py-3">{e.desired_start_date ?? '—'}</td>
                  <td className="px-4 py-3">
                    <select
                      value={e.status}
                      onChange={(ev) => setStatus(e.id, ev.target.value)}
                      disabled={isPending}
                      className="input-base bg-[right_0.4rem_center] py-1 pr-7 text-xs"
                    >
                      {ENQUIRY_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {ENQUIRY_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {e.parent_email && (
                        <button
                          type="button"
                          onClick={() => {
                            setError(null)
                            setNotice(null)
                            setEmailingId((cur) => (cur === e.id ? null : e.id))
                          }}
                          disabled={isPending}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          {emailingId === e.id ? 'Close' : 'Email'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => remove(e.id)}
                        disabled={isPending}
                        className="text-xs text-text-muted hover:text-error"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>,
                emailingId === e.id && e.parent_email ? (
                  <tr key={`${e.id}-email`} className="border-b border-border/50 bg-surface/50">
                    <td colSpan={6} className="px-4 py-4">
                      <form
                        className="space-y-3"
                        onSubmit={(ev) => {
                          ev.preventDefault()
                          sendEmail(e.id, ev.currentTarget)
                        }}
                      >
                        <p className="text-xs text-text-muted">
                          Emailing <span className="font-medium">{e.parent_email}</span> as{' '}
                          {e.parent_name || 'the parent'} — sent from your crèche’s address.
                        </p>
                        <Input
                          label="Subject"
                          name="subject"
                          required
                          defaultValue={`Your enquiry${
                            [e.child_first_name, e.child_last_name].filter(Boolean).length
                              ? ` about ${[e.child_first_name, e.child_last_name].filter(Boolean).join(' ')}`
                              : ''
                          }`}
                        />
                        <Textarea
                          label="Message"
                          name="message"
                          rows={5}
                          required
                          defaultValue={`Hi ${e.parent_name?.split(' ')[0] ?? ''},\n\nThank you for your enquiry. `}
                        />
                        <div className="flex gap-2">
                          <Button type="submit" disabled={isPending}>
                            Send email
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setEmailingId(null)}
                            disabled={isPending}
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : null,
              ])}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
