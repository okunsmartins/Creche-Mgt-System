'use client'

import { useActionState, useState } from 'react'
import { MessageSquare, CheckCircle2 } from 'lucide-react'
import { sendParentSmsAction } from '@/lib/sms/actions'
import type { SmsActionState } from '@/lib/sms/schemas'
import { countSegments } from '@/lib/sms/segments'
import type { SmsBalanceView } from '@/lib/sms/balance'
import { StudentAudienceSelect } from '@/components/messages/StudentAudienceSelect'

export interface SmsClassOption {
  id: string
  label: string
}

export interface SmsStudentOption {
  id: string
  name: string
  classId: string
}

interface ParentSmsFormProps {
  /** Whether to offer the crèche-wide audience (admins only). */
  allowSchoolWide?: boolean
  /** Classes the sender may target. */
  classes?: SmsClassOption[]
  /** Students the sender may target (for the "specific pupil" audience). */
  students?: SmsStudentOption[]
  /** Current SMS balance (allowance + credits) for the cost panel. */
  balance: SmsBalanceView
  /** Parents in the crèche who have opted out of SMS (informational). */
  optedOutCount: number
}

const MAX_BODY = 640

export function ParentSmsForm({
  allowSchoolWide = false,
  classes = [],
  students = [],
  balance,
  optedOutCount,
}: ParentSmsFormProps) {
  const [state, formAction, pending] = useActionState<SmsActionState, FormData>(
    sendParentSmsAction,
    null,
  )
  const [audienceType, setAudienceType] = useState<'school' | 'class' | 'student'>(
    allowSchoolWide ? 'school' : 'class',
  )
  const [body, setBody] = useState('')

  const seg = countSegments(body)
  const totalAvailable = balance.allowanceRemaining + balance.credits

  if (state && 'success' in state) {
    return (
      <div className="card flex items-start gap-3 p-6">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <p className="font-semibold text-text-primary">Texts sent</p>
          <p className="mt-1 text-sm text-text-muted">
            Delivered to {state.sent} {state.sent === 1 ? 'parent/guardian' : 'parents/guardians'}
            {state.failed > 0 ? `, ${state.failed} failed` : ''}. Used {state.creditsCharged} credit
            {state.creditsCharged === 1 ? '' : 's'}.
          </p>
          {(state.noPhone > 0 || state.optedOut > 0) && (
            <p className="mt-1 text-xs text-text-muted">
              Skipped: {state.noPhone} with no mobile, {state.optedOut} opted out.
            </p>
          )}
          <a
            href=""
            className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
          >
            Send another
          </a>
        </div>
      </div>
    )
  }

  return (
    <form action={formAction} className="card space-y-5 p-6">
      {state && 'error' in state && (
        <div className="rounded-md border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
          {state.error}
        </div>
      )}

      {/* Balance */}
      <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-text-muted">
            <span className="font-semibold text-text-primary">
              {balance.allowanceRemaining}/{balance.allowanceLimit}
            </span>{' '}
            monthly allowance left
          </span>
          <span className="text-text-muted">
            <span className="font-semibold text-text-primary">{balance.credits}</span> credits
          </span>
        </div>
        <p className="mt-1 text-xs text-text-muted">
          1 credit = 1 segment (160 GSM chars). Allowance is used first, then credits.
          {optedOutCount > 0 && ` ${optedOutCount} parent(s) have opted out and are skipped.`}
        </p>
      </div>

      {/* Audience */}
      <div>
        <label
          htmlFor="audienceType"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-text-muted"
        >
          Send to
        </label>
        <select
          id="audienceType"
          name="audienceType"
          value={audienceType}
          onChange={(e) => setAudienceType(e.target.value as 'school' | 'class' | 'student')}
          className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {allowSchoolWide && <option value="school">All parents in the crèche</option>}
          <option value="class">Parents of a class</option>
          <option value="student">Parents of a specific pupil</option>
        </select>
      </div>

      {audienceType === 'student' && (
        <StudentAudienceSelect classes={classes} students={students} />
      )}

      {audienceType === 'class' && (
        <div>
          <label
            htmlFor="classId"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-text-muted"
          >
            Class
          </label>
          {classes.length === 0 ? (
            <p className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-muted">
              No classes available.
            </p>
          ) : (
            <select
              id="classId"
              name="classId"
              required
              className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Select a class…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Body */}
      <div>
        <label
          htmlFor="body"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-text-muted"
        >
          Message
        </label>
        <textarea
          id="body"
          name="body"
          required
          maxLength={MAX_BODY}
          rows={6}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="e.g. Reminder: school closed this Friday for staff training."
          className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-text-muted">
          <span>
            {seg.units}/{MAX_BODY} chars · {seg.segments} segment{seg.segments === 1 ? '' : 's'} ·{' '}
            <span className="font-semibold text-text-primary">
              {seg.segments} credit{seg.segments === 1 ? '' : 's'}
            </span>{' '}
            per recipient
            {seg.encoding === 'UCS-2' && ' · non-GSM chars (shorter segments)'}
          </span>
        </div>
        <p className="mt-1.5 text-xs text-text-muted">
          Parents receive this individually from your crèche. Sent to valid Irish mobiles only;
          opted-out parents are skipped. One-way — parents can&apos;t reply.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending || totalAvailable === 0}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:bg-primary-hover hover:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
      >
        <MessageSquare className="h-4 w-4" aria-hidden="true" />
        {pending ? 'Sending…' : 'Send text'}
      </button>
      {totalAvailable === 0 && (
        <p className="text-xs text-error">No allowance or credits left. Top up credits to send.</p>
      )}
    </form>
  )
}
