'use client'

import { useActionState, useState } from 'react'
import { Send, CheckCircle2 } from 'lucide-react'
import { sendParentMessageAction } from '@/lib/messages/actions'
import type { ParentMessageActionState } from '@/lib/messages/schemas'
import { StudentAudienceSelect } from '@/components/messages/StudentAudienceSelect'

export interface ClassOption {
  id: string
  label: string
}

export interface MessageStudentOption {
  id: string
  name: string
  classId: string
}

interface ParentMessageFormProps {
  /** Whether to offer the crèche-wide audience (admins only). */
  allowSchoolWide?: boolean
  /** Classes the sender may target. */
  classes?: ClassOption[]
  /** Students the sender may target (for the "specific pupil" audience). */
  students?: MessageStudentOption[]
  /**
   * When set, the form is locked to messaging one pupil's parents — the audience
   * selector is replaced by a fixed "To: <name>'s parents" line.
   */
  fixedStudent?: { id: string; name: string }
}

export function ParentMessageForm({
  allowSchoolWide = false,
  classes = [],
  students = [],
  fixedStudent,
}: ParentMessageFormProps) {
  const [state, formAction, pending] = useActionState<ParentMessageActionState, FormData>(
    sendParentMessageAction,
    null,
  )
  const [audienceType, setAudienceType] = useState<'school' | 'class' | 'student'>(
    allowSchoolWide ? 'school' : 'class',
  )

  if (state && 'success' in state) {
    return (
      <div className="card flex items-start gap-3 p-6">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <p className="font-semibold text-text-primary">Message sent</p>
          <p className="mt-1 text-sm text-text-muted">
            Delivered to {state.recipientCount}{' '}
            {state.recipientCount === 1 ? 'parent/guardian' : 'parents/guardians'}.
          </p>
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

      {fixedStudent ? (
        <>
          <input type="hidden" name="audienceType" value="student" />
          <input type="hidden" name="studentId" value={fixedStudent.id} />
          <div>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-text-muted">
              Send to
            </span>
            <p className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary">
              {fixedStudent.name}&apos;s parents/guardians
            </p>
          </div>
        </>
      ) : (
        <>
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
        </>
      )}

      {/* Subject */}
      <div>
        <label
          htmlFor="subject"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-text-muted"
        >
          Subject
        </label>
        <input
          id="subject"
          name="subject"
          type="text"
          required
          maxLength={150}
          placeholder="e.g. School closed Friday"
          className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

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
          maxLength={5000}
          rows={8}
          placeholder="Write your message to parents…"
          className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <p className="mt-1.5 text-xs text-text-muted">
          Parents receive this individually — recipients are never shown to each other. Replies go
          to your email address.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition-all hover:bg-primary-hover hover:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Send className="h-4 w-4" aria-hidden="true" />
        {pending ? 'Sending…' : 'Send message'}
      </button>
    </form>
  )
}
