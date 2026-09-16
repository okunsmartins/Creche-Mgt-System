'use client'

import { useState, useActionState, useEffect, useRef } from 'react'
import { Users, Mail, ChevronDown, CheckSquare, Square, Send, Minus } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { StatusBadge } from '@/components/ui/Badge'
import {
  sendActivityEmailAction,
  type ActivityEmailRecipient,
  type ActivityEmailState,
} from '@/lib/email/activityEmailAction'

export type AttendeeRow = {
  id: string
  student_name: string
  class_name: string
  item_reference: string
  verification_status: string
  order_status: string
  payer_name: string
  payer_email: string | null
}

interface Props {
  activityId: string
  activityName: string
  attendees: AttendeeRow[]
}

export function ActivityAttendeesClient({ activityId, activityName, attendees }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [lastSuccess, setLastSuccess] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const [state, formAction, isPending] = useActionState<ActivityEmailState, FormData>(
    sendActivityEmailAction,
    null,
  )

  useEffect(() => {
    if (state?.success) {
      setLastSuccess(state.success)
      setSelectedIds(new Set())
      setShowEmailForm(false)
      formRef.current?.reset()
    }
  }, [state?.success])

  // Group attendees by class, preserving server sort order (class_name, student_name)
  const groupedByClass = attendees.reduce<Map<string, AttendeeRow[]>>((acc, a) => {
    const existing = acc.get(a.class_name)
    if (existing) {
      existing.push(a)
    } else {
      acc.set(a.class_name, [a])
    }
    return acc
  }, new Map())
  const classNames = Array.from(groupedByClass.keys())

  const attendeesWithEmail = attendees.filter((a) => a.payer_email)
  const allSelected =
    attendeesWithEmail.length > 0 && attendeesWithEmail.every((a) => selectedIds.has(a.id))
  const someSelected = attendeesWithEmail.some((a) => selectedIds.has(a.id)) && !allSelected

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(attendeesWithEmail.map((a) => a.id)))
    }
  }

  const toggleClass = (className: string) => {
    const classWithEmail = (groupedByClass.get(className) ?? []).filter((a) => a.payer_email)
    const classAllSelected = classWithEmail.every((a) => selectedIds.has(a.id))
    const next = new Set(selectedIds)
    if (classAllSelected) {
      classWithEmail.forEach((a) => next.delete(a.id))
    } else {
      classWithEmail.forEach((a) => next.add(a.id))
    }
    setSelectedIds(next)
  }

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
  }

  // Build recipient list — deduplicate by email (same parent, multiple children)
  const selectedRecipients: ActivityEmailRecipient[] = Array.from(
    new Map(
      attendeesWithEmail
        .filter((a) => selectedIds.has(a.id))
        .map((a) => [a.payer_email!, { email: a.payer_email!, name: a.payer_name }]),
    ).values(),
  )

  const allRecipients: ActivityEmailRecipient[] = Array.from(
    new Map(
      attendeesWithEmail.map((a) => [
        a.payer_email!,
        { email: a.payer_email!, name: a.payer_name },
      ]),
    ).values(),
  )

  const effectiveRecipients = selectedRecipients.length > 0 ? selectedRecipients : allRecipients

  const paidCount = attendees.filter((a) => a.order_status === 'paid').length
  const partialCount = attendees.filter((a) => a.order_status === 'partially_paid').length
  const pendingCount = attendees.filter((a) =>
    ['draft', 'pending_payment', 'payment_failed'].includes(a.order_status),
  ).length

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-4 text-center">
          <p className="text-2xl font-bold text-text-primary">{attendees.length}</p>
          <p className="mt-1 text-xs text-text-muted">Enrolled</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4 text-center">
          <p className="text-2xl font-bold text-success">{paidCount}</p>
          <p className="mt-1 text-xs text-text-muted">Paid in full</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4 text-center">
          <p className="text-2xl font-bold text-warning">{partialCount}</p>
          <p className="mt-1 text-xs text-text-muted">Part paid</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4 text-center">
          <p className="text-2xl font-bold text-text-secondary">{pendingCount}</p>
          <p className="mt-1 text-xs text-text-muted">Awaiting payment</p>
        </div>
      </div>

      {lastSuccess && (
        <Alert variant="success" onDismiss={() => setLastSuccess(null)}>
          {lastSuccess}
        </Alert>
      )}

      {attendees.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface py-16 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-text-muted" aria-hidden="true" />
          <p className="text-sm font-medium text-text-secondary">No registrations yet</p>
          <p className="mt-1 text-xs text-text-muted">
            Parents who pay for this activity will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* Attendees table grouped by class */}
          <div>
            {attendeesWithEmail.length > 0 && (
              <p className="mb-2 text-xs text-text-muted">
                Select rows or an entire class to target specific parents. Leave all unselected to
                email everyone.
              </p>
            )}
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      {attendeesWithEmail.length > 0 && (
                        <button
                          type="button"
                          onClick={toggleAll}
                          className="flex items-center text-text-muted hover:text-text-primary"
                          aria-label={allSelected ? 'Deselect all' : 'Select all'}
                        >
                          {allSelected ? (
                            <CheckSquare className="h-4 w-4 text-primary" />
                          ) : someSelected ? (
                            <Minus className="h-4 w-4 text-primary" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-text-muted">Child</th>
                    <th className="px-4 py-3 text-left font-medium text-text-muted">Parent</th>
                    <th className="px-4 py-3 text-left font-medium text-text-muted">
                      Parent email
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-text-muted">Payment</th>
                    <th className="px-4 py-3 text-left font-medium text-text-muted">
                      Verification
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {classNames.map((className) => {
                    const classAttendees = groupedByClass.get(className) ?? []
                    const classWithEmail = classAttendees.filter((a) => a.payer_email)
                    const classAllSelected =
                      classWithEmail.length > 0 &&
                      classWithEmail.every((a) => selectedIds.has(a.id))
                    const classSomeSelected =
                      classWithEmail.some((a) => selectedIds.has(a.id)) && !classAllSelected

                    return (
                      <>
                        {/* Class header row */}
                        <tr
                          key={`class-${className}`}
                          className="border-t border-border bg-surface/60"
                        >
                          <td className="px-4 py-2">
                            {classWithEmail.length > 0 && (
                              <button
                                type="button"
                                onClick={() => toggleClass(className)}
                                className="flex items-center text-text-muted hover:text-text-primary"
                                aria-label={
                                  classAllSelected
                                    ? `Deselect all in ${className}`
                                    : `Select all in ${className}`
                                }
                              >
                                {classAllSelected ? (
                                  <CheckSquare className="h-4 w-4 text-primary" />
                                ) : classSomeSelected ? (
                                  <Minus className="h-4 w-4 text-primary" />
                                ) : (
                                  <Square className="h-4 w-4" />
                                )}
                              </button>
                            )}
                          </td>
                          <td colSpan={5} className="px-4 py-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                              {className}
                            </span>
                            <span className="ml-2 text-xs text-text-muted">
                              {classAttendees.length}{' '}
                              {classAttendees.length === 1 ? 'child' : 'children'}
                            </span>
                          </td>
                        </tr>

                        {/* Child rows for this class */}
                        {classAttendees.map((attendee) => {
                          const hasEmail = !!attendee.payer_email
                          const isSelected = selectedIds.has(attendee.id)
                          return (
                            <tr
                              key={attendee.id}
                              className={`border-t border-border/50 ${isSelected ? 'bg-primary/5' : ''}`}
                            >
                              <td className="px-4 py-3">
                                {hasEmail ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleOne(attendee.id)}
                                    className="flex items-center"
                                    aria-label={`${isSelected ? 'Deselect' : 'Select'} ${attendee.payer_name}`}
                                  >
                                    {isSelected ? (
                                      <CheckSquare className="h-4 w-4 text-primary" />
                                    ) : (
                                      <Square className="h-4 w-4 text-text-muted" />
                                    )}
                                  </button>
                                ) : (
                                  <span className="block h-4 w-4" />
                                )}
                              </td>
                              <td className="px-4 py-3 font-medium text-text-primary">
                                {attendee.student_name}
                              </td>
                              <td className="px-4 py-3 text-text-secondary">
                                {attendee.payer_name}
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                                {attendee.payer_email ?? (
                                  <span className="italic text-text-muted">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge status={attendee.order_status} />
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge status={attendee.verification_status} />
                              </td>
                            </tr>
                          )
                        })}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Email compose panel */}
          {attendeesWithEmail.length > 0 && (
            <section className="rounded-lg border border-border bg-surface">
              <button
                type="button"
                className="flex w-full items-center justify-between px-5 py-4 text-left"
                onClick={() => setShowEmailForm(!showEmailForm)}
                aria-expanded={showEmailForm}
              >
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-text-muted" aria-hidden="true" />
                  <span className="text-sm font-semibold text-text-primary">Email parents</span>
                  {selectedIds.size > 0 && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {selectedRecipients.length} selected
                    </span>
                  )}
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-text-muted transition-transform duration-150 ${showEmailForm ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>

              {showEmailForm && (
                <div className="border-t border-border px-5 py-5">
                  {state?.error && (
                    <Alert variant="error" className="mb-4">
                      {state.error}
                    </Alert>
                  )}

                  <form action={formAction} ref={formRef} className="space-y-4">
                    <input type="hidden" name="activityId" value={activityId} />
                    <input
                      type="hidden"
                      name="recipients"
                      value={JSON.stringify(effectiveRecipients)}
                    />

                    {/* To field — read-only summary */}
                    <div>
                      <p className="mb-1 text-xs font-medium text-text-secondary">To</p>
                      <div className="rounded-md border border-border bg-background px-3 py-2 text-xs text-text-secondary">
                        {selectedRecipients.length > 0
                          ? `${selectedRecipients.length} parent${selectedRecipients.length !== 1 ? 's' : ''} selected`
                          : `All parents with email (${allRecipients.length})`}
                      </div>
                    </div>

                    <Input
                      label="Subject"
                      name="subject"
                      type="text"
                      required
                      defaultValue={`Update regarding ${activityName}`}
                    />

                    <Textarea
                      label="Message"
                      name="body"
                      required
                      rows={6}
                      placeholder={`Dear Parent,\n\nWe wanted to share an update about ${activityName}...`}
                    />

                    <div className="flex items-center justify-between gap-4">
                      <p className="text-xs text-text-muted">
                        Each parent receives a separate email.
                      </p>
                      <Button type="submit" loading={isPending} disabled={isPending}>
                        {!isPending && <Send className="h-4 w-4" aria-hidden="true" />}
                        Send
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
