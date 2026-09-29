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
  const [open, setOpen] = useState(false)

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

  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}

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
              {enquiries.map((e) => (
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
                    <button
                      type="button"
                      onClick={() => remove(e.id)}
                      disabled={isPending}
                      className="text-xs text-text-muted hover:text-error"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
