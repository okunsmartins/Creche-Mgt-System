'use client'

import { useActionState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import {
  submitWebsiteEnquiryAction,
  type WebsiteEnquiryState,
} from '@/lib/enquiries/website-actions'
import { WEEKDAYS } from '@/lib/enquiries/website'

const field =
  'min-h-[46px] w-full rounded-2xl border-2 border-border bg-white px-3.5 py-2 font-semibold text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'

function Field({
  label,
  name,
  type = 'text',
  autoComplete,
  required,
}: {
  label: string
  name: string
  type?: string
  autoComplete?: string
  required?: boolean
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-extrabold">
      <span>
        {label}
        {required && (
          <span className="ml-1 text-error" aria-hidden="true">
            *
          </span>
        )}
      </span>
      <input
        className={field}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
      />
    </label>
  )
}

export function WaitingListForm({ schoolName }: { schoolName: string }) {
  const [state, action, pending] = useActionState<WebsiteEnquiryState, FormData>(
    submitWebsiteEnquiryAction,
    null,
  )

  if (state?.ok) {
    return (
      <div
        role="status"
        className="flex flex-col items-start gap-3 rounded-2xl bg-success-light p-6"
      >
        <CheckCircle2 className="h-8 w-8 text-success" aria-hidden="true" />
        <p className="font-display text-2xl font-bold">Thank you — we&apos;ve got your enquiry</p>
        <p className="text-text-secondary">
          We&apos;ve emailed you a confirmation, and the team at {schoolName} will be in touch soon.
        </p>
      </div>
    )
  }

  return (
    <form action={action} className="mt-6 grid gap-4 sm:grid-cols-2">
      {/* Honeypot: hidden from people, tempting to bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Field label="Your name" name="parentName" autoComplete="name" required />
      <Field label="Email" name="parentEmail" type="email" autoComplete="email" required />
      <Field label="Phone" name="parentPhone" type="tel" autoComplete="tel" />
      <Field label="Child's first name" name="childFirstName" />
      <Field label="Child's date of birth" name="childDob" type="date" />
      <Field label="Hoped-for start date" name="desiredStartDate" type="date" />
      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-extrabold">Days needed</legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {WEEKDAYS.map((d) => (
            <label key={d} className="cursor-pointer">
              <input type="checkbox" name="days" value={d} className="peer sr-only" />
              <span className="inline-flex min-h-[40px] items-center rounded-full border-2 border-border px-4 font-bold transition-colors peer-checked:border-primary peer-checked:bg-primary-light peer-checked:text-primary peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
                {d}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1.5 text-sm font-extrabold sm:col-span-2">
        Anything else?
        <textarea name="message" rows={3} maxLength={2000} className={`${field} resize-y`} />
      </label>
      {state && !state.ok && (
        <p role="alert" className="text-sm font-bold text-error sm:col-span-2">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-[52px] items-center rounded-full bg-primary px-7 text-[17px] font-extrabold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          {pending ? 'Sending…' : 'Send enquiry'}
        </button>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="wantsVisit" className="h-[18px] w-[18px] accent-primary" />
          I&apos;d like to visit the crèche too
        </label>
      </div>
    </form>
  )
}
