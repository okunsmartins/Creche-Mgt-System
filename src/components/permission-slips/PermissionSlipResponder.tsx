'use client'

import { useState, useTransition } from 'react'
import { Check, X } from 'lucide-react'
import { respondToPermissionSlipAction } from '@/lib/permission-slips/actions'

interface Props {
  slipId: string
  studentId: string
  initialConsent: boolean | null
  initialNote: string | null
}

/** Parent grant/decline + optional note for one slip and one child. */
export function PermissionSlipResponder({ slipId, studentId, initialConsent, initialNote }: Props) {
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState<boolean | null>(initialConsent)
  const [note, setNote] = useState(initialNote ?? '')
  const [error, setError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)

  function submit(consent: boolean) {
    setError(null)
    setJustSaved(false)
    startTransition(async () => {
      const res = await respondToPermissionSlipAction(slipId, studentId, consent, note)
      if (res.error) setError(res.error)
      else {
        setSaved(consent)
        setJustSaved(true)
      }
    })
  }

  const base =
    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 transition-colors disabled:opacity-50'

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => submit(true)}
          disabled={pending}
          className={`${base} ${
            saved === true
              ? 'bg-success text-white ring-success'
              : 'text-success ring-success/40 hover:bg-success/10'
          }`}
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          Grant permission
        </button>
        <button
          type="button"
          onClick={() => submit(false)}
          disabled={pending}
          className={`${base} ${
            saved === false
              ? 'bg-error text-white ring-error'
              : 'text-error ring-error/40 hover:bg-error/10'
          }`}
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Decline
        </button>
      </div>

      <div>
        <label htmlFor={`note-${slipId}-${studentId}`} className="sr-only">
          Optional note
        </label>
        <textarea
          id={`note-${slipId}-${studentId}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="Optional note (e.g. allergies, collection time)"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none"
        />
        {saved !== null && (
          <button
            type="button"
            onClick={() => submit(saved)}
            disabled={pending}
            className="mt-1 text-xs font-semibold text-primary hover:underline disabled:opacity-50"
          >
            Save note
          </button>
        )}
      </div>

      {error && <p className="text-xs text-error">{error}</p>}
      {justSaved && !error && (
        <p className="text-xs text-success">
          Saved — you {saved ? 'granted' : 'declined'} permission.
        </p>
      )}
    </div>
  )
}
